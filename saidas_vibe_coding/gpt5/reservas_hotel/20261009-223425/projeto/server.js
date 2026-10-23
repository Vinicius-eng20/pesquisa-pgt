const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const db = new Database("hotel.db");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new SQLiteStore({ db: "sessions.db", dir: "." }),
    secret: "troque-este-segredo-em-producao",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 30
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('guest', 'manager')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      capacity INTEGER NOT NULL,
      price REAL NOT NULL,
      image TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      room_id INTEGER NOT NULL,
      checkin TEXT NOT NULL,
      checkout TEXT NOT NULL,
      guests INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'rejected', 'cancelled')) DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(room_id) REFERENCES rooms(id)
    );
  `);

  const manager = db.prepare("SELECT id FROM users WHERE email = ?").get("gerente@hotel.com");
  if (!manager) {
    const hash = bcrypt.hashSync("gerente123", 10);
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)").run(
      "Gerente",
      "gerente@hotel.com",
      hash,
      "manager"
    );
  }

  const roomCount = db.prepare("SELECT COUNT(*) AS total FROM rooms").get().total;
  if (roomCount === 0) {
    const insert = db.prepare(`
      INSERT INTO rooms (name, description, capacity, price, image, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);

    insert.run(
      "Quarto Standard",
      "Quarto confortável para até 2 pessoas, com cama de casal, banheiro privativo e ar-condicionado.",
      2,
      220,
      "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=1200&q=80"
    );

    insert.run(
      "Quarto Família",
      "Espaço ideal para famílias, com camas extras, banheiro privativo e vista para a cidade.",
      4,
      380,
      "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=1200&q=80"
    );

    insert.run(
      "Suíte Luxo",
      "Suíte ampla com cama king size, banheira, varanda e café da manhã incluso.",
      2,
      620,
      "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=1200&q=80"
    );
  }
}

initDb();

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Você precisa entrar na sua conta." });
  }
  next();
}

function requireManager(req, res, next) {
  if (!req.session.user || req.session.user.role !== "manager") {
    return res.status(403).json({ error: "Acesso permitido apenas ao gerente." });
  }
  next();
}

function isValidDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function validateReservationDates(checkin, checkout) {
  if (!isValidDate(checkin) || !isValidDate(checkout)) {
    return "Informe datas válidas.";
  }

  const inDate = new Date(checkin + "T00:00:00");
  const outDate = new Date(checkout + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (inDate < today) {
    return "A data de entrada não pode ser no passado.";
  }

  if (outDate <= inDate) {
    return "A data de saída precisa ser depois da data de entrada.";
  }

  return null;
}

function roomIsAvailable(roomId, checkin, checkout, ignoreReservationId = null) {
  let sql = `
    SELECT COUNT(*) AS total
    FROM reservations
    WHERE room_id = ?
      AND status IN ('pending', 'confirmed')
      AND checkin < ?
      AND checkout > ?
  `;
  const params = [roomId, checkout, checkin];

  if (ignoreReservationId) {
    sql += " AND id != ?";
    params.push(ignoreReservationId);
  }

  const result = db.prepare(sql).get(...params);
  return result.total === 0;
}

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post("/api/register", (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Preencha nome, e-mail e senha." });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "A senha precisa ter pelo menos 6 caracteres." });
  }

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) {
    return res.status(400).json({ error: "Já existe uma conta com este e-mail." });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'guest')").run(
    name,
    email,
    hash
  );

  req.session.user = {
    id: result.lastInsertRowid,
    name,
    email,
    role: "guest"
  };

  res.json({ user: req.session.user });
});

app.post("/api/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(400).json({ error: "E-mail ou senha incorretos." });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  res.json({ user: req.session.user });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/rooms", (req, res) => {
  const rooms = db.prepare("SELECT * FROM rooms WHERE active = 1 ORDER BY id DESC").all();
  res.json({ rooms });
});

app.get("/api/rooms/available", (req, res) => {
  const checkin = String(req.query.checkin || "");
  const checkout = String(req.query.checkout || "");
  const guests = Number(req.query.guests || 1);

  const dateError = validateReservationDates(checkin, checkout);
  if (dateError) {
    return res.status(400).json({ error: dateError });
  }

  if (!Number.isInteger(guests) || guests < 1) {
    return res.status(400).json({ error: "Informe a quantidade de hóspedes." });
  }

  const rooms = db.prepare(`
    SELECT *
    FROM rooms
    WHERE active = 1
      AND capacity >= ?
      AND id NOT IN (
        SELECT room_id
        FROM reservations
        WHERE status IN ('pending', 'confirmed')
          AND checkin < ?
          AND checkout > ?
      )
    ORDER BY price ASC
  `).all(guests, checkout, checkin);

  res.json({ rooms });
});

app.post("/api/reservations", requireLogin, (req, res) => {
  if (req.session.user.role !== "guest") {
    return res.status(403).json({ error: "Apenas hóspedes podem criar reservas." });
  }

  const roomId = Number(req.body.roomId);
  const checkin = String(req.body.checkin || "");
  const checkout = String(req.body.checkout || "");
  const guests = Number(req.body.guests || 1);

  const dateError = validateReservationDates(checkin, checkout);
  if (dateError) {
    return res.status(400).json({ error: dateError });
  }

  if (!Number.isInteger(roomId) || !Number.isInteger(guests) || guests < 1) {
    return res.status(400).json({ error: "Dados da reserva inválidos." });
  }

  const room = db.prepare("SELECT * FROM rooms WHERE id = ? AND active = 1").get(roomId);
  if (!room) {
    return res.status(404).json({ error: "Quarto não encontrado." });
  }

  if (guests > room.capacity) {
    return res.status(400).json({ error: "Este quarto não comporta essa quantidade de hóspedes." });
  }

  if (!roomIsAvailable(roomId, checkin, checkout)) {
    return res.status(400).json({ error: "Este quarto não está mais disponível nessas datas." });
  }

  const result = db.prepare(`
    INSERT INTO reservations (user_id, room_id, checkin, checkout, guests, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(req.session.user.id, roomId, checkin, checkout, guests);

  res.json({ id: result.lastInsertRowid, message: "Reserva criada. Aguarde confirmação do gerente." });
});

app.get("/api/my-reservations", requireLogin, (req, res) => {
  if (req.session.user.role !== "guest") {
    return res.status(403).json({ error: "Apenas hóspedes acessam esta área." });
  }

  const reservations = db.prepare(`
    SELECT r.*, rooms.name AS room_name, rooms.price AS room_price, rooms.image AS room_image
    FROM reservations r
    JOIN rooms ON rooms.id = r.room_id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(req.session.user.id);

  res.json({ reservations });
});

app.post("/api/my-reservations/:id/cancel", requireLogin, (req, res) => {
  if (req.session.user.role !== "guest") {
    return res.status(403).json({ error: "Apenas hóspedes podem cancelar suas reservas." });
  }

  const id = Number(req.params.id);
  const reservation = db.prepare("SELECT * FROM reservations WHERE id = ? AND user_id = ?").get(id, req.session.user.id);

  if (!reservation) {
    return res.status(404).json({ error: "Reserva não encontrada." });
  }

  if (reservation.status === "cancelled") {
    return res.status(400).json({ error: "Esta reserva já foi cancelada." });
  }

  if (reservation.status === "rejected") {
    return res.status(400).json({ error: "Esta reserva já foi recusada." });
  }

  db.prepare("UPDATE reservations SET status = 'cancelled' WHERE id = ?").run(id);
  res.json({ ok: true });
});

app.get("/api/manager/rooms", requireManager, (req, res) => {
  const rooms = db.prepare("SELECT * FROM rooms ORDER BY active DESC, id DESC").all();
  res.json({ rooms });
});

app.post("/api/manager/rooms", requireManager, (req, res) => {
  const name = String(req.body.name || "").trim();
  const description = String(req.body.description || "").trim();
  const capacity = Number(req.body.capacity);
  const price = Number(req.body.price);
  const image = String(req.body.image || "").trim();

  if (!name || !description || !Number.isInteger(capacity) || capacity < 1 || !Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "Preencha corretamente os dados do quarto." });
  }

  const result = db.prepare(`
    INSERT INTO rooms (name, description, capacity, price, image, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `).run(name, description, capacity, price, image);

  res.json({ id: result.lastInsertRowid });
});

app.put("/api/manager/rooms/:id", requireManager, (req, res) => {
  const id = Number(req.params.id);
  const name = String(req.body.name || "").trim();
  const description = String(req.body.description || "").trim();
  const capacity = Number(req.body.capacity);
  const price = Number(req.body.price);
  const image = String(req.body.image || "").trim();
  const active = req.body.active ? 1 : 0;

  if (!Number.isInteger(id) || !name || !description || !Number.isInteger(capacity) || capacity < 1 || !Number.isFinite(price) || price < 0) {
    return res.status(400).json({ error: "Preencha corretamente os dados do quarto." });
  }

  const room = db.prepare("SELECT id FROM rooms WHERE id = ?").get(id);
  if (!room) {
    return res.status(404).json({ error: "Quarto não encontrado." });
  }

  db.prepare(`
    UPDATE rooms
    SET name = ?, description = ?, capacity = ?, price = ?, image = ?, active = ?
    WHERE id = ?
  `).run(name, description, capacity, price, image, active, id);

  res.json({ ok: true });
});

app.delete("/api/manager/rooms/:id", requireManager, (req, res) => {
  const id = Number(req.params.id);

  const room = db.prepare("SELECT id FROM rooms WHERE id = ?").get(id);
  if (!room) {
    return res.status(404).json({ error: "Quarto não encontrado." });
  }

  const hasReservations = db.prepare("SELECT COUNT(*) AS total FROM reservations WHERE room_id = ?").get(id).total;

  if (hasReservations > 0) {
    db.prepare("UPDATE rooms SET active = 0 WHERE id = ?").run(id);
  } else {
    db.prepare("DELETE FROM rooms WHERE id = ?").run(id);
  }

  res.json({ ok: true });
});

app.get("/api/manager/reservations", requireManager, (req, res) => {
  const reservations = db.prepare(`
    SELECT
      r.*,
      users.name AS guest_name,
      users.email AS guest_email,
      rooms.name AS room_name,
      rooms.price AS room_price
    FROM reservations r
    JOIN users ON users.id = r.user_id
    JOIN rooms ON rooms.id = r.room_id
    ORDER BY r.created_at DESC
  `).all();

  res.json({ reservations });
});

app.post("/api/manager/reservations/:id/status", requireManager, (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || "");

  if (!["confirmed", "rejected"].includes(status)) {
    return res.status(400).json({ error: "Status inválido." });
  }

  const reservation = db.prepare("SELECT * FROM reservations WHERE id = ?").get(id);
  if (!reservation) {
    return res.status(404).json({ error: "Reserva não encontrada." });
  }

  if (reservation.status === "cancelled") {
    return res.status(400).json({ error: "Não é possível alterar uma reserva cancelada." });
  }

  if (status === "confirmed" && !roomIsAvailable(reservation.room_id, reservation.checkin, reservation.checkout, reservation.id)) {
    return res.status(400).json({ error: "Não é possível confirmar: existe outra reserva pendente ou confirmada no mesmo período." });
  }

  db.prepare("UPDATE reservations SET status = ? WHERE id = ?").run(status, id);
  res.json({ ok: true });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sistema de reservas rodando em http://localhost:${PORT}`);
});
