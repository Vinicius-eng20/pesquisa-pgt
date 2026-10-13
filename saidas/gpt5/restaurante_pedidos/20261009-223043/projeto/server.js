const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const path = require("path");
const db = require("./src/db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  helmet({
    contentSecurityPolicy: false
  })
);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: "."
    }),
    secret: process.env.SESSION_SECRET || "troque-esta-chave-em-producao",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 30,
      httpOnly: true
    }
  })
);

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.error = req.session.error || null;
  res.locals.success = req.session.success || null;
  delete req.session.error;
  delete req.session.success;
  next();
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.session.error = "Entre com sua conta para continuar.";
    return res.redirect("/login");
  }
  next();
}

function requireManager(req, res, next) {
  if (!req.session.user) {
    req.session.error = "Entre com sua conta para continuar.";
    return res.redirect("/login");
  }

  if (req.session.user.role !== "manager") {
    req.session.error = "Acesso permitido apenas ao gerente.";
    return res.redirect("/");
  }

  next();
}

function formatMoney(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

app.locals.formatMoney = formatMoney;

app.get("/", (req, res) => {
  if (req.session.user?.role === "manager") {
    return res.redirect("/gerente");
  }

  const dishes = db.prepare("SELECT * FROM dishes WHERE available = 1 ORDER BY name").all();
  res.render("home", { dishes });
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email || "").trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password || "", user.password_hash)) {
    req.session.error = "Email ou senha incorretos.";
    return res.redirect("/login");
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  req.session.success = `Bem-vindo, ${user.name}!`;
  res.redirect(user.role === "manager" ? "/gerente" : "/");
});

app.get("/cadastro", (req, res) => {
  res.render("register");
});

app.post("/cadastro", (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!name || !email || password.length < 6) {
    req.session.error = "Informe nome, email e uma senha com pelo menos 6 caracteres.";
    return res.redirect("/cadastro");
  }

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);

  if (exists) {
    req.session.error = "Já existe uma conta com este email.";
    return res.redirect("/cadastro");
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')")
    .run(name, email, passwordHash);

  req.session.user = {
    id: result.lastInsertRowid,
    name,
    email,
    role: "customer"
  };

  req.session.success = "Conta criada com sucesso.";
  res.redirect("/");
});

app.post("/sair", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.get("/meus-pedidos", requireLogin, (req, res) => {
  if (req.session.user.role === "manager") {
    return res.redirect("/gerente/pedidos");
  }

  const orders = db
    .prepare(
      `SELECT * FROM orders
       WHERE user_id = ?
       ORDER BY created_at DESC`
    )
    .all(req.session.user.id);

  const itemsByOrder = {};
  const itemStmt = db.prepare(
    `SELECT oi.*, d.name
     FROM order_items oi
     LEFT JOIN dishes d ON d.id = oi.dish_id
     WHERE oi.order_id = ?`
  );

  for (const order of orders) {
    itemsByOrder[order.id] = itemStmt.all(order.id);
  }

  res.render("my-orders", { orders, itemsByOrder });
});

app.post("/pedido", requireLogin, (req, res) => {
  if (req.session.user.role === "manager") {
    req.session.error = "Gerente não faz pedidos como cliente nesta área.";
    return res.redirect("/gerente");
  }

  const quantities = req.body.quantities || {};
  const dishes = db.prepare("SELECT * FROM dishes WHERE available = 1").all();

  const selected = [];

  for (const dish of dishes) {
    const quantity = Number(quantities[dish.id] || 0);
    if (quantity > 0) {
      selected.push({
        dish,
        quantity
      });
    }
  }

  if (selected.length === 0) {
    req.session.error = "Escolha pelo menos um prato.";
    return res.redirect("/");
  }

  const total = selected.reduce((sum, item) => sum + item.dish.price * item.quantity, 0);
  const notes = String(req.body.notes || "").trim();

  const createOrder = db.transaction(() => {
    const result = db
      .prepare(
        `INSERT INTO orders (user_id, status, total, notes, created_at, updated_at)
         VALUES (?, 'Recebido', ?, ?, datetime('now'), datetime('now'))`
      )
      .run(req.session.user.id, total, notes);

    const orderId = result.lastInsertRowid;

    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, dish_id, quantity, unit_price)
       VALUES (?, ?, ?, ?)`
    );

    for (const item of selected) {
      insertItem.run(orderId, item.dish.id, item.quantity, item.dish.price);
    }

    return orderId;
  });

  createOrder();

  req.session.success = "Pedido enviado com sucesso!";
  res.redirect("/meus-pedidos");
});

app.get("/gerente", requireManager, (req, res) => {
  res.redirect("/gerente/cardapio");
});

app.get("/gerente/cardapio", requireManager, (req, res) => {
  const dishes = db.prepare("SELECT * FROM dishes ORDER BY available DESC, name").all();
  res.render("manager-menu", { dishes, editing: null });
});

app.post("/gerente/cardapio", requireManager, (req, res) => {
  const name = String(req.body.name || "").trim();
  const description = String(req.body.description || "").trim();
  const price = Number(req.body.price || 0);
  const available = req.body.available ? 1 : 0;

  if (!name || price <= 0) {
    req.session.error = "Informe nome e preço válido.";
    return res.redirect("/gerente/cardapio");
  }

  db.prepare(
    `INSERT INTO dishes (name, description, price, available, created_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`
  ).run(name, description, price, available);

  req.session.success = "Prato cadastrado.";
  res.redirect("/gerente/cardapio");
});

app.get("/gerente/cardapio/:id/editar", requireManager, (req, res) => {
  const dishes = db.prepare("SELECT * FROM dishes ORDER BY available DESC, name").all();
  const editing = db.prepare("SELECT * FROM dishes WHERE id = ?").get(req.params.id);

  if (!editing) {
    req.session.error = "Prato não encontrado.";
    return res.redirect("/gerente/cardapio");
  }

  res.render("manager-menu", { dishes, editing });
});

app.post("/gerente/cardapio/:id/editar", requireManager, (req, res) => {
  const name = String(req.body.name || "").trim();
  const description = String(req.body.description || "").trim();
  const price = Number(req.body.price || 0);
  const available = req.body.available ? 1 : 0;

  if (!name || price <= 0) {
    req.session.error = "Informe nome e preço válido.";
    return res.redirect(`/gerente/cardapio/${req.params.id}/editar`);
  }

  db.prepare(
    `UPDATE dishes
     SET name = ?, description = ?, price = ?, available = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(name, description, price, available, req.params.id);

  req.session.success = "Prato atualizado.";
  res.redirect("/gerente/cardapio");
});

app.post("/gerente/cardapio/:id/remover", requireManager, (req, res) => {
  const used = db.prepare("SELECT id FROM order_items WHERE dish_id = ? LIMIT 1").get(req.params.id);

  if (used) {
    db.prepare("UPDATE dishes SET available = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
    req.session.success = "Prato já usado em pedido. Ele foi marcado como indisponível.";
  } else {
    db.prepare("DELETE FROM dishes WHERE id = ?").run(req.params.id);
    req.session.success = "Prato removido.";
  }

  res.redirect("/gerente/cardapio");
});

app.get("/gerente/pedidos", requireManager, (req, res) => {
  const orders = db
    .prepare(
      `SELECT orders.*, users.name AS customer_name, users.email AS customer_email
       FROM orders
       JOIN users ON users.id = orders.user_id
       ORDER BY orders.created_at DESC`
    )
    .all();

  const itemsByOrder = {};
  const itemStmt = db.prepare(
    `SELECT oi.*, d.name
     FROM order_items oi
     LEFT JOIN dishes d ON d.id = oi.dish_id
     WHERE oi.order_id = ?`
  );

  for (const order of orders) {
    itemsByOrder[order.id] = itemStmt.all(order.id);
  }

  res.render("manager-orders", {
    orders,
    itemsByOrder,
    statuses: ["Recebido", "Em preparo", "Saiu para entrega", "Pronto para retirada", "Finalizado", "Cancelado"]
  });
});

app.post("/gerente/pedidos/:id/status", requireManager, (req, res) => {
  const allowed = ["Recebido", "Em preparo", "Saiu para entrega", "Pronto para retirada", "Finalizado", "Cancelado"];
  const status = String(req.body.status || "");

  if (!allowed.includes(status)) {
    req.session.error = "Situação inválida.";
    return res.redirect("/gerente/pedidos");
  }

  db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, req.params.id);

  req.session.success = "Situação do pedido atualizada.";
  res.redirect("/gerente/pedidos");
});

app.use((req, res) => {
  res.status(404).render("404");
});

app.listen(PORT, () => {
  console.log(`Sistema rodando em http://localhost:${PORT}`);
});
