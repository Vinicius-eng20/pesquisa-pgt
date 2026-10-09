const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'marketplace.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  suspended INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price REAL NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_id INTEGER NOT NULL,
  client_id INTEGER NOT NULL,
  provider_id INTEGER NOT NULL,
  price REAL NOT NULL,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (service_id) REFERENCES services(id),
  FOREIGN KEY (client_id) REFERENCES users(id),
  FOREIGN KEY (provider_id) REFERENCES users(id)
);
`);

const adminEmail = 'admin@marketplace.com';
const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get(adminEmail);
if (!existingAdmin) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, email, password, is_admin) VALUES (?, ?, ?, 1)').run('Administrador', adminEmail, hash);
  console.log('Admin criado: admin@marketplace.com / admin123');
}

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
  secret: 'marketplace-secret-key-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Faça login primeiro' });
  const user = db.prepare('SELECT id, name, email, is_admin, suspended FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Sessão inválida' });
  }
  if (user.suspended && !user.is_admin) {
    return res.status(403).json({ error: 'Sua conta está suspensa' });
  }
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) return res.status(403).json({ error: 'Acesso restrito' });
  next();
}

// ---------- Auth ----------
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Preencha todos os campos' });
  if (password.length < 6) return res.status(400).json({ error: 'Senha mínima de 6 caracteres' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return res.status(400).json({ error: 'E-mail já cadastrado' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)').run(name, email.toLowerCase(), hash);
  req.session.userId = info.lastInsertRowid;
  res.json({ id: info.lastInsertRowid, name, email });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'E-mail ou senha inválidos' });
  }
  if (user.suspended) return res.status(403).json({ error: 'Sua conta está suspensa' });
  req.session.userId = user.id;
  res.json({ id: user.id, name: user.name, email: user.email, is_admin: !!user.is_admin });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare('SELECT id, name, email, is_admin, suspended FROM users WHERE id = ?').get(req.session.userId);
  if (!user || user.suspended) {
    if (user && user.suspended) req.session.destroy(() => {});
    return res.json({ user: null });
  }
  res.json({ user: { ...user, is_admin: !!user.is_admin } });
});

// ---------- Services ----------
app.get('/api/services', (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, u.name AS provider_name
    FROM services s JOIN users u ON u.id = s.user_id
    WHERE s.status = 'approved' AND u.suspended = 0
    ORDER BY s.created_at DESC
  `).all();
  res.json(rows);
});

app.get('/api/services/mine', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, u.name AS provider_name
    FROM services s JOIN users u ON u.id = s.user_id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
  `).all(req.user.id);
  res.json(rows);
});

app.post('/api/services', requireAuth, (req, res) => {
  const { title, description, category, price } = req.body || {};
  if (!title || !description || !category || price == null) {
    return res.status(400).json({ error: 'Preencha todos os campos' });
  }
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return res.status(400).json({ error: 'Preço inválido' });
  const info = db.prepare(`
    INSERT INTO services (user_id, title, description, category, price, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(req.user.id, title.trim(), description.trim(), category.trim(), p);
  res.json({ id: info.lastInsertRowid });
});

app.delete('/api/services/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
  if (service.user_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  const hasContracts = db.prepare('SELECT COUNT(*) AS c FROM contracts WHERE service_id = ?').get(id).c;
  if (hasContracts > 0) return res.status(400).json({ error: 'Existem contratos vinculados a este serviço' });
  db.prepare('DELETE FROM services WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ---------- Contracts ----------
app.post('/api/contracts', requireAuth, (req, res) => {
  const { service_id, notes } = req.body || {};
  const id = Number(service_id);
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
  if (service.status !== 'approved') return res.status(400).json({ error: 'Serviço indisponível para contratação' });
  if (service.user_id === req.user.id) return res.status(400).json({ error: 'Você não pode contratar seu próprio serviço' });
  const provider = db.prepare('SELECT suspended FROM users WHERE id = ?').get(service.user_id);
  if (provider && provider.suspended) return res.status(400).json({ error: 'Prestador suspenso' });
  const info = db.prepare(`
    INSERT INTO contracts (service_id, client_id, provider_id, price, notes, status)
    VALUES (?, ?, ?, ?, ?, 'active')
  `).run(id, req.user.id, service.user_id, service.price, notes || '');
  res.json({ id: info.lastInsertRowid });
});

app.get('/api/contracts/mine', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, s.title AS service_title, s.category AS service_category,
           cl.name AS client_name, pr.name AS provider_name
    FROM contracts c
    JOIN services s ON s.id = c.service_id
    JOIN users cl ON cl.id = c.client_id
    JOIN users pr ON pr.id = c.provider_id
    WHERE c.client_id = ? OR c.provider_id = ?
    ORDER BY c.created_at DESC
  `).all(req.user.id, req.user.id);
  res.json(rows);
});

app.patch('/api/contracts/:id/status', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!['active', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }
  const c = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
  if (!c) return res.status(404).json({ error: 'Contrato não encontrado' });
  if (c.client_id !== req.user.id && c.provider_id !== req.user.id && !req.user.is_admin) {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  db.prepare('UPDATE contracts SET status = ? WHERE id = ?').run(status, id);
  res.json({ ok: true });
});

// ---------- Admin ----------
app.get('/api/admin/services', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT s.*, u.name AS provider_name, u.email AS provider_email,
      (SELECT COUNT(*) FROM contracts c WHERE c.service_id = s.id) AS contract_count
    FROM services s JOIN users u ON u.id = s.user_id
    ORDER BY s.created_at DESC
  `).all();
  res.json(rows);
});

app.patch('/api/admin/services/:id/status', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }
  const s = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  if (!s) return res.status(404).json({ error: 'Serviço não encontrado' });
  db.prepare('UPDATE services SET status = ? WHERE id = ?').run(status, id);
  res.json({ ok: true });
});

app.delete('/api/admin/services/:id', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const s = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  if (!s) return res.status(404).json({ error: 'Serviço não encontrado' });
  const contracts = db.prepare('SELECT COUNT(*) AS c FROM contracts WHERE service_id = ?').get(id).c;
  if (contracts > 0) {
    // remove contratos também
    db.prepare('DELETE FROM contracts WHERE service_id = ?').run(id);
  }
  db.prepare('DELETE FROM services WHERE id = ?').run(id);
  res.json({ ok: true });
});

app.get('/api/admin/users', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT id, name, email, is_admin, suspended, created_at FROM users ORDER BY created_at DESC
  `).all();
  res.json(rows);
});

app.patch('/api/admin/users/:id/suspend', requireAuth, requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { suspended } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!u) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (u.is_admin) return res.status(400).json({ error: 'Não é possível suspender administrador' });
  db.prepare('UPDATE users SET suspended = ? WHERE id = ?').run(suspended ? 1 : 0, id);
  res.json({ ok: true });
});

app.get('/api/admin/contracts', requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT c.*, s.title AS service_title,
      cl.name AS client_name, cl.email AS client_email,
      pr.name AS provider_name, pr.email AS provider_email
    FROM contracts c
    JOIN services s ON s.id = c.service_id
    JOIN users cl ON cl.id = c.client_id
    JOIN users pr ON pr.id = c.provider_id
    ORDER BY c.created_at DESC
  `).all();
  res.json(rows);
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
