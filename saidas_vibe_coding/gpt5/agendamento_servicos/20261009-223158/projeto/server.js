const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./src/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.sqlite', dir: __dirname }),
  secret: process.env.SESSION_SECRET || 'troque-este-segredo-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30
  }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.message = req.session.message || null;
  delete req.session.message;
  next();
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    req.session.message = { type: 'error', text: 'Faça login para continuar.' };
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    req.session.message = { type: 'error', text: 'Acesso permitido apenas ao responsável pelo negócio.' };
    return res.redirect('/');
  }
  next();
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

app.locals.formatDateTime = formatDateTime;

app.get('/', (req, res) => {
  const services = db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY name').all();
  res.render('index', { services });
});

app.get('/register', (req, res) => {
  res.render('register');
});

app.post('/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    req.session.message = { type: 'error', text: 'Preencha todos os campos.' };
    return res.redirect('/register');
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());

  if (existing) {
    req.session.message = { type: 'error', text: 'Este e-mail já está cadastrado.' };
    return res.redirect('/register');
  }

  const hash = bcrypt.hashSync(password, 10);

  db.prepare('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(name.trim(), email.toLowerCase().trim(), hash, 'client');

  req.session.message = { type: 'success', text: 'Conta criada. Faça login.' };
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  res.render('login');
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase().trim());

  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    req.session.message = { type: 'error', text: 'E-mail ou senha inválidos.' };
    return res.redirect('/login');
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  if (user.role === 'admin') return res.redirect('/admin');
  res.redirect('/cliente');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/cliente', requireLogin, (req, res) => {
  if (req.session.user.role === 'admin') return res.redirect('/admin');

  const services = db.prepare('SELECT * FROM services WHERE active = 1 ORDER BY name').all();

  const appointments = db.prepare(`
    SELECT a.*, s.name AS service_name, s.duration_minutes
    FROM appointments a
    JOIN services s ON s.id = a.service_id
    WHERE a.user_id = ?
    ORDER BY a.start_time DESC
  `).all(req.session.user.id);

  res.render('client/dashboard', { services, appointments });
});

app.get('/cliente/servico/:id', requireLogin, (req, res) => {
  if (req.session.user.role === 'admin') return res.redirect('/admin');

  const service = db.prepare('SELECT * FROM services WHERE id = ? AND active = 1').get(req.params.id);

  if (!service) {
    req.session.message = { type: 'error', text: 'Serviço não encontrado.' };
    return res.redirect('/cliente');
  }

  const slots = db.prepare(`
    SELECT sl.*
    FROM slots sl
    WHERE sl.service_id = ?
      AND sl.start_time > datetime('now')
      AND sl.id NOT IN (
        SELECT slot_id FROM appointments
        WHERE status IN ('pending', 'confirmed')
      )
    ORDER BY sl.start_time
  `).all(service.id);

  res.render('client/service', { service, slots });
});

app.post('/cliente/agendar', requireLogin, (req, res) => {
  if (req.session.user.role === 'admin') return res.redirect('/admin');

  const { service_id, slot_id } = req.body;

  const slot = db.prepare(`
    SELECT sl.*, s.id AS service_exists
    FROM slots sl
    JOIN services s ON s.id = sl.service_id
    WHERE sl.id = ? AND sl.service_id = ? AND s.active = 1
  `).get(slot_id, service_id);

  if (!slot) {
    req.session.message = { type: 'error', text: 'Horário indisponível.' };
    return res.redirect('/cliente');
  }

  const busy = db.prepare(`
    SELECT id FROM appointments
    WHERE slot_id = ? AND status IN ('pending', 'confirmed')
  `).get(slot_id);

  if (busy) {
    req.session.message = { type: 'error', text: 'Este horário já foi marcado.' };
    return res.redirect('/cliente/servico/' + service_id);
  }

  db.prepare(`
    INSERT INTO appointments (user_id, service_id, slot_id, start_time, status)
    VALUES (?, ?, ?, ?, 'pending')
  `).run(req.session.user.id, service_id, slot_id, slot.start_time);

  req.session.message = { type: 'success', text: 'Agendamento solicitado. Aguarde confirmação.' };
  res.redirect('/cliente');
});

app.post('/cliente/agendamento/:id/cancelar', requireLogin, (req, res) => {
  const appointment = db.prepare('SELECT * FROM appointments WHERE id = ? AND user_id = ?')
    .get(req.params.id, req.session.user.id);

  if (!appointment) {
    req.session.message = { type: 'error', text: 'Agendamento não encontrado.' };
    return res.redirect('/cliente');
  }

  if (appointment.status === 'cancelled' || appointment.status === 'rejected') {
    req.session.message = { type: 'error', text: 'Este agendamento não pode ser cancelado.' };
    return res.redirect('/cliente');
  }

  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run('cancelled', appointment.id);

  req.session.message = { type: 'success', text: 'Agendamento cancelado.' };
  res.redirect('/cliente');
});

app.get('/admin', requireAdmin, (req, res) => {
  const services = db.prepare('SELECT * FROM services ORDER BY active DESC, name').all();

  const slots = db.prepare(`
    SELECT sl.*, s.name AS service_name
    FROM slots sl
    JOIN services s ON s.id = sl.service_id
    ORDER BY sl.start_time DESC
    LIMIT 100
  `).all();

  const appointments = db.prepare(`
    SELECT a.*, s.name AS service_name, u.name AS user_name, u.email AS user_email
    FROM appointments a
    JOIN services s ON s.id = a.service_id
    JOIN users u ON u.id = a.user_id
    ORDER BY a.start_time DESC
  `).all();

  res.render('admin/dashboard', { services, slots, appointments });
});

app.post('/admin/servicos', requireAdmin, (req, res) => {
  const { name, description, price, duration_minutes } = req.body;

  if (!name || !duration_minutes) {
    req.session.message = { type: 'error', text: 'Nome e duração são obrigatórios.' };
    return res.redirect('/admin');
  }

  db.prepare(`
    INSERT INTO services (name, description, price, duration_minutes, active)
    VALUES (?, ?, ?, ?, 1)
  `).run(
    name.trim(),
    (description || '').trim(),
    Number(price || 0),
    Number(duration_minutes)
  );

  req.session.message = { type: 'success', text: 'Serviço cadastrado.' };
  res.redirect('/admin');
});

app.post('/admin/servicos/:id', requireAdmin, (req, res) => {
  const { name, description, price, duration_minutes, active } = req.body;

  db.prepare(`
    UPDATE services
    SET name = ?, description = ?, price = ?, duration_minutes = ?, active = ?
    WHERE id = ?
  `).run(
    name.trim(),
    (description || '').trim(),
    Number(price || 0),
    Number(duration_minutes),
    active ? 1 : 0,
    req.params.id
  );

  req.session.message = { type: 'success', text: 'Serviço atualizado.' };
  res.redirect('/admin');
});

app.post('/admin/horarios', requireAdmin, (req, res) => {
  const { service_id, start_time } = req.body;

  if (!service_id || !start_time) {
    req.session.message = { type: 'error', text: 'Escolha o serviço e o horário.' };
    return res.redirect('/admin');
  }

  const normalized = start_time.replace('T', ' ') + ':00';

  db.prepare(`
    INSERT INTO slots (service_id, start_time)
    VALUES (?, ?)
  `).run(service_id, normalized);

  req.session.message = { type: 'success', text: 'Horário cadastrado.' };
  res.redirect('/admin');
});

app.post('/admin/horarios/:id/excluir', requireAdmin, (req, res) => {
  const used = db.prepare(`
    SELECT id FROM appointments
    WHERE slot_id = ? AND status IN ('pending', 'confirmed')
  `).get(req.params.id);

  if (used) {
    req.session.message = { type: 'error', text: 'Não é possível excluir um horário com agendamento ativo.' };
    return res.redirect('/admin');
  }

  db.prepare('DELETE FROM slots WHERE id = ?').run(req.params.id);

  req.session.message = { type: 'success', text: 'Horário excluído.' };
  res.redirect('/admin');
});

app.post('/admin/agendamentos/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;

  if (!['confirmed', 'rejected', 'cancelled', 'pending'].includes(status)) {
    req.session.message = { type: 'error', text: 'Status inválido.' };
    return res.redirect('/admin');
  }

  db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, req.params.id);

  req.session.message = { type: 'success', text: 'Agendamento atualizado.' };
  res.redirect('/admin');
});

app.listen(PORT, () => {
  console.log(`Sistema rodando em http://localhost:${PORT}`);
});
