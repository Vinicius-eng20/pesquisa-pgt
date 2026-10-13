const express = require('express');
const path = require('path');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, 'agendamentos.db');

// ===== Banco de dados =====
const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('client','owner')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL DEFAULT 0,
    duration_min INTEGER NOT NULL DEFAULT 30,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS time_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    weekday INTEGER NOT NULL,
    time TEXT NOT NULL,
    UNIQUE (weekday, time)
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending','confirmed','rejected','cancelled')) DEFAULT 'pending',
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES users(id),
    FOREIGN KEY (service_id) REFERENCES services(id)
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_unique
    ON bookings (service_id, date, time)
    WHERE status IN ('pending','confirmed');
`);

// ===== Senhas (hash) =====
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}
function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function checkAuth(req, res, next) {
  const user = req.session && req.session.user;
  if (!user) return res.status(401).json({ error: 'Faça login.' });
  next();
}
function requireOwner(req, res, next) {
  checkAuth(req, res, () => {
    if (req.session.user.role !== 'owner') return res.status(403).json({ error: 'Acesso negado.' });
    next();
  });
}

// ===== Sessões simples (JWT-like com expiração) =====
const sessions = new Map(); // token -> { user, expires }
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;

function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { user, expires: Date.now() + SESSION_MS });
  return token;
}
function readSession(req) {
  const token = (req.get('Authorization') || '').replace(/^Bearer /, '');
  const s = sessions.get(token);
  if (s && s.expires > Date.now()) {
    req.session = s;
    return true;
  }
  sessions.delete(token);
  return false;
}

// ===== Helpers de data =====
function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
function weekdayOf(dateStr) {
  // 1970-01-01 era quarta-feira (4). Usamos 0=Seg..6=Dom.
  const dt = new Date(dateStr + 'T12:00:00Z');
  const js = dt.getUTCDay(); // 0=Dom
  return (js + 6) % 7; // 0=Seg ... 6=Dom
}

// ===== Middleware =====
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ===== Rotas: autenticação =====
app.post('/api/register', (req, res) => {
  const { username, password, name, phone } = req.body || {};
  if (!username || !password || !name || !phone) {
    return res.status(400).json({ error: 'Preencha nome, telefone, usuário e senha.' });
  }
  if (String(username).trim().length < 3) {
    return res.status(400).json({ error: 'Usuário deve ter pelo menos 3 caracteres.' });
  }
  if (String(password).length < 4) {
    return res.status(400).json({ error: 'Senha deve ter pelo menos 4 caracteres.' });
  }
  const u = db.prepare('SELECT id FROM users WHERE username = ?').get(String(username).trim());
  if (u) return res.status(409).json({ error: 'Este usuário já existe.' });

  const salt = makeSalt();
  const hash = hashPassword(String(password), salt);
  const info = db.prepare(
    'INSERT INTO users (username, password_hash, salt, name, phone, role) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(String(username).trim(), hash, salt, String(name).trim(), String(phone).trim(), 'client');

  const user = db.prepare('SELECT id, username, name, phone, role FROM users WHERE id = ?').get(info.lastInsertRowid);
  const token = createSession(user);
  res.json({ token, user });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username).trim());
  if (!row) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  const hash = hashPassword(String(password), row.salt);
  if (hash !== row.password_hash) return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  const user = { id: row.id, username: row.username, name: row.name, phone: row.phone, role: row.role };
  const token = createSession(user);
  res.json({ token, user });
});

app.get('/api/me', (req, res) => {
  if (!readSession(req)) return res.status(401).json({ error: 'Faça login.' });
  res.json({ user: req.session.user });
});

app.post('/api/logout', (req, res) => {
  const token = (req.get('Authorization') || '').replace(/^Bearer /, '');
  sessions.delete(token);
  res.json({ ok: true });
});

// ===== Rotas: serviços (público) =====
app.get('/api/services', (req, res) => {
  const rows = db.prepare('SELECT id, name, description, price, duration_min FROM services WHERE active = 1 ORDER BY name').all();
  res.json(rows);
});

// ===== Rotas: horários livres =====
// Retorna, para um serviço e um intervalo de dias, quais horários estão livres.
app.get('/api/availability', checkAuth, (req, res) => {
  const { serviceId, days } = req.query;
  const sid = parseInt(serviceId, 10);
  const n = Math.min(parseInt(days, 10) || 14, 60);
  if (!sid) return res.status(400).json({ error: 'Informe o serviço.' });

  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(sid);
  if (!svc) return res.status(404).json({ error: 'Serviço não encontrado.' });

  const slots = db.prepare('SELECT weekday, time FROM time_slots ORDER BY weekday, time').all();
  const taken = db.prepare(
    `SELECT date, time FROM bookings
     WHERE service_id = ? AND status IN ('pending','confirmed') AND date >= ? AND date <= ?`
  ).all(sid, addDaysISO(0), addDaysISO(n - 1));
  const takenSet = new Set(taken.map(t => t.date + '|' + t.time));

  const result = [];
  for (let i = 0; i < n; i++) {
    const date = addDaysISO(i);
    const wd = weekdayOf(date);
    const free = slots.filter(s => s.weekday === wd && !takenSet.has(date + '|' + s.time)).map(s => s.time);
    result.push({ date, weekday: wd, freeTimes: free });
  }
  res.json({ serviceId: sid, durationMin: svc.duration_min, days: result });
});

// ===== Rotas: agendamentos (cliente) =====
app.post('/api/bookings', checkAuth, (req, res) => {
  const { serviceId, date, time, note } = req.body || {};
  const clientId = req.session.user.id;
  const sid = parseInt(serviceId, 10);
  if (!sid || !date || !time) return res.status(400).json({ error: 'Preencha serviço, data e horário.' });

  const svc = db.prepare('SELECT * FROM services WHERE id = ?').get(sid);
  if (!svc) return res.status(404).json({ error: 'Serviço não encontrado.' });

  // Valida se existe slot para esse dia da semana
  const wd = weekdayOf(date);
  const slotOk = db.prepare('SELECT 1 FROM time_slots WHERE weekday = ? AND time = ?').get(wd, time);
  if (!slotOk) return res.status(400).json({ error: 'Este horário não está disponível para este dia.' });

  // Verifica conflito (mesmo serviço, mesma data/hora)
  const conflict = db.prepare(
    "SELECT id FROM bookings WHERE service_id = ? AND date = ? AND time = ? AND status IN ('pending','confirmed')"
  ).get(sid, date, time);
  if (conflict) return res.status(409).json({ error: 'Este horário acabou de ser ocupado. Escolha outro.' });

  const info = db.prepare(
    "INSERT INTO bookings (client_id, service_id, date, time, status, note) VALUES (?, ?, ?, ?, 'pending', ?)"
  ).run(clientId, sid, date, time, note ? String(note).slice(0, 500) : null);

  const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json(row);
});

app.get('/api/bookings/mine', checkAuth, (req, res) => {
  const clientId = req.session.user.id;
  const rows = db.prepare(
    `SELECT b.id, b.date, b.time, b.status, b.created_at, b.note,
            s.name AS service_name, s.price
     FROM bookings b JOIN services s ON s.id = b.service_id
     WHERE b.client_id = ?
     ORDER BY b.date DESC, b.time DESC`
  ).all(clientId);
  res.json(rows);
});

app.post('/api/bookings/:id/cancel', checkAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const clientId = req.session.user.id;
  const row = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Agendamento não encontrado.' });
  if (row.client_id !== clientId && req.session.user.role !== 'owner') {
    return res.status(403).json({ error: 'Você não pode cancelar este agendamento.' });
  }
  if (!['pending', 'confirmed'].includes(row.status)) {
    return res.status(400).json({ error: 'Este agendamento já não pode ser cancelado.' });
  }
  db.prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?").run(id);
  res.json(db.prepare('SELECT * FROM bookings WHERE id = ?').get(id));
});

// ===== Rotas: responsável =====
app.get('/api/owner/bookings', requireOwner, (req, res) => {
  const { status } = req.query;
  let sql = `SELECT b.id, b.date, b.time, b.status, b.created_at, b.note,
            s.name AS service_name, s.price,
            u.name AS client_name, u.phone AS client_phone, u.username AS client_username
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     JOIN users u ON u.id = b.client_id`;
  const params = [];
  if (status) {
    sql += ' WHERE b.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY b.date DESC, b.time DESC';
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/owner/bookings/:id/confirm', requireOwner, (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare("UPDATE bookings SET status = 'confirmed' WHERE id = ?").run(id);
  res.json(db.prepare('SELECT * FROM bookings WHERE id = ?').get(id));
});

app.post('/api/owner/bookings/:id/reject', requireOwner, (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare("UPDATE bookings SET status = 'rejected' WHERE id = ?").run(id);
  res.json(db.prepare('SELECT * FROM bookings WHERE id = ?').get(id));
});

// Serviços CRUD (responsável)
app.get('/api/owner/services', requireOwner, (req, res) => {
  res.json(db.prepare('SELECT * FROM services ORDER BY name').all());
});
app.post('/api/owner/services', requireOwner, (req, res) => {
  const { name, description, price, duration_min } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Informe o nome do serviço.' });
  const priceNum = parseFloat(price);
  const dur = parseInt(duration_min, 10) || 30;
  const info = db.prepare(
    'INSERT INTO services (name, description, price, duration_min, active) VALUES (?, ?, ?, ?, 1)'
  ).run(String(name).trim(), description ? String(description) : '', isNaN(priceNum) ? 0 : priceNum, dur);
  res.status(201).json(db.prepare('SELECT * FROM services WHERE id = ?').get(info.lastInsertRowid));
});
app.put('/api/owner/services/:id', requireOwner, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Serviço não encontrado.' });
  const { name, description, price, duration_min, active } = req.body || {};
  const nameVal = name !== undefined ? String(name).trim() : existing.name;
  const descVal = description !== undefined ? String(description) : existing.description;
  const priceNum = price !== undefined ? (isNaN(parseFloat(price)) ? 0 : parseFloat(price)) : existing.price;
  const dur = duration_min !== undefined ? (parseInt(duration_min, 10) || existing.duration_min) : existing.duration_min;
  const act = active !== undefined ? (active ? 1 : 0) : existing.active;
  db.prepare('UPDATE services SET name=?, description=?, price=?, duration_min=?, active=? WHERE id=?')
    .run(nameVal, descVal, priceNum, dur, act, id);
  res.json(db.prepare('SELECT * FROM services WHERE id = ?').get(id));
});
app.delete('/api/owner/services/:id', requireOwner, (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM services WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Horários de atendimento CRUD (responsável)
app.get('/api/owner/slots', requireOwner, (req, res) => {
  res.json(db.prepare('SELECT * FROM time_slots ORDER BY weekday, time').all());
});
app.post('/api/owner/slots', requireOwner, (req, res) => {
  const { weekday, time } = req.body || {};
  const wd = parseInt(weekday, 10);
  if (!time || wd < 0 || wd > 6) return res.status(400).json({ error: 'Dia e horário inválidos.' });
  const exists = db.prepare('SELECT 1 FROM time_slots WHERE weekday = ? AND time = ?').get(wd, time);
  if (exists) return res.status(409).json({ error: 'Este horário já foi cadastrado.' });
  const info = db.prepare('INSERT INTO time_slots (weekday, time) VALUES (?, ?)').run(wd, time);
  res.status(201).json(db.prepare('SELECT * FROM time_slots WHERE id = ?').get(info.lastInsertRowid));
});
app.delete('/api/owner/slots/:id', requireOwner, (req, res) => {
  const id = parseInt(req.params.id, 10);
  db.prepare('DELETE FROM time_slots WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ===== Seed: cria a conta do responsável na primeira execução =====
(function seedOwner() {
  const count = db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'owner'").get().c;
  if (count === 0) {
    const salt = makeSalt();
    const hash = hashPassword('admin123', salt);
    db.prepare(
      "INSERT INTO users (username, password_hash, salt, name, phone, role) VALUES (?, ?, ?, ?, ?, 'owner')"
    ).run('admin', hash, salt, 'Responsável', '', );
    console.log('=====================================================');
    console.log(' Conta do responsável criada:');
    console.log('   Usuário: admin');
    console.log('   Senha:   admin123');
    console.log(' Mude essa senha depois de entrar, se quiser.');
    console.log('=====================================================');
  }
})();

// ===== Roda o servidor =====
app.listen(PORT, () => {
  console.log('Sistema de agendamento rodando em http://localhost:' + PORT);
  console.log('Dados salvos em: ' + DB_FILE);
});
