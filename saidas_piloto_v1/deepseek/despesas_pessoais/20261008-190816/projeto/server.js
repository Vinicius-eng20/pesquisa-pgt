const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// ---------- Banco de dados em arquivo ----------
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadDB() {
  ensureDataDir();
  if (!fs.existsSync(DB_FILE)) {
    return { users: [], categories: [], expenses: [], nextUserId: 1, nextCategoryId: 1, nextExpenseId: 1 };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch (e) {
    return { users: [], categories: [], expenses: [], nextUserId: 1, nextCategoryId: 1, nextExpenseId: 1 };
  }
}

function saveDB(db) {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function seed() {
  const db = loadDB();
  let changed = false;

  if (db.categories.length === 0) {
    const defaultCats = ['Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Saúde', 'Outros'];
    for (const name of defaultCats) {
      db.categories.push({ id: db.nextCategoryId++, name, active: true });
    }
    changed = true;
  }

  if (!db.users.find(u => u.role === 'admin')) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.users.push({
      id: db.nextUserId++,
      name: 'Administrador',
      email: 'admin@admin.com',
      password: hash,
      role: 'admin',
      active: true,
      createdAt: new Date().toISOString()
    });
    changed = true;
  }

  if (changed) saveDB(db);
}

seed();

// ---------- Middlewares ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'troque-esta-chave-secreta-em-producao-123',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers de autenticação ----------
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Não autenticado' });
  const db = loadDB();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || !user.active) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Conta inativa ou inexistente' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito ao administrador' });
    next();
  });
}

// ---------- API de autenticação ----------
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Preencha nome, e-mail e senha' });
  if (password.length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres' });

  const db = loadDB();
  const exists = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (exists) return res.status(400).json({ error: 'Já existe uma conta com este e-mail' });

  const hash = bcrypt.hashSync(password, 10);
  const user = {
    id: db.nextUserId++,
    name,
    email: email.toLowerCase(),
    password: hash,
    role: 'user',
    active: true,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  saveDB(db);

  req.session.userId = user.id;
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha' });

  const db = loadDB();
  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) return res.status(400).json({ error: 'E-mail ou senha incorretos' });
  if (!user.active) return res.status(403).json({ error: 'Esta conta está desativada' });
  if (!bcrypt.compareSync(password, user.password)) return res.status(400).json({ error: 'E-mail ou senha incorretos' });

  req.session.userId = user.id;
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, name: req.user.name, email: req.user.email, role: req.user.role });
});

// ---------- API de categorias ----------
app.get('/api/categories', requireAuth, (req, res) => {
  const db = loadDB();
  const list = db.categories.filter(c => c.active || req.user.role === 'admin');
  res.json(list);
});

app.post('/api/categories', requireAdmin, (req, res) => {
  const { name } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Informe o nome da categoria' });
  const db = loadDB();
  const exists = db.categories.find(c => c.name.toLowerCase() === name.trim().toLowerCase());
  if (exists) return res.status(400).json({ error: 'Já existe uma categoria com este nome' });
  const cat = { id: db.nextCategoryId++, name: name.trim(), active: true };
  db.categories.push(cat);
  saveDB(db);
  res.json(cat);
});

app.patch('/api/categories/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = loadDB();
  const cat = db.categories.find(c => c.id === id);
  if (!cat) return res.status(404).json({ error: 'Categoria não encontrada' });
  if (typeof req.body.active === 'boolean') cat.active = req.body.active;
  if (typeof req.body.name === 'string' && req.body.name.trim()) cat.name = req.body.name.trim();
  saveDB(db);
  res.json(cat);
});

// ---------- API de despesas ----------
app.get('/api/expenses', requireAuth, (req, res) => {
  const db = loadDB();
  const list = db.expenses
    .filter(e => e.userId === req.user.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  res.json(list);
});

app.post('/api/expenses', requireAuth, (req, res) => {
  const { amount, description, categoryId, date } = req.body || {};
  const value = parseFloat(amount);
  if (!value || value <= 0) return res.status(400).json({ error: 'Informe um valor maior que zero' });
  if (!date) return res.status(400).json({ error: 'Informe a data do gasto' });

  const db = loadDB();
  const cat = db.categories.find(c => c.id === parseInt(categoryId, 10));
  if (!cat || !cat.active) return res.status(400).json({ error: 'Categoria inválida' });

  const exp = {
    id: db.nextExpenseId++,
    userId: req.user.id,
    amount: Math.round(value * 100) / 100,
    description: (description || '').trim(),
    categoryId: cat.id,
    date,
    createdAt: new Date().toISOString()
  };
  db.expenses.push(exp);
  saveDB(db);
  res.json(exp);
});

app.delete('/api/expenses/:id', requireAuth, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = loadDB();
  const idx = db.expenses.findIndex(e => e.id === id && e.userId === req.user.id);
  if (idx === -1) return res.status(404).json({ error: 'Gasto não encontrado' });
  db.expenses.splice(idx, 1);
  saveDB(db);
  res.json({ ok: true });
});

app.get('/api/summary', requireAuth, (req, res) => {
  const db = loadDB();
  const mine = db.expenses.filter(e => e.userId === req.user.id);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let totalMonth = 0;
  const byCategory = {};
  for (const e of mine) {
    if ((e.date || '').startsWith(monthKey)) totalMonth += e.amount;
    byCategory[e.categoryId] = (byCategory[e.categoryId] || 0) + e.amount;
  }
  const categories = db.categories.map(c => ({
    id: c.id,
    name: c.name,
    total: Math.round((byCategory[c.id] || 0) * 100) / 100
  }));

  res.json({
    totalMonth: Math.round(totalMonth * 100) / 100,
    totalAll: Math.round(mine.reduce((s, e) => s + e.amount, 0) * 100) / 100,
    count: mine.length,
    byCategory: categories
  });
});

// ---------- API de administração ----------
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const db = loadDB();
  const users = db.users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    active: u.active,
    createdAt: u.createdAt
  }));
  res.json(users);
});

app.patch('/api/admin/users/:id', requireAdmin, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const db = loadDB();
  const u = db.users.find(x => x.id === id);
  if (!u) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (u.id === req.user.id && req.body.active === false) {
    return res.status(400).json({ error: 'Você não pode desativar sua própria conta' });
  }
  if (typeof req.body.active === 'boolean') u.active = req.body.active;
  saveDB(db);
  res.json({ id: u.id, name: u.name, email: u.email, role: u.role, active: u.active });
});

app.get('/api/admin/summary', requireAdmin, (req, res) => {
  const db = loadDB();
  const totalAll = db.expenses.reduce((s, e) => s + e.amount, 0);
  const perUser = db.users.map(u => {
    const total = db.expenses.filter(e => e.userId === u.id).reduce((s, e) => s + e.amount, 0);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      active: u.active,
      total: Math.round(total * 100) / 100
    };
  });
  res.json({
    totalAll: Math.round(totalAll * 100) / 100,
    totalUsers: db.users.length,
    totalExpenses: db.expenses.length,
    perUser
  });
});

// ---------- Rotas de páginas ----------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
