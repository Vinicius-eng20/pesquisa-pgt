const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new sqlite3.Database(path.join(DATA_DIR, 'app.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student'
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    instructor TEXT NOT NULL,
    duration TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS enrollments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    course_id INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, course_id),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
  )`);

  db.get(`SELECT COUNT(*) as count FROM users WHERE role='admin'`, (err, row) => {
    if (!err && row.count === 0) {
      const hash = bcrypt.hashSync('admin123', 10);
      db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'admin')`,
        ['Administrador', 'admin@admin.com', hash]);
      console.log('Admin criado: admin@admin.com / admin123');
    }
  });

  db.get(`SELECT COUNT(*) as count FROM courses`, (err, row) => {
    if (!err && row.count === 0) {
      const stmt = db.prepare(`INSERT INTO courses (title, description, instructor, duration) VALUES (?, ?, ?, ?)`);
      stmt.run('Introdução à Programação', 'Aprenda os fundamentos da programação com Python.', 'Prof. Ana Silva', '20 horas');
      stmt.run('Design Gráfico Essencial', 'Domine as ferramentas e princípios do design moderno.', 'Prof. Carlos Mendes', '15 horas');
      stmt.run('Marketing Digital', 'Estratégias completas para vender na internet.', 'Prof. Julia Costa', '30 horas');
      stmt.finalize();
    }
  });
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: DATA_DIR }),
  secret: 'segredo-super-secreto-plataforma',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') return res.redirect('/');
  next();
}

// Home
app.get('/', (req, res) => {
  db.all('SELECT * FROM courses ORDER BY id DESC', (err, courses) => {
    if (err) courses = [];
    let enrolledIds = [];
    const finish = () => res.render('home', { courses, enrolledIds });
    if (!req.session.user) return finish();
    db.all('SELECT course_id FROM enrollments WHERE user_id = ?', [req.session.user.id], (err2, rows) => {
      enrolledIds = err2 ? [] : rows.map(r => r.course_id);
      finish();
    });
  });
});

// Register
app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.render('register', { error: 'Preencha todos os campos.' });
  if (password.length < 4) return res.render('register', { error: 'Senha deve ter pelo menos 4 caracteres.' });
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
    if (row) return res.render('register', { error: 'E-mail já cadastrado.' });
    const hash = bcrypt.hashSync(password, 10);
    db.run('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, "student")',
      [name, email, hash], function(err2) {
        if (err2) return res.render('register', { error: 'Erro ao cadastrar.' });
        req.session.user = { id: this.lastID, name, email, role: 'student' };
        res.redirect('/');
      });
  });
});

// Login
app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.render('login', { error: 'E-mail ou senha inválidos.' });
    }
    req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.redirect('/');
  });
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// Minhas matrículas
app.get('/my-courses', requireAuth, (req, res) => {
  db.all(`SELECT courses.*, enrollments.id as enrollment_id, enrollments.created_at
    FROM enrollments JOIN courses ON courses.id = enrollments.course_id
    WHERE enrollments.user_id = ? ORDER BY enrollments.created_at DESC`,
    [req.session.user.id], (err, courses) => {
      res.render('my-courses', { courses: courses || [] });
    });
});

// Matricular
app.post('/enroll/:courseId', requireAuth, (req, res) => {
  const courseId = req.params.courseId;
  db.run('INSERT OR IGNORE INTO enrollments (user_id, course_id, created_at) VALUES (?, ?, ?)',
    [req.session.user.id, courseId, new Date().toISOString()], () => res.redirect('/my-courses'));
});

// Cancelar matrícula (aluno)
app.post('/unenroll/:courseId', requireAuth, (req, res) => {
  db.run('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?',
    [req.session.user.id, req.params.courseId], () => res.redirect('/my-courses'));
});

// Admin: cursos
app.get('/admin', requireAdmin, (req, res) => {
  db.all('SELECT * FROM courses ORDER BY id DESC', (err, courses) => {
    db.all(`SELECT e.id, e.created_at, u.name as user_name, u.email as user_email,
      c.title as course_title, c.id as course_id, u.id as user_id
      FROM enrollments e
      JOIN users u ON u.id = e.user_id
      JOIN courses c ON c.id = e.course_id
      ORDER BY e.created_at DESC`, (err2, enrollments) => {
      res.render('admin', { courses: courses || [], enrollments: enrollments || [] });
    });
  });
});

app.post('/admin/courses', requireAdmin, (req, res) => {
  const { title, description, instructor, duration } = req.body;
  db.run('INSERT INTO courses (title, description, instructor, duration) VALUES (?, ?, ?, ?)',
    [title, description, instructor, duration], () => res.redirect('/admin'));
});

app.post('/admin/courses/:id/edit', requireAdmin, (req, res) => {
  const { title, description, instructor, duration } = req.body;
  db.run('UPDATE courses SET title=?, description=?, instructor=?, duration=? WHERE id=?',
    [title, description, instructor, duration, req.params.id], () => res.redirect('/admin'));
});

app.post('/admin/courses/:id/delete', requireAdmin, (req, res) => {
  db.run('DELETE FROM courses WHERE id=?', [req.params.id], () => res.redirect('/admin'));
});

app.post('/admin/enrollments/:id/cancel', requireAdmin, (req, res) => {
  db.run('DELETE FROM enrollments WHERE id=?', [req.params.id], () => res.redirect('/admin'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
