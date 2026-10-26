const path = require("path");
const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const SQLiteStore = require("connect-sqlite3")(session);
const { db, init, seed } = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3000);

// Segurança básica
app.use(helmet());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

// Sessões (login) persistidas no SQLite (não somem ao reiniciar)
app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: path.join(__dirname, "..", "data"),
    }),
    secret: process.env.SESSION_SECRET || "troque-esta-chave-em-producao",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // se for HTTPS, troque para true
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias
    },
  })
);

// Arquivos do front-end
app.use(express.static(path.join(__dirname, "..", "public")));

// Inicializa banco e dados básicos
init();
seed();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Não autenticado." });
  next();
}

function requireManager(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: "Não autenticado." });
  if (req.session.user.role !== "manager") return res.status(403).json({ error: "Acesso negado (somente gerente)." });
  next();
}

/**
 * AUTH
 */
app.post("/api/register", (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: "Preencha nome, e-mail e senha." });

  const bcrypt = require("bcryptjs");
  const hash = bcrypt.hashSync(String(password), 10);

  try {
    const stmt = db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'customer')");
    const info = stmt.run(String(name), String(email).toLowerCase(), hash);

    req.session.user = { id: info.lastInsertRowid, name: String(name), email: String(email).toLowerCase(), role: "customer" };
    res.json({ ok: true });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return res.status(409).json({ error: "Este e-mail já está cadastrado." });
    res.status(500).json({ error: "Erro ao cadastrar." });
  }
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Preencha e-mail e senha." });

  const bcrypt = require("bcryptjs");
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(String(email).toLowerCase());
  if (!user) return res.status(401).json({ error: "E-mail ou senha inválidos." });

  const ok = bcrypt.compareSync(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: "E-mail ou senha inválidos." });

  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

/**
 * MENU (cliente e gerente leem)
 */
app.get("/api/menu", (req, res) => {
  const items = db.prepare("SELECT id, name, description, price_cents, is_active FROM menu_items ORDER BY name").all();
  res.json({ items });
});

/**
 * MENU (somente gerente altera)
 */
app.post("/api/manager/menu", requireManager, (req, res) => {
  const { name, description, price } = req.body || {};
  if (!name || price === undefined) return res.status(400).json({ error: "Informe nome e preço." });

  const price_cents = Math.round(Number(price) * 100);
  if (!Number.isFinite(price_cents) || price_cents < 0) return res.status(400).json({ error: "Preço inválido." });

  const stmt = db.prepare("INSERT INTO menu_items (name, description, price_cents, is_active) VALUES (?, ?, ?, 1)");
  const info = stmt.run(String(name), String(description || ""), price_cents);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put("/api/manager/menu/:id", requireManager, (req, res) => {
  const id = Number(req.params.id);
  const { name, description, price, is_active } = req.body || {};
  if (!id) return res.status(400).json({ error: "ID inválido." });

  const existing = db.prepare("SELECT * FROM menu_items WHERE id = ?").get(id);
  if (!existing) return res.status(404).json({ error: "Item não encontrado." });

  const price_cents = price === undefined ? existing.price_cents : Math.round(Number(price) * 100);
  if (!Number.isFinite(price_cents) || price_cents < 0) return res.status(400).json({ error: "Preço inválido." });

  db.prepare("UPDATE menu_items SET name = ?, description = ?, price_cents = ?, is_active = ? WHERE id = ?")
    .run(
      name === undefined ? existing.name : String(name),
      description === undefined ? existing.description : String(description || ""),
      price_cents,
      is_active === undefined ? existing.is_active : (is_active ? 1 : 0),
      id
    );

  res.json({ ok: true });
});

app.delete("/api/manager/menu/:id", requireManager, (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: "ID inválido." });

  db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
  res.json({ ok: true });
});

/**
 * ORDERS (cliente cria; cliente vê os dele; gerente vê todos e muda status)
 */
app.post("/api/orders", requireAuth, (req, res) => {
  const user = req.session.user;
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: "Envie itens do pedido." });

  // valida itens e calcula total
  const getItem = db.prepare("SELECT id, name, price_cents, is_active FROM menu_items WHERE id = ?");
  let total = 0;

  const normalized = items.map((it) => {
    const menuId = Number(it.menu_item_id);
    const qty = Number(it.quantity);
    if (!menuId || !qty || qty <= 0) throw new Error("Item inválido no pedido.");
    const menu = getItem.get(menuId);
    if (!menu || !menu.is_active) throw new Error("Item indisponível no cardápio.");
    total += menu.price_cents * qty;
    return { menu_item_id: menuId, quantity: qty, unit_price_cents: menu.price_cents };
  });

  const tx = db.transaction(() => {
    const orderStmt = db.prepare("INSERT INTO orders (user_id, status, total_cents) VALUES (?, 'RECEBIDO', ?)");
    const orderInfo = orderStmt.run(user.id, total);

    const orderItemStmt = db.prepare(
      "INSERT INTO order_items (order_id, menu_item_id, quantity, unit_price_cents) VALUES (?, ?, ?, ?)"
    );

    for (const it of normalized) {
      orderItemStmt.run(orderInfo.lastInsertRowid, it.menu_item_id, it.quantity, it.unit_price_cents);
    }
    return orderInfo.lastInsertRowid;
  });

  try {
    const orderId = tx();
    res.json({ ok: true, order_id: orderId, total_cents: total });
  } catch (e) {
    res.status(400).json({ error: e.message || "Não foi possível criar o pedido." });
  }
});

app.get("/api/my-orders", requireAuth, (req, res) => {
  const user = req.session.user;

  const orders = db
    .prepare("SELECT id, status, total_cents, created_at FROM orders WHERE user_id = ? ORDER BY id DESC")
    .all(user.id);

  const itemsStmt = db.prepare(
    `SELECT oi.menu_item_id, mi.name, oi.quantity, oi.unit_price_cents
     FROM order_items oi
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE oi.order_id = ?`
  );

  const withItems = orders.map((o) => ({
    ...o,
    items: itemsStmt.all(o.id),
  }));

  res.json({ orders: withItems });
});

app.get("/api/manager/orders", requireManager, (req, res) => {
  const orders = db
    .prepare(
      `SELECT o.id, o.status, o.total_cents, o.created_at, u.name AS customer_name, u.email AS customer_email
       FROM orders o
       JOIN users u ON u.id = o.user_id
       ORDER BY o.id DESC`
    )
    .all();

  const itemsStmt = db.prepare(
    `SELECT oi.menu_item_id, mi.name, oi.quantity, oi.unit_price_cents
     FROM order_items oi
     JOIN menu_items mi ON mi.id = oi.menu_item_id
     WHERE oi.order_id = ?`
  );

  const withItems = orders.map((o) => ({
    ...o,
    items: itemsStmt.all(o.id),
  }));

  res.json({ orders: withItems });
});

app.put("/api/manager/orders/:id/status", requireManager, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  const allowed = new Set(["RECEBIDO", "EM_PREPARO", "PRONTO", "ENTREGUE", "CANCELADO"]);

  if (!id) return res.status(400).json({ error: "ID inválido." });
  if (!allowed.has(String(status))) return res.status(400).json({ error: "Status inválido." });

  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(String(status), id);
  res.json({ ok: true });
});

// Fallback: sempre devolve a página principal
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
