const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const Database = require('better-sqlite3');

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'data.db');
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('participant','organizer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organizer_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  starts_at TEXT NOT NULL,
  capacity INTEGER NOT NULL DEFAULT 0,
  canceled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (organizer_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  participant_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','canceled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, participant_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
}

function authOptional(req, _res, next) {
  const token = req.cookies.token;
  if (token) {
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch (_) {}
  }
  next();
}

function authRequired(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
  next();
}

function roleRequired(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Não autenticado' });
    if (req.user.role !== role) return res.status(403).json({ error: 'Sem permissão' });
    next();
  };
}

app.use(authOptional);

// Auth
app.post('/api/register', (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Preencha todos os campos' });
  if (!['participant', 'organizer'].includes(role)) return res.status(400).json({ error: 'Tipo inválido' });
  if (password.length < 4) return res.status(400).json({ error: 'Senha muito curta' });
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (exists) return res.status(400).json({ error: 'E-mail já cadastrado' });
  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name, email.toLowerCase(), hash, role);
  const user = { id: info.lastInsertRowid, name, role };
  res.cookie('token', signToken(user), { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
  res.json({ user });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Preencha todos os campos' });
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(400).json({ error: 'E-mail ou senha inválidos' });
  }
  const user = { id: row.id, name: row.name, role: row.role };
  res.cookie('token', signToken(user), { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 3600 * 1000 });
  res.json({ user });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: req.user });
});

// Events
app.get('/api/events', (req, res) => {
  const rows = db.prepare(`
    SELECT e.*, u.name AS organizer_name,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'canceled') AS registrations_count
    FROM events e JOIN users u ON u.id = e.organizer_id
    ORDER BY e.starts_at ASC
  `).all();
  res.json({ events: rows });
});

app.post('/api/events', roleRequired('organizer'), (req, res) => {
  const { title, description, location, starts_at, capacity } = req.body || {};
  if (!title || !starts_at) return res.status(400).json({ error: 'Título e data obrigatórios' });
  const info = db.prepare(`
    INSERT INTO events (organizer_id, title, description, location, starts_at, capacity)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(req.user.id, title, description || '', location || '', starts_at, Number(capacity) || 0);
  res.json({ id: info.lastInsertRowid });
});

app.put('/api/events/:id', roleRequired('organizer'), (req, res) => {
  const id = Number(req.params.id);
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!ev) return res.status(404).json({ error: 'Evento não encontrado' });
  if (ev.organizer_id !== req.user.id) return res.status(403).json({ error: 'Sem permissão' });
  const { title, description, location, starts_at, capacity } = req.body || {};
  db.prepare(`
    UPDATE events SET title = ?, description = ?, location = ?, starts_at = ?, capacity = ?
    WHERE id = ?
  `).run(
    title ?? ev.title,
    description ?? ev.description,
    location ?? ev.location,
    starts_at ?? ev.starts_at,
    Number(capacity ?? ev.capacity) || 0,
    id
  );
  res.json({ ok: true });
});

app.delete('/api/events/:id', roleRequired('organizer'), (req, res) => {
  const id = Number(req.params.id);
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
  if (!ev) return res.status(404).json({ error: 'Evento não encontrado' });
  if (ev.organizer_id !== req.user.id) return res.status(403).json({ error: 'Sem permissão' });
  db.prepare('UPDATE events SET canceled = 1 WHERE id = ?').run(id);
  res.json({ ok: true });
});

// Registrations
app.post('/api/events/:id/register', roleRequired('participant'), (req, res) => {
  const eventId = Number(req.params.id);
  const ev = db.prepare('SELECT * FROM events WHERE id = ?').get(eventId);
  if (!ev || ev.canceled) return res.status(400).json({ error: 'Evento indisponível' });
  if (ev.capacity > 0) {
    const count = db.prepare(`SELECT COUNT(*) AS c FROM registrations WHERE event_id = ? AND status != 'canceled'`).get(eventId).c;
    if (count >= ev.capacity) return res.status(400).json({ error: 'Evento lotado' });
  }
  const existing = db.prepare('SELECT * FROM registrations WHERE event_id = ? AND participant_id = ?').get(eventId, req.user.id);
  if (existing) {
    if (existing.status === 'canceled') {
      db.prepare(`UPDATE registrations SET status = 'pending', created_at = datetime('now') WHERE id = ?`).run(existing.id);
    } else {
      return res.status(400).json({ error: 'Você já está inscrito' });
    }
  } else {
    db.prepare('INSERT INTO registrations (event_id, participant_id, status) VALUES (?, ?, ?)')
      .run(eventId, req.user.id, 'pending');
  }
  res.json({ ok: true });
});

app.get('/api/my-registrations', roleRequired('participant'), (req, res) => {
  const rows = db.prepare(`
    SELECT r.id AS registration_id, r.status, r.created_at, e.*
    FROM registrations r JOIN events e ON e.id = r.event_id
    WHERE r.participant_id = ?
    ORDER BY r.created_at DESC
  `).all(req.user.id);
  res.json({ registrations: rows });
});

app.delete('/api/registrations/:id', roleRequired('participant'), (req, res) => {
  const id = Number(req.params.id);
  const r = db.prepare('SELECT * FROM registrations WHERE id = ?').get(id);
  if (!r) return res.status(404).json({ error: 'Inscrição não encontrada' });
  if (r.participant_id !== req.user.id) return res.status(403).json({ error: 'Sem permissão' });
  db.prepare(`UPDATE registrations SET status = 'canceled' WHERE id = ?`).run(id);
  res.json({ ok: true });
});

// Organizer: all registrations
app.get('/api/organizer/events', roleRequired('organizer'), (req, res) => {
  const events = db.prepare(`
    SELECT e.*, 
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'canceled') AS registrations_count,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'confirmed') AS confirmed_count
    FROM events e WHERE e.organizer_id = ?
    ORDER BY e.starts_at DESC
  `).all(req.user.id);
  res.json({ events });
});

app.get('/api/organizer/registrations', roleRequired('organizer'), (req, res) => {
  const rows = db.prepare(`
    SELECT r.id AS registration_id, r.status, r.created_at,
           u.name AS participant_name, u.email AS participant_email,
           e.id AS event_id, e.title AS event_title, e.starts_at AS event_starts_at,
           e.organizer_id
    FROM registrations r
    JOIN users u ON u.id = r.participant_id
    JOIN events e ON e.id = r.event_id
    WHERE e.organizer_id = ?
    ORDER BY e.starts_at DESC, r.created_at DESC
  `).all(req.user.id);
  res.json({ registrations: rows });
});

app.post('/api/organizer/registrations/:id/status', roleRequired('organizer'), (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body || {};
  if (!['pending', 'confirmed', 'canceled'].includes(status)) return res.status(400).json({ error: 'Status inválido' });
  const r = db.prepare(`
    SELECT r.*, e.organizer_id FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = ?
  `).get(id);
  if (!r) return res.status(404).json({ error: 'Inscrição não encontrada' });
  if (r.organizer_id !== req.user.id) return res.status(403).json({ error: 'Sem permissão' });
  db.prepare('UPDATE registrations SET status = ? WHERE id = ?').run(status, id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
