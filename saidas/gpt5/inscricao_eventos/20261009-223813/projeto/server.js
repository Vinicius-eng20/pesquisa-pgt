const path = require('path');
const express = require('express');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const db = require('./src/db');

const SQLiteStore = SQLiteStoreFactory(session);
const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: path.join(__dirname, 'data')
  }),
  secret: process.env.SESSION_SECRET || 'troque-esta-chave-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7
  }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    flash(req, 'error', 'Entre na sua conta para continuar.');
    return res.redirect('/login');
  }
  next();
}

function requireOrganizer(req, res, next) {
  if (!req.session.user) {
    flash(req, 'error', 'Entre na sua conta para continuar.');
    return res.redirect('/login');
  }
  if (req.session.user.role !== 'organizer') {
    flash(req, 'error', 'Apenas o organizador pode acessar esta área.');
    return res.redirect('/dashboard');
  }
  next();
}

function normalizeText(value) {
  return String(value || '').trim();
}

function normalizeDate(value) {
  return String(value || '').trim();
}

app.get('/', (req, res) => {
  const events = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'cancelada') AS active_registrations
    FROM events e
    WHERE e.status = 'ativo'
    ORDER BY e.event_date ASC
  `).all();

  res.render('home', { title: 'Eventos disponíveis', events });
});

app.get('/register', (req, res) => {
  res.render('auth-register', { title: 'Criar conta' });
});

app.post('/register', (req, res) => {
  const name = normalizeText(req.body.name);
  const email = normalizeText(req.body.email).toLowerCase();
  const password = String(req.body.password || '');

  if (!name || !email || !password) {
    flash(req, 'error', 'Preencha nome, e-mail e senha.');
    return res.redirect('/register');
  }

  if (password.length < 6) {
    flash(req, 'error', 'A senha precisa ter pelo menos 6 caracteres.');
    return res.redirect('/register');
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    flash(req, 'error', 'Já existe uma conta com esse e-mail.');
    return res.redirect('/register');
  }

  const passwordHash = bcrypt.hashSync(password, 12);
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, 'participant')
  `).run(name, email, passwordHash);

  req.session.user = { id: result.lastInsertRowid, name, email, role: 'participant' };
  flash(req, 'success', 'Conta criada com sucesso.');
  res.redirect('/dashboard');
});

app.get('/login', (req, res) => {
  res.render('auth-login', { title: 'Entrar' });
});

app.post('/login', (req, res) => {
  const email = normalizeText(req.body.email).toLowerCase();
  const password = String(req.body.password || '');

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    flash(req, 'error', 'E-mail ou senha inválidos.');
    return res.redirect('/login');
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  flash(req, 'success', 'Entrada realizada com sucesso.');
  res.redirect('/dashboard');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/dashboard', requireLogin, (req, res) => {
  if (req.session.user.role === 'organizer') {
    return res.redirect('/organizer');
  }
  res.redirect('/my-registrations');
});

app.get('/events/:id', (req, res) => {
  const event = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'cancelada') AS active_registrations
    FROM events e
    WHERE e.id = ?
  `).get(req.params.id);

  if (!event) {
    flash(req, 'error', 'Evento não encontrado.');
    return res.redirect('/');
  }

  let registration = null;
  if (req.session.user) {
    registration = db.prepare(`
      SELECT * FROM registrations
      WHERE event_id = ? AND user_id = ?
      ORDER BY id DESC
      LIMIT 1
    `).get(event.id, req.session.user.id);
  }

  res.render('event-detail', { title: event.title, event, registration });
});

app.post('/events/:id/register', requireLogin, (req, res) => {
  if (req.session.user.role !== 'participant') {
    flash(req, 'error', 'O organizador não pode se inscrever em eventos.');
    return res.redirect(`/events/${req.params.id}`);
  }

  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);
  if (!event || event.status !== 'ativo') {
    flash(req, 'error', 'Este evento não está disponível para inscrição.');
    return res.redirect('/');
  }

  const activeCount = db.prepare(`
    SELECT COUNT(*) AS total FROM registrations
    WHERE event_id = ? AND status != 'cancelada'
  `).get(event.id).total;

  if (event.capacity && activeCount >= event.capacity) {
    flash(req, 'error', 'Este evento está sem vagas.');
    return res.redirect(`/events/${event.id}`);
  }

  const existing = db.prepare(`
    SELECT * FROM registrations
    WHERE event_id = ? AND user_id = ? AND status != 'cancelada'
  `).get(event.id, req.session.user.id);

  if (existing) {
    flash(req, 'error', 'Você já está inscrito neste evento.');
    return res.redirect(`/events/${event.id}`);
  }

  db.prepare(`
    INSERT INTO registrations (event_id, user_id, status, attendance_confirmed)
    VALUES (?, ?, 'inscrita', 0)
  `).run(event.id, req.session.user.id);

  flash(req, 'success', 'Inscrição realizada com sucesso.');
  res.redirect('/my-registrations');
});

app.get('/my-registrations', requireLogin, (req, res) => {
  if (req.session.user.role !== 'participant') {
    return res.redirect('/organizer');
  }

  const registrations = db.prepare(`
    SELECT r.*, e.title, e.location, e.event_date, e.status AS event_status
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    WHERE r.user_id = ?
    ORDER BY r.created_at DESC
  `).all(req.session.user.id);

  res.render('my-registrations', { title: 'Minhas inscrições', registrations });
});

app.post('/registrations/:id/cancel', requireLogin, (req, res) => {
  const registration = db.prepare(`
    SELECT * FROM registrations
    WHERE id = ? AND user_id = ?
  `).get(req.params.id, req.session.user.id);

  if (!registration) {
    flash(req, 'error', 'Inscrição não encontrada.');
    return res.redirect('/my-registrations');
  }

  if (registration.status === 'cancelada') {
    flash(req, 'error', 'Esta inscrição já está cancelada.');
    return res.redirect('/my-registrations');
  }

  db.prepare(`
    UPDATE registrations
    SET status = 'cancelada', attendance_confirmed = 0, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(registration.id);

  flash(req, 'success', 'Inscrição cancelada.');
  res.redirect('/my-registrations');
});

app.get('/organizer', requireOrganizer, (req, res) => {
  const events = db.prepare(`
    SELECT e.*,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status != 'cancelada') AS active_registrations,
      (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id) AS total_registrations
    FROM events e
    ORDER BY e.event_date DESC
  `).all();

  res.render('organizer-dashboard', { title: 'Área do organizador', events });
});

app.get('/organizer/events/new', requireOrganizer, (req, res) => {
  res.render('event-form', {
    title: 'Criar evento',
    event: null,
    action: '/organizer/events/new'
  });
});

app.post('/organizer/events/new', requireOrganizer, (req, res) => {
  const title = normalizeText(req.body.title);
  const description = normalizeText(req.body.description);
  const location = normalizeText(req.body.location);
  const eventDate = normalizeDate(req.body.event_date);
  const capacity = Number(req.body.capacity || 0);

  if (!title || !description || !location || !eventDate) {
    flash(req, 'error', 'Preencha todos os campos obrigatórios.');
    return res.redirect('/organizer/events/new');
  }

  db.prepare(`
    INSERT INTO events (title, description, location, event_date, capacity, status, created_by)
    VALUES (?, ?, ?, ?, ?, 'ativo', ?)
  `).run(title, description, location, eventDate, capacity > 0 ? capacity : null, req.session.user.id);

  flash(req, 'success', 'Evento criado com sucesso.');
  res.redirect('/organizer');
});

app.get('/organizer/events/:id/edit', requireOrganizer, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

  if (!event) {
    flash(req, 'error', 'Evento não encontrado.');
    return res.redirect('/organizer');
  }

  res.render('event-form', {
    title: 'Editar evento',
    event,
    action: `/organizer/events/${event.id}/edit`
  });
});

app.post('/organizer/events/:id/edit', requireOrganizer, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

  if (!event) {
    flash(req, 'error', 'Evento não encontrado.');
    return res.redirect('/organizer');
  }

  const title = normalizeText(req.body.title);
  const description = normalizeText(req.body.description);
  const location = normalizeText(req.body.location);
  const eventDate = normalizeDate(req.body.event_date);
  const capacity = Number(req.body.capacity || 0);
  const status = ['ativo', 'cancelado'].includes(req.body.status) ? req.body.status : 'ativo';

  if (!title || !description || !location || !eventDate) {
    flash(req, 'error', 'Preencha todos os campos obrigatórios.');
    return res.redirect(`/organizer/events/${event.id}/edit`);
  }

  db.prepare(`
    UPDATE events
    SET title = ?, description = ?, location = ?, event_date = ?, capacity = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, description, location, eventDate, capacity > 0 ? capacity : null, status, event.id);

  flash(req, 'success', 'Evento atualizado com sucesso.');
  res.redirect('/organizer');
});

app.post('/organizer/events/:id/cancel', requireOrganizer, (req, res) => {
  const event = db.prepare('SELECT * FROM events WHERE id = ?').get(req.params.id);

  if (!event) {
    flash(req, 'error', 'Evento não encontrado.');
    return res.redirect('/organizer');
  }

  db.prepare(`
    UPDATE events
    SET status = 'cancelado', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(event.id);

  flash(req, 'success', 'Evento cancelado.');
  res.redirect('/organizer');
});

app.get('/organizer/registrations', requireOrganizer, (req, res) => {
  const registrations = db.prepare(`
    SELECT
      r.*,
      e.title AS event_title,
      e.event_date,
      e.status AS event_status,
      u.name AS user_name,
      u.email AS user_email
    FROM registrations r
    JOIN events e ON e.id = r.event_id
    JOIN users u ON u.id = r.user_id
    ORDER BY e.event_date DESC, r.created_at DESC
  `).all();

  res.render('organizer-registrations', { title: 'Todas as inscrições', registrations });
});

app.post('/organizer/registrations/:id/confirm', requireOrganizer, (req, res) => {
  const registration = db.prepare('SELECT * FROM registrations WHERE id = ?').get(req.params.id);

  if (!registration) {
    flash(req, 'error', 'Inscrição não encontrada.');
    return res.redirect('/organizer/registrations');
  }

  if (registration.status === 'cancelada') {
    flash(req, 'error', 'Não é possível confirmar presença em inscrição cancelada.');
    return res.redirect('/organizer/registrations');
  }

  db.prepare(`
    UPDATE registrations
    SET attendance_confirmed = 1, status = 'confirmada', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(registration.id);

  flash(req, 'success', 'Presença confirmada.');
  res.redirect('/organizer/registrations');
});

app.post('/organizer/registrations/:id/unconfirm', requireOrganizer, (req, res) => {
  const registration = db.prepare('SELECT * FROM registrations WHERE id = ?').get(req.params.id);

  if (!registration) {
    flash(req, 'error', 'Inscrição não encontrada.');
    return res.redirect('/organizer/registrations');
  }

  if (registration.status === 'cancelada') {
    flash(req, 'error', 'Inscrição cancelada não pode ser alterada.');
    return res.redirect('/organizer/registrations');
  }

  db.prepare(`
    UPDATE registrations
    SET attendance_confirmed = 0, status = 'inscrita', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(registration.id);

  flash(req, 'success', 'Confirmação removida.');
  res.redirect('/organizer/registrations');
});

app.use((req, res) => {
  res.status(404).render('404', { title: 'Página não encontrada' });
});

app.listen(PORT, () => {
  console.log(`Portal rodando em http://localhost:${PORT}`);
});
