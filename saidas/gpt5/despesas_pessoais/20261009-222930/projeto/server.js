const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const path = require("path");
const db = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: new SQLiteStore({
      db: "sessions.sqlite",
      dir: "."
    }),
    secret: process.env.SESSION_SECRET || "troque-esta-chave-secreta-em-producao",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: "Você precisa entrar no sistema." });
  }

  const user = db
    .prepare("SELECT id, name, email, role, active FROM users WHERE id = ?")
    .get(req.session.userId);

  if (!user || !user.active) {
    req.session.destroy(() => {});
    return res.status(403).json({ error: "Sua conta está desativada." });
  }

  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireLogin(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Acesso permitido apenas para administrador." });
    }
    next();
  });
}

function centsFromValue(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) {
    return null;
  }
  return Math.round(number * 100);
}

function formatExpense(row) {
  return {
    id: row.id,
    description: row.description,
    amount: row.amount / 100,
    expense_date: row.expense_date,
    category_id: row.category_id,
    category_name: row.category_name,
    created_at: row.created_at
  };
}

app.get("/", (req, res) => {
  if (req.session.userId) {
    const user = db.prepare("SELECT role FROM users WHERE id = ? AND active = 1").get(req.session.userId);
    if (user?.role === "admin") {
      return res.redirect("/admin.html");
    }
    return res.redirect("/dashboard.html");
  }
  res.redirect("/login.html");
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
    return res.status(400).json({ error: "Este e-mail já está cadastrado." });
  }

  const passwordHash = bcrypt.hashSync(password, 10);

  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, active)
    VALUES (?, ?, ?, 'user', 1)
  `).run(name, email, passwordHash);

  req.session.userId = result.lastInsertRowid;

  res.json({ ok: true });
});

app.post("/api/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(400).json({ error: "E-mail ou senha inválidos." });
  }

  if (!user.active) {
    return res.status(403).json({ error: "Sua conta está desativada." });
  }

  req.session.userId = user.id;

  res.json({
    ok: true,
    role: user.role
  });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get("/api/me", requireLogin, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/categories", requireLogin, (req, res) => {
  const categories = db
    .prepare("SELECT id, name, active FROM categories WHERE active = 1 ORDER BY name")
    .all();

  res.json({ categories });
});

app.get("/api/expenses", requireLogin, (req, res) => {
  const month = String(req.query.month || "").trim();

  let start;
  let end;

  if (/^\d{4}-\d{2}$/.test(month)) {
    start = `${month}-01`;
    const [year, monthNumber] = month.split("-").map(Number);
    end = new Date(year, monthNumber, 1).toISOString().slice(0, 10);
  } else {
    const now = new Date();
    const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
    start = `${now.getFullYear()}-${currentMonth}-01`;
    end = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);
  }

  const rows = db.prepare(`
    SELECT e.*, c.name AS category_name
    FROM expenses e
    JOIN categories c ON c.id = e.category_id
    WHERE e.user_id = ?
      AND e.expense_date >= ?
      AND e.expense_date < ?
    ORDER BY e.expense_date DESC, e.id DESC
  `).all(req.user.id, start, end);

  const totalCents = rows.reduce((sum, row) => sum + row.amount, 0);

  res.json({
    expenses: rows.map(formatExpense),
    total: totalCents / 100
  });
});

app.post("/api/expenses", requireLogin, (req, res) => {
  const description = String(req.body.description || "").trim();
  const amountCents = centsFromValue(req.body.amount);
  const categoryId = Number(req.body.category_id);
  const expenseDate = String(req.body.expense_date || "").trim();

  if (!description || !amountCents || !categoryId || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
    return res.status(400).json({ error: "Preencha descrição, valor, categoria e data." });
  }

  const category = db.prepare("SELECT id FROM categories WHERE id = ? AND active = 1").get(categoryId);
  if (!category) {
    return res.status(400).json({ error: "Categoria inválida ou desativada." });
  }

  db.prepare(`
    INSERT INTO expenses (user_id, category_id, description, amount, expense_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(req.user.id, categoryId, description, amountCents, expenseDate);

  res.json({ ok: true });
});

app.delete("/api/expenses/:id", requireLogin, (req, res) => {
  const id = Number(req.params.id);

  const result = db
    .prepare("DELETE FROM expenses WHERE id = ? AND user_id = ?")
    .run(id, req.user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: "Despesa não encontrada." });
  }

  res.json({ ok: true });
});

app.get("/api/admin/summary", requireAdmin, (req, res) => {
  const totalUsers = db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'user'").get().total;
  const activeUsers = db.prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'user' AND active = 1").get().total;
  const totalExpenses = db.prepare("SELECT COALESCE(SUM(amount), 0) AS total FROM expenses").get().total;
  const expenseCount = db.prepare("SELECT COUNT(*) AS total FROM expenses").get().total;

  res.json({
    totalUsers,
    activeUsers,
    inactiveUsers: totalUsers - activeUsers,
    totalExpenses: totalExpenses / 100,
    expenseCount
  });
});

app.get("/api/admin/users", requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.active,
      u.created_at,
      COALESCE(SUM(e.amount), 0) / 100.0 AS total_spent
    FROM users u
    LEFT JOIN expenses e ON e.user_id = u.id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `).all();

  res.json({ users });
});

app.patch("/api/admin/users/:id/active", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const active = req.body.active ? 1 : 0;

  const target = db.prepare("SELECT id, role FROM users WHERE id = ?").get(id);

  if (!target) {
    return res.status(404).json({ error: "Usuário não encontrado." });
  }

  if (target.role === "admin" && active === 0) {
    return res.status(400).json({ error: "Não é permitido desativar um administrador." });
  }

  db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active, id);

  res.json({ ok: true });
});

app.get("/api/admin/categories", requireAdmin, (req, res) => {
  const categories = db.prepare(`
    SELECT
      c.id,
      c.name,
      c.active,
      c.created_at,
      COUNT(e.id) AS expense_count,
      COALESCE(SUM(e.amount), 0) / 100.0 AS total_spent
    FROM categories c
    LEFT JOIN expenses e ON e.category_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `).all();

  res.json({ categories });
});

app.post("/api/admin/categories", requireAdmin, (req, res) => {
  const name = String(req.body.name || "").trim();

  if (!name) {
    return res.status(400).json({ error: "Informe o nome da categoria." });
  }

  const exists = db.prepare("SELECT id FROM categories WHERE lower(name) = lower(?)").get(name);

  if (exists) {
    return res.status(400).json({ error: "Essa categoria já existe." });
  }

  db.prepare("INSERT INTO categories (name, active) VALUES (?, 1)").run(name);

  res.json({ ok: true });
});

app.patch("/api/admin/categories/:id/active", requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const active = req.body.active ? 1 : 0;

  const category = db.prepare("SELECT id FROM categories WHERE id = ?").get(id);

  if (!category) {
    return res.status(404).json({ error: "Categoria não encontrada." });
  }

  db.prepare("UPDATE categories SET active = ? WHERE id = ?").run(active, id);

  res.json({ ok: true });
});

app.use((req, res) => {
  res.status(404).json({ error: "Página ou recurso não encontrado." });
});

app.listen(PORT, () => {
  console.log(`Site rodando em http://localhost:${PORT}`);
});
