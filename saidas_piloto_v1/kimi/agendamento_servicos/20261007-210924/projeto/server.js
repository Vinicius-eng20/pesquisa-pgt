const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const db = new sqlite3.Database('database.sqlite');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: 'agendamento-secreto',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

// Criação das tabelas e usuário admin padrão
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    is_admin INTEGER DEFAULT 0
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    description TEXT,
    duration INTEGER
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER,
    datetime TEXT,
    available INTEGER DEFAULT 1,
    FOREIGN KEY(service_id) REFERENCES services(id)
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    slot_id INTEGER,
    status TEXT DEFAULT 'pendente',
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(slot_id) REFERENCES slots(id)
  )`);

  // Usuário admin padrão
  db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('admin123', 10);
      db.run("INSERT INTO users (username, password, is_admin) VALUES (?, ?, 1)", ['admin', hash]);
    }
  });
});

// Middleware de autenticação
function auth(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Não autenticado' });
  next();
}
function adminOnly(req, res, next) {
  if (!req.session.user || !req.session.user.is_admin) return res.status(403).json({ error: 'Acesso negado' });
  next();
}

// Cadastro de usuário
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.json({ error: 'Preencha todos os campos' });
  const hash = bcrypt.hashSync(password, 10);
  db.run("INSERT INTO users (username, password) VALUES (?, ?)", [username, hash], function(err) {
    if (err) return res.json({ error: 'Usuário já existe' });
    res.json({ success: true });
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
    if (!user) return res.json({ error: 'Usuário não encontrado' });
    if (!bcrypt.compareSync(password, user.password)) return res.json({ error: 'Senha incorreta' });
    req.session.user = { id: user.id, username: user.username, is_admin: user.is_admin };
    res.json({ success: true, is_admin: user.is_admin });
  });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

// Info do usuário logado
app.get('/api/me', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  res.json({ user: req.session.user });
});

// Listar serviços
app.get('/api/services', (req, res) => {
  db.all("SELECT * FROM services", (err, rows) => res.json(rows));
});

// Admin: cadastrar serviço
app.post('/api/services', adminOnly, (req, res) => {
  const { name, description, duration } = req.body;
  db.run("INSERT INTO services (name, description, duration) VALUES (?, ?, ?)", [name, description, duration], function(err) {
    if (err) return res.json({ error: 'Erro ao cadastrar serviço' });
    res.json({ success: true, id: this.lastID });
  });
});

// Admin: editar serviço
app.put('/api/services/:id', adminOnly, (req, res) => {
  const { name, description, duration } = req.body;
  db.run("UPDATE services SET name=?, description=?, duration=? WHERE id=?", [name, description, duration, req.params.id], function(err) {
    if (err) return res.json({ error: 'Erro ao editar serviço' });
    res.json({ success: true });
  });
});

// Admin: excluir serviço
app.delete('/api/services/:id', adminOnly, (req, res) => {
  db.run("DELETE FROM services WHERE id=?", [req.params.id], function(err) {
    res.json({ success: true });
  });
});

// Listar horários disponíveis de um serviço
app.get('/api/services/:id/slots', (req, res) => {
  db.all("SELECT * FROM slots WHERE service_id=? AND available=1", [req.params.id], (err, rows) => res.json(rows));
});

// Admin: cadastrar horário
app.post('/api/slots', adminOnly, (req, res) => {
  const { service_id, datetime } = req.body;
  db.run("INSERT INTO slots (service_id, datetime) VALUES (?, ?)", [service_id, datetime], function(err) {
    if (err) return res.json({ error: 'Erro ao cadastrar horário' });
    res.json({ success: true, id: this.lastID });
  });
});

// Admin: editar horário
app.put('/api/slots/:id', adminOnly, (req, res) => {
  const { datetime, available } = req.body;
  db.run("UPDATE slots SET datetime=?, available=? WHERE id=?", [datetime, available, req.params.id], function(err) {
    if (err) return res.json({ error: 'Erro ao editar horário' });
    res.json({ success: true });
  });
});

// Admin: excluir horário
app.delete('/api/slots/:id', adminOnly, (req, res) => {
  db.run("DELETE FROM slots WHERE id=?", [req.params.id], function(err) {
    res.json({ success: true });
  });
});

// Cliente: agendar horário
app.post('/api/appointments', auth, (req, res) => {
  const { slot_id } = req.body;
  db.get("SELECT * FROM slots WHERE id=? AND available=1", [slot_id], (err, slot) => {
    if (!slot) return res.json({ error: 'Horário não disponível' });
    db.run("INSERT INTO appointments (user_id, slot_id) VALUES (?, ?)", [req.session.user.id, slot_id], function(err) {
      if (err) return res.json({ error: 'Erro ao agendar' });
      db.run("UPDATE slots SET available=0 WHERE id=?", [slot_id]);
      res.json({ success: true });
    });
  });
});

// Cliente: ver seus agendamentos
app.get('/api/my-appointments', auth, (req, res) => {
  db.all(`SELECT a.id, a.status, s.datetime, sv.name as service
    FROM appointments a
    JOIN slots s ON a.slot_id = s.id
    JOIN services sv ON s.service_id = sv.id
    WHERE a.user_id=?`, [req.session.user.id], (err, rows) => res.json(rows));
});

// Cliente: cancelar agendamento
app.post('/api/cancel-appointment', auth, (req, res) => {
  const { id } = req.body;
  db.get("SELECT * FROM appointments WHERE id=? AND user_id=?", [id, req.session.user.id], (err, appt) => {
    if (!appt) return res.json({ error: 'Agendamento não encontrado' });
    db.run("DELETE FROM appointments WHERE id=?", [id]);
    db.run("UPDATE slots SET available=1 WHERE id=?", [appt.slot_id]);
    res.json({ success: true });
  });
});

// Admin: ver todos os agendamentos
app.get('/api/all-appointments', adminOnly, (req, res) => {
  db.all(`SELECT a.id, a.status, u.username, s.datetime, sv.name as service
    FROM appointments a
    JOIN users u ON a.user_id = u.id
    JOIN slots s ON a.slot_id = s.id
    JOIN services sv ON s.service_id = sv.id`, (err, rows) => res.json(rows));
});

// Admin: confirmar ou recusar agendamento
app.post('/api/appointment-status', adminOnly, (req, res) => {
  const { id, status } = req.body;
  db.run("UPDATE appointments SET status=? WHERE id=?", [status, id], function(err) {
    res.json({ success: true });
  });
});

// Página inicial
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
