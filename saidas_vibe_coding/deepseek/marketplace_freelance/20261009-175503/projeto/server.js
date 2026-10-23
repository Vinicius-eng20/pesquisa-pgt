const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Persistência em arquivo ----------
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    const fresh = { users: [], services: [], contracts: [], sessions: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2));
    return fresh;
  }
  try {
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      users: parsed.users || [],
      services: parsed.services || [],
      contracts: parsed.contracts || [],
    };
  } catch (e) {
    return { users: [], services: [], contracts: [] };
  }
}

let db = loadDB();

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function uid() {
  return crypto.randomBytes(12).toString('hex');
}

// Admin inicial
(function ensureAdmin() {
  const admin = db.users.find(u => u.role === 'admin');
  if (!admin) {
    db.users.push({
      id: uid(),
      name: 'Administrador',
      email: 'admin@freelahub.com',
      password: bcrypt.hashSync('admin123', 10),
      role: 'admin',
      suspended: false,
      createdAt: new Date().toISOString(),
    });
    saveDB();
    console.log('Conta admin criada: admin@freelahub.com / admin123');
  }
})();

// ---------- Middlewares ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'freelahub-secret-key-mude-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 30 },
}));
app.use(express.static(path.join(__dirname, 'public')));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Não autenticado' });
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.status(401).json({ error: 'Sessão inválida' });
  if (user.suspended) return res.status(403).json({ error: 'Conta suspensa' });
  req.user = user;
  next();
}

function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
    next();
  });
}

function publicUser(u) {
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role, suspended: u.suspended };
}

// ---------- Auth ----------
app.post('/api/register', (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Preencha todos os campos' });
  if (password.length < 4) return res.status(400).json({ error: 'Senha muito curta (mín. 4 caracteres)' });
  const cleanEmail = String(email).trim().toLowerCase();
  if (db.users.find(u => u.email === cleanEmail)) {
    return res.status(400).json({ error: 'E-mail já cadastrado' });
  }
  const finalRole = (role === 'client' || role === 'freelancer') ? role : 'client';
  const user = {
    id: uid(),
    name: String(name).trim(),
    email: cleanEmail,
    password: bcrypt.hashSync(password, 10),
    role: finalRole,
    suspended: false,
    createdAt: new Date().toISOString(),
  };
  db.users.push(user);
  saveDB();
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Preencha todos os campos' });
  const cleanEmail = String(email).trim().toLowerCase();
  const user = db.users.find(u => u.email === cleanEmail);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(400).json({ error: 'E-mail ou senha incorretos' });
  }
  if (user.suspended) return res.status(403).json({ error: 'Sua conta está suspensa' });
  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user) return res.json({ user: null });
  res.json({ user: publicUser(user) });
});

// ---------- Serviços ----------
app.get('/api/services', requireAuth, (req, res) => {
  const list = db.services.map(s => {
    const owner = db.users.find(u => u.id === s.ownerId);
    return { ...s, owner: publicUser(owner) };
  });
  res.json({ services: list });
});

app.get('/api/services/mine', requireAuth, (req, res) => {
  const list = db.services.filter(s => s.ownerId === req.user.id).map(s => ({
    ...s,
    owner: publicUser(req.user),
  }));
  res.json({ services: list });
});

app.post('/api/services', requireAuth, (req, res) => {
  let { title, description, category, price } = req.body || {};
  if (!title || !description) return res.status(400).json({ error: 'Título e descrição obrigatórios' });
  const service = {
    id: uid(),
    ownerId: req.user.id,
    title: String(title).trim(),
    description: String(description).trim(),
    category: category ? String(category).trim() : 'Geral',
    price: Number(price) || 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.services.push(service);
  saveDB();
  res.json({ service });
});

app.delete('/api/services/:id', requireAuth, (req, res) => {
  const svc = db.services.find(s => s.id === req.params.id);
  if (!svc) return res.status(404).json({ error: 'Serviço não encontrado' });
  if (svc.ownerId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  db.services = db.services.filter(s => s.id !== req.params.id);
  saveDB();
  res.json({ ok: true });
});

// Aprovar / rejeitar (admin)
app.post('/api/services/:id/approve', requireAdmin, (req, res) => {
  const svc = db.services.find(s => s.id === req.params.id);
  if (!svc) return res.status(404).json({ error: 'Serviço não encontrado' });
  svc.status = 'approved';
  saveDB();
  res.json({ service: svc });
});

app.post('/api/services/:id/reject', requireAdmin, (req, res) => {
  const svc = db.services.find(s => s.id === req.params.id);
  if (!svc) return res.status(404).json({ error: 'Serviço não encontrado' });
  svc.status = 'rejected';
  saveDB();
  res.json({ service: svc });
});

// ---------- Contratos ----------
app.post('/api/contracts', requireAuth, (req, res) => {
  const { serviceId, message } = req.body || {};
  const svc = db.services.find(s => s.id === serviceId);
  if (!svc) return res.status(404).json({ error: 'Serviço não encontrado' });
  if (svc.status !== 'approved') return res.status(400).json({ error: 'Serviço ainda não aprovado' });
  if (svc.ownerId === req.user.id) return res.status(400).json({ error: 'Você não pode contratar seu próprio serviço' });

  const contract = {
    id: uid(),
    serviceId: svc.id,
    serviceTitle: svc.title,
    price: svc.price,
    providerId: svc.ownerId,
    clientId: req.user.id,
    message: message ? String(message).trim() : '',
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  db.contracts.push(contract);
  saveDB();
  res.json({ contract });
});

app.get('/api/contracts', requireAuth, (req, res) => {
  const list = db.contracts
    .filter(c => c.clientId === req.user.id || c.providerId === req.user.id)
    .map(c => {
      const provider = db.users.find(u => u.id === c.providerId);
      const client = db.users.find(u => u.id === c.clientId);
      return { ...c, provider: publicUser(provider), client: publicUser(client) };
    });
  res.json({ contracts: list });
});

app.post('/api/contracts/:id/status', requireAuth, (req, res) => {
  const { status } = req.body || {};
  const c = db.contracts.find(x => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Contrato não encontrado' });
  if (c.clientId !== req.user.id && c.providerId !== req.user.id) {
    return res.status(403).json({ error: 'Sem permissão' });
  }
  if (!['accepted', 'declined', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }
  c.status = status;
  saveDB();
  res.json({ contract: c });
});

// ---------- Admin ----------
app.get('/api/admin/users', requireAdmin, (req, res) => {
  res.json({ users: db.users.map(publicUser) });
});

app.post('/api/admin/users/:id/suspend', requireAdmin, (req, res) => {
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuário não encontrado' });
  if (u.role === 'admin') return res.status(400).json({ error: 'Não é possível suspender admin' });
  u.suspended = !u.suspended;
  saveDB();
  res.json({ user: publicUser(u) });
});

app.get('/api/admin/services', requireAdmin, (req, res) => {
  const list = db.services.map(s => ({
    ...s,
    owner: publicUser(db.users.find(u => u.id === s.ownerId)),
  }));
  res.json({ services: list });
});

app.get('/api/admin/contracts', requireAdmin, (req, res) => {
  const list = db.contracts.map(c => ({
    ...c,
    provider: publicUser(db.users.find(u => u.id === c.providerId)),
    client: publicUser(db.users.find(u => u.id === c.clientId)),
  }));
  res.json({ contracts: list });
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`FreelaHub rodando em http://localhost:${PORT}`);
});
