const express = require('express');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'app.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'student')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  workload TEXT NOT NULL,
  teacher TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  course_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
  UNIQUE(user_id, course_id)
);
`);

const adminExists = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();
if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run('Administrador', 'admin@site.com', hash, 'admin');
}

const courseCount = db.prepare(`SELECT COUNT(*) AS total FROM courses`).get().total;
if (courseCount === 0) {
  const insertCourse = db.prepare(`
    INSERT INTO courses (title, description, workload, teacher)
    VALUES (?, ?, ?, ?)
  `);

  insertCourse.run(
    'Introdução à Informática',
    'Aprenda conceitos básicos de computadores, internet, arquivos, segurança e ferramentas essenciais para o dia a dia.',
    '20 horas',
    'Equipe da Plataforma'
  );

  insertCourse.run(
    'Excel para Iniciantes',
    'Curso prático para aprender planilhas, fórmulas básicas, tabelas e organização de dados.',
    '30 horas',
    'Equipe da Plataforma'
  );

  insertCourse.run(
    'Atendimento ao Cliente',
    'Aprenda técnicas de comunicação, relacionamento, resolução de problemas e qualidade no atendimento.',
    '15 horas',
    'Equipe da Plataforma'
  );
}

const SQLiteStore = SQLiteStoreFactory(session);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: dataDir
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
  res.locals.currentUser = req.session.user || null;
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

function flash(req, type, message) {
  req.session.flash = { type, message };
}

function requireLogin(req, res, next) {
  if (!req.session.user) {
    flash(req, 'error', 'Entre com sua conta para continuar.');
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    flash(req, 'error', 'Acesso permitido apenas para o administrador.');
    return res.redirect('/');
  }
  next();
}

function requireStudent(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'student') {
    flash(req, 'error', 'Acesso permitido apenas para alunos.');
    return res.redirect('/');
  }
  next();
}

app.get('/', (req, res) => {
  if (!req.session.user) {
    return res.render('home');
  }

  if (req.session.user.role === 'admin') {
    return res.redirect('/admin');
  }

  return res.redirect('/courses');
});

app.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('register', { values: {} });
});

app.post('/register', (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const passwordConfirm = String(req.body.passwordConfirm || '');

  if (!name || !email || !password || !passwordConfirm) {
    flash(req, 'error', 'Preencha todos os campos.');
    return res.render('register', { values: { name, email } });
  }

  if (password.length < 6) {
    flash(req, 'error', 'A senha precisa ter pelo menos 6 caracteres.');
    return res.render('register', { values: { name, email } });
  }

  if (password !== passwordConfirm) {
    flash(req, 'error', 'As senhas não são iguais.');
    return res.render('register', { values: { name, email } });
  }

  const exists = db.prepare(`SELECT id FROM users WHERE email = ?`).get(email);
  if (exists) {
    flash(req, 'error', 'Já existe uma conta com este email.');
    return res.render('register', { values: { name, email } });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, 'student')
  `).run(name, email, hash);

  req.session.user = {
    id: result.lastInsertRowid,
    name,
    email,
    role: 'student'
  };

  flash(req, 'success', 'Conta criada com sucesso.');
  res.redirect('/courses');
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { values: {} });
});

app.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  if (!email || !password) {
    flash(req, 'error', 'Informe email e senha.');
    return res.render('login', { values: { email } });
  }

  const user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    flash(req, 'error', 'Email ou senha inválidos.');
    return res.render('login', { values: { email } });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  flash(req, 'success', 'Entrada realizada com sucesso.');
  res.redirect('/');
});

app.post('/logout', requireLogin, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.get('/courses', requireStudent, (req, res) => {
  const courses = db.prepare(`
    SELECT
      c.*,
      e.id AS enrollment_id,
      e.status AS enrollment_status
    FROM courses c
    LEFT JOIN enrollments e
      ON e.course_id = c.id
     AND e.user_id = ?
    WHERE c.active = 1
    ORDER BY c.created_at DESC, c.id DESC
  `).all(req.session.user.id);

  res.render('courses', { courses });
});

app.post('/courses/:id/enroll', requireStudent, (req, res) => {
  const courseId = Number(req.params.id);
  const course = db.prepare(`SELECT * FROM courses WHERE id = ? AND active = 1`).get(courseId);

  if (!course) {
    flash(req, 'error', 'Curso não encontrado.');
    return res.redirect('/courses');
  }

  const existing = db.prepare(`
    SELECT * FROM enrollments
    WHERE user_id = ? AND course_id = ?
  `).get(req.session.user.id, courseId);

  if (existing && existing.status === 'active') {
    flash(req, 'error', 'Você já está matriculado neste curso.');
    return res.redirect('/courses');
  }

  if (existing && existing.status === 'cancelled') {
    db.prepare(`
      UPDATE enrollments
      SET status = 'active', cancelled_at = NULL, created_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(existing.id);

    flash(req, 'success', 'Matrícula reativada com sucesso.');
    return res.redirect('/my-enrollments');
  }

  db.prepare(`
    INSERT INTO enrollments (user_id, course_id)
    VALUES (?, ?)
  `).run(req.session.user.id, courseId);

  flash(req, 'success', 'Matrícula realizada com sucesso.');
  res.redirect('/my-enrollments');
});

app.get('/my-enrollments', requireStudent, (req, res) => {
  const enrollments = db.prepare(`
    SELECT
      e.*,
      c.title,
      c.description,
      c.workload,
      c.teacher,
      c.active
    FROM enrollments e
    JOIN courses c ON c.id = e.course_id
    WHERE e.user_id = ?
    ORDER BY e.created_at DESC, e.id DESC
  `).all(req.session.user.id);

  res.render('my-enrollments', { enrollments });
});

app.post('/my-enrollments/:id/cancel', requireStudent, (req, res) => {
  const enrollment = db.prepare(`
    SELECT * FROM enrollments
    WHERE id = ? AND user_id = ?
  `).get(Number(req.params.id), req.session.user.id);

  if (!enrollment) {
    flash(req, 'error', 'Matrícula não encontrada.');
    return res.redirect('/my-enrollments');
  }

  if (enrollment.status === 'cancelled') {
    flash(req, 'error', 'Esta matrícula já está cancelada.');
    return res.redirect('/my-enrollments');
  }

  db.prepare(`
    UPDATE enrollments
    SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(enrollment.id);

  flash(req, 'success', 'Matrícula cancelada.');
  res.redirect('/my-enrollments');
});

app.get('/admin', requireAdmin, (req, res) => {
  const stats = {
    courses: db.prepare(`SELECT COUNT(*) AS total FROM courses`).get().total,
    users: db.prepare(`SELECT COUNT(*) AS total FROM users WHERE role = 'student'`).get().total,
    activeEnrollments: db.prepare(`SELECT COUNT(*) AS total FROM enrollments WHERE status = 'active'`).get().total,
    totalEnrollments: db.prepare(`SELECT COUNT(*) AS total FROM enrollments`).get().total
  };

  const latestEnrollments = db.prepare(`
    SELECT
      e.*,
      u.name AS student_name,
      u.email AS student_email,
      c.title AS course_title
    FROM enrollments e
    JOIN users u ON u.id = e.user_id
    JOIN courses c ON c.id = e.course_id
    ORDER BY e.created_at DESC, e.id DESC
    LIMIT 8
  `).all();

  res.render('admin/dashboard', { stats, latestEnrollments });
});

app.get('/admin/courses', requireAdmin, (req, res) => {
  const courses = db.prepare(`
    SELECT
      c.*,
      COUNT(e.id) AS enrollment_count,
      SUM(CASE WHEN e.status = 'active' THEN 1 ELSE 0 END) AS active_enrollment_count
    FROM courses c
    LEFT JOIN enrollments e ON e.course_id = c.id
    GROUP BY c.id
    ORDER BY c.created_at DESC, c.id DESC
  `).all();

  res.render('admin/courses', { courses });
});

app.get('/admin/courses/new', requireAdmin, (req, res) => {
  res.render('admin/course-form', {
    mode: 'new',
    course: {
      title: '',
      description: '',
      workload: '',
      teacher: '',
      active: 1
    }
  });
});

app.post('/admin/courses/new', requireAdmin, (req, res) => {
  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const workload = String(req.body.workload || '').trim();
  const teacher = String(req.body.teacher || '').trim();
  const active = req.body.active ? 1 : 0;

  const course = { title, description, workload, teacher, active };

  if (!title || !description || !workload || !teacher) {
    flash(req, 'error', 'Preencha todos os campos do curso.');
    return res.render('admin/course-form', { mode: 'new', course });
  }

  db.prepare(`
    INSERT INTO courses (title, description, workload, teacher, active)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, description, workload, teacher, active);

  flash(req, 'success', 'Curso cadastrado com sucesso.');
  res.redirect('/admin/courses');
});

app.get('/admin/courses/:id/edit', requireAdmin, (req, res) => {
  const course = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(Number(req.params.id));

  if (!course) {
    flash(req, 'error', 'Curso não encontrado.');
    return res.redirect('/admin/courses');
  }

  res.render('admin/course-form', { mode: 'edit', course });
});

app.post('/admin/courses/:id/edit', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(id);

  if (!existing) {
    flash(req, 'error', 'Curso não encontrado.');
    return res.redirect('/admin/courses');
  }

  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const workload = String(req.body.workload || '').trim();
  const teacher = String(req.body.teacher || '').trim();
  const active = req.body.active ? 1 : 0;

  const course = { id, title, description, workload, teacher, active };

  if (!title || !description || !workload || !teacher) {
    flash(req, 'error', 'Preencha todos os campos do curso.');
    return res.render('admin/course-form', { mode: 'edit', course });
  }

  db.prepare(`
    UPDATE courses
    SET title = ?, description = ?, workload = ?, teacher = ?, active = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, description, workload, teacher, active, id);

  flash(req, 'success', 'Curso atualizado com sucesso.');
  res.redirect('/admin/courses');
});

app.post('/admin/courses/:id/delete', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  const course = db.prepare(`SELECT * FROM courses WHERE id = ?`).get(id);

  if (!course) {
    flash(req, 'error', 'Curso não encontrado.');
    return res.redirect('/admin/courses');
  }

  db.prepare(`DELETE FROM courses WHERE id = ?`).run(id);

  flash(req, 'success', 'Curso removido com sucesso.');
  res.redirect('/admin/courses');
});

app.get('/admin/enrollments', requireAdmin, (req, res) => {
  const status = String(req.query.status || 'all');

  let query = `
    SELECT
      e.*,
      u.name AS student_name,
      u.email AS student_email,
      c.title AS course_title,
      c.workload AS course_workload
    FROM enrollments e
    JOIN users u ON u.id = e.user_id
    JOIN courses c ON c.id = e.course_id
  `;

  const params = [];

  if (status === 'active' || status === 'cancelled') {
    query += ` WHERE e.status = ? `;
    params.push(status);
  }

  query += ` ORDER BY e.created_at DESC, e.id DESC `;

  const enrollments = db.prepare(query).all(...params);

  res.render('admin/enrollments', { enrollments, status });
});

app.post('/admin/enrollments/:id/cancel', requireAdmin, (req, res) => {
  const enrollment = db.prepare(`SELECT * FROM enrollments WHERE id = ?`).get(Number(req.params.id));

  if (!enrollment) {
    flash(req, 'error', 'Matrícula não encontrada.');
    return res.redirect('/admin/enrollments');
  }

  if (enrollment.status === 'cancelled') {
    flash(req, 'error', 'Matrícula já está cancelada.');
    return res.redirect('/admin/enrollments');
  }

  db.prepare(`
    UPDATE enrollments
    SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(enrollment.id);

  flash(req, 'success', 'Matrícula cancelada pelo administrador.');
  res.redirect('/admin/enrollments');
});

app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Plataforma rodando em http://localhost:${PORT}`);
});
