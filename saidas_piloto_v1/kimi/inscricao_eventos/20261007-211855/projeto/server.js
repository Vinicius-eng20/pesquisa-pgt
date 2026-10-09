const path = require('path');
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const SqliteStore = require('better-sqlite3-session-store')(session);

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Banco de dados (arquivo database.sqlite, criado automaticamente) ----------
const db = new Database(path.join(__dirname, 'database.sqlite'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'participant' CHECK (role IN ('participant','organizer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  event_date TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','cancelled')),
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','cancelled')),
  attended INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, event_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);
`);

// Cria o organizador padrão na primeira execução
const organizerEmail = 'admin@eventos.com';
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(organizerEmail);
if (!existingAdmin) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('Organizador', organizerEmail, hash, 'organizer');
  console.log('Conta do organizador criada: admin@eventos.com / admin123');
}

// ---------- Sessões (também salvas no banco, persistem ao reiniciar) ----------
const sessionDb = new Database(path.join(__dirname, 'database.sqlite'));
app.use(session({
  store: new SqliteStore({ client: sessionDb, expired: { clear: true, intervalMs: 900000 } }),
  secret: process.env.SESSION_SECRET || 'troque-este-segredo-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 dias
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Helpers ----------
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Você precisa entrar na sua conta.' });
  next();
}

function requireOrganizer(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Você precisa entrar na sua conta.' });
  if (req.session.role !== 'organizer') return res.status(403).json({ error: 'Apenas o organizador pode fazer isso.' });
  next();
}

function validEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function eventWithCount(event) {
  const row = db.prepare(
    "SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND status = 'confirmed'"
  ).get(event.id);
  return { ...event, confirmed_count: row.c };
}

// ---------- Autenticação ----------
app.post('/api/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !name.trim()) return res.status(400).json({ error: 'Informe seu nome.' });
  if (!validEmail(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'A senha precisa ter pelo menos 6 caracteres.' });

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (exists) return res.status(409).json({ error: 'Este e-mail já está cadastrado. Faça login.' });

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name.trim(), email.trim().toLowerCase(), hash, 'participant');

  req.session.userId = info.lastInsertRowid;
  req.session.role = 'participant';
  req.session.name = name.trim();
  res.json({ id: info.lastInsertRowid, name: name.trim(), email: email.trim().toLowerCase(), role: 'participant' });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!validEmail(email) || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.name = user.name;
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.session.userId);
  res.json({ user: user || null });
});

// ---------- Eventos ----------
// Lista eventos: participantes veem só os ativos; organizador vê todos
app.get('/api/events', (req, res) => {
  let events;
  if (req.session.role === 'organizer') {
    events = db.prepare('SELECT * FROM events ORDER BY event_date ASC').all();
  } else {
    events = db.prepare("SELECT * FROM events WHERE status = 'active' ORDER BY event_date ASC").all();
  }
  res.json(events.map(eventWithCount));
});

app.get('/api/events/:id', (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });
  res.json(eventWithCount(event));
});

app.post('/api/events', requireOrganizer, (req, res) => {
  const { title, description, location, event_date, capacity } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Informe o título do evento.' });
  if (!event_date) return res.status(400).json({ error: 'Informe a data e hora do evento.' });
  const cap = parseInt(capacity, 10);
  if (isNaN(cap) || cap < 1) return res.status(400).json({ error: 'Informe um número de vagas válido (mínimo 1).' });

  const info = db.prepare(
    'INSERT INTO events (title, description, location, event_date, capacity, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(title.trim(), (description || '').trim(), (location || '').trim(), event_date, cap, req.session.userId);

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(info.lastInsertRowid);
  res.json(eventWithCount(event));
});

app.put('/api/events/:id', requireOrganizer, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });

  const { title, description, location, event_date, capacity } = req.body || {};
  if (!title || !title.trim()) return res.status(400).json({ error: 'Informe o título do evento.' });
  if (!event_date) return res.status(400).json({ error: 'Informe a data e hora do evento.' });
  const cap = parseInt(capacity, 10);
  if (isNaN(cap) || cap < 1) return res.status(400).json({ error: 'Informe um número de vagas válido (mínimo 1).' });

  const confirmed = db.prepare(
    "SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND status = 'confirmed'"
  ).get(event.id).c;
  if (cap < confirmed) {
    return res.status(400).json({ error: `Não é possível reduzir para ${cap} vagas: já existem ${confirmed} inscritos confirmados.` });
  }

  db.prepare('UPDATE events SET title = ?, description = ?, location = ?, event_date = ?, capacity = ? WHERE id = ?')
    .run(title.trim(), (description || '').trim(), (location || '').trim(), event_date, cap, event.id);

  const updated = db.prepare('SELECT * FROM events WHERE id = ?').get(event.id);
  res.json(eventWithCount(updated));
});

// Cancelar evento (não apaga, mantém histórico)
app.delete('/api/events/:id', requireOrganizer, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });
  db.prepare("UPDATE events SET status = 'cancelled' WHERE id = ?").run(event.id);
  res.json({ ok: true });
});

// Reativar evento cancelado
app.post('/api/events/:id/reactivate', requireOrganizer, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });
  db.prepare("UPDATE events SET status = 'active' WHERE id = ?").run(event.id);
  res.json({ ok: true });
});

// ---------- Inscrições ----------
// Inscrever-se
app.post('/api/events/:id/register', requireAuth, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event) return res.status(404).json({ error: 'Evento não encontrado.' });
  if (event.status === 'cancelled') return res.status(400).json({ error: 'Este evento foi cancelado.' });

  const existing = db.prepare('SELECT * FROM registrations WHERE user_id = ? AND event_id = ?')
    .get(req.session.userId, event.id);

  if (existing && existing.status === 'confirmed') {
    return res.status(409).json({ error: 'Você já está inscrito neste evento.' });
  }

  const confirmed = db.prepare(
    "SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND status = 'confirmed'"
  ).get(event.id).c;

  if (confirmed >= event.capacity) {
    return res.status(400).json({ error: 'As vagas deste evento acabaram.' });
  }

  if (existing) {
    db.prepare("UPDATE registrations SET status = 'confirmed', attended = 0, created_at = datetime('now') WHERE id = ?")
      .run(existing.id);
  } else {
    db.prepare('INSERT INTO registrations (user_id, event_id) VALUES (?, ?)')
      .run(req.session.userId, event.id);
  }

  res.json({ ok: true });
});

// Cancelar a própria inscrição
app.delete('/api/registrations/:id', requireAuth, (req, res) => {
  const reg = db.prepare('SELECT * FROM registrations WHERE id = ?').get(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Inscrição não encontrada.' });
  if (reg.user_id !== req.session.userId && req.session.role !== 'organizer') {
    return res.status(403).json({ error: 'Você só pode cancelar as suas próprias inscrições.' });
  }
  db.prepare("UPDATE registrations SET status = 'cancelled' WHERE id = ?").run(reg.id);
  res.json({ ok: true });
});

// Minhas inscrições (participante)
app.get('/api/my-registrations', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT r.id AS registration_id, r.status AS registration_status, r.attended, r.created_at AS registered_at,
           e.id AS event_id, e.title, e.description, e.location, e.event_date, e.capacity, e.status AS event_status
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    WHERE r.user_id = ?
    ORDER BY e.event_date ASC
  `).all(req.session.userId);
  res.json(rows);
});

// Todas as inscrições (organizador)
app.get('/api/registrations', requireOrganizer, (req, res) => {
  const rows = db.prepare(`
    SELECT r.id AS registration_id, r.status AS registration_status, r.attended, r.created_at AS registered_at,
           u.id AS user_id, u.name AS user_name, u.email AS user_email,
           e.id AS event_id, e.title AS event_title, e.event_date, e.status AS event_status
    FROM registrations r
    JOIN users u ON u.id = r.user_id
    JOIN events e ON e.id = r.event_id
    ORDER BY e.event_date ASC, u.name ASC
  `).all();
  res.json(rows);
});

// Inscrições de um evento específico (organizador)
app.get('/api/events/:id/registrations', requireOrganizer, (req, res) => {
  const rows = db.prepare(`
    SELECT r.id AS registration_id, r.status AS registration_status, r.attended, r.created_at AS registered_at,
           u.id AS user_id, u.name AS user_name, u.email AS user_email
    FROM registrations r
    JOIN users u ON u.id = r.user_id
    WHERE r.event_id = ?
    ORDER BY u.name ASC
  `).all(req.params.id);
  res.json(rows);
});

// Confirmar / desfazer presença (organizador)
app.post('/api/registrations/:id/attendance', requireOrganizer, (req, res) => {
  const reg = db.prepare('SELECT * FROM registrations WHERE id = ?').get(req.params.id);
  if (!reg) return res.status(404).json({ error: 'Inscrição não encontrada.' });
  if (reg.status !== 'confirmed') return res.status(400).json({ error: 'Só é possível confirmar presença de inscrições ativas.' });

  const attended = req.body && req.body.attended ? 1 : 0;
  db.prepare('UPDATE registrations SET attended = ? WHERE id = ?').run(attended, reg.id);
  res.json({ ok: true, attended: !!attended });
});

app.listen(PORT, () => {
  console.log(`Portal de Eventos rodando em http://localhost:${PORT}`);
});
