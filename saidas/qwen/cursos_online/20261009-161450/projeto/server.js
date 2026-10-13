const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Banco de dados (arquivo JSON local) ----------
function ensureDb() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    const initial = {
      users: [
        {
          id: 'admin',
          name: 'Administrador',
          email: 'admin@plataforma.com',
          passwordHash: hashPassword('admin123'),
          salt: '1',
          role: 'admin',
          createdAt: new Date().toISOString()
        }
      ],
      courses: [],
      enrollments: [],
      sessions: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
  }
}

function loadDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDb(db) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

// ---------- Senhas ----------
function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function makeSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function verifyPassword(password, salt, hash) {
  const candidate = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}

// ---------- Sessões (tokens) ----------
function createSession(userId) {
  const db = loadDb();
  const token = crypto.randomBytes(32).toString('hex');
  const expiry = Date.now() + 1000 * 60 * 60 * 24 * 7; // 7 dias
  db.sessions = db.sessions.filter(s => s.token !== token);
  db.sessions.push({ token, userId, expires: expiry });
  saveDb(db);
  return token;
}

function getSessionUserId(req) {
  const token = req.headers['x-session-token'];
  if (!token) return null;
  const db = loadDb();
  const session = db.sessions.find(s => s.token === token && s.expires > Date.now());
  if (!session) return null;
  return session.userId;
}

function destroySession(token) {
  if (!token) return;
  const db = loadDb();
  db.sessions = db.sessions.filter(s => s.token !== token);
  saveDb(db);
}

// ---------- Helpers ----------
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

function publicCourse(c) {
  const db = loadDb();
  const enrolledCount = db.enrollments.filter(e => e.courseId === c.id).length;
  return { ...c, enrolledCount };
}

function publicEnrollment(e) {
  const db = loadDb();
  const course = db.courses.find(c => c.id === e.courseId);
  const user = db.users.find(u => u.id === e.userId);
  return {
    id: e.id,
    courseId: e.courseId,
    userId: e.userId,
    courseName: course ? course.name : 'Curso removido',
    studentName: user ? user.name : 'Aluno removido',
    studentEmail: user ? user.email : '',
    enrolledAt: e.enrolledAt
  };
}

function genId() {
  return crypto.randomBytes(8).toString('hex');
}

// ---------- Rotas de autenticação ----------
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Preencha nome, e-mail e senha.' });
  }
  if (!emailRe.test(email)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'A senha precisa ter pelo menos 4 caracteres.' });
  }
  const db = loadDb();
  const norm = email.trim().toLowerCase();
  if (db.users.some(u => u.email === norm)) {
    return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
  }
  const salt = makeSalt();
  const user = {
    id: genId(),
    name: name.trim(),
    email: norm,
    salt,
    passwordHash: hashPassword(password, salt),
    role: 'student',
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  saveDb(db);
  const token = createSession(user.id);
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }
  const db = loadDb();
  const norm = email.trim().toLowerCase();
  const user = db.users.find(u => u.email === norm);
  if (!user || !verifyPassword(password, user.salt, user.passwordHash)) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  const token = createSession(user.id);
  res.json({ token, user: publicUser(user) });
});

app.post('/api/auth/logout', (req, res) => {
  destroySession(req.headers['x-session-token']);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Sessão inválida.' });
  const db = loadDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) return res.status(401).json({ error: 'Usuário não encontrado.' });
  res.json({ user: publicUser(user) });
});

// ---------- Cursos ----------
app.get('/api/courses', (req, res) => {
  const db = loadDb();
  res.json({ courses: db.courses.map(publicCourse) });
});

app.post('/api/courses', (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Faça login.' });
  const db = loadDb();
  const user = db.users.find(u => u.id === userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Apenas o administrador.' });

  const { name, description, duration, price } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Informe o nome do curso.' });
  }
  const course = {
    id: genId(),
    name: name.trim(),
    description: (description || '').trim(),
    duration: (duration || '').trim(),
    price: (price || '').trim(),
    createdAt: new Date().toISOString()
  };
  db.courses.push(course);
  saveDb(db);
  res.json({ course: publicCourse(course) });
});

app.put('/api/courses/:id', (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Faça login.' });
  const db = loadDb();
  const user = db.users.find(u => u.id === userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Apenas o administrador.' });

  const course = db.courses.find(c => c.id === req.params.id);
  if (!course) return res.status(404).json({ error: 'Curso não encontrado.' });

  const { name, description, duration, price } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Informe o nome do curso.' });
  }
  course.name = name.trim();
  course.description = (description || '').trim();
  course.duration = (duration || '').trim();
  course.price = (price || '').trim();
  saveDb(db);
  res.json({ course: publicCourse(course) });
});

app.delete('/api/courses/:id', (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Faça login.' });
  const db = loadDb();
  const user = db.users.find(u => u.id === userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Apenas o administrador.' });

  const idx = db.courses.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Curso não encontrado.' });
  db.courses.splice(idx, 1);
  db.enrollments = db.enrollments.filter(e => e.courseId !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

// ---------- Matrículas ----------
app.post('/api/enrollments', (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Faça login.' });
  const db = loadDb();
  const user = db.users.find(u => u.id === userId);
  if (!user || user.role !== 'student') {
    return res.status(403).json({ error: 'Apenas alunos podem se matricular.' });
  }
  const courseId = (req.body || {}).courseId;
  const course = db.courses.find(c => c.id === courseId);
  if (!course) return res.status(404).json({ error: 'Curso não encontrado.' });
  if (db.enrollments.some(e => e.userId === userId && e.courseId === courseId)) {
    return res.status(409).json({ error: 'Você já está matriculado neste curso.' });
  }
  const enrollment = {
    id: genId(),
    userId,
    courseId,
    enrolledAt: new Date().toISOString()
  };
  db.enrollments.push(enrollment);
  saveDb(db);
  res.json({ enrollment: publicEnrollment(enrollment) });
});

app.get('/api/enrollments/my', (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Faça login.' });
  const db = loadDb();
  const list = db.enrollments
    .filter(e => e.userId === userId)
    .map(publicEnrollment);
  res.json({ enrollments: list });
});

// Admin: todas as matrículas
app.get('/api/enrollments/all', (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Faça login.' });
  const db = loadDb();
  const user = db.users.find(u => u.id === userId);
  if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Apenas o administrador.' });
  res.json({ enrollments: db.enrollments.map(publicEnrollment) });
});

app.delete('/api/enrollments/:id', (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) return res.status(401).json({ error: 'Faça login.' });
  const db = loadDb();
  const user = db.users.find(u => u.id === userId);
  const enrollment = db.enrollments.find(e => e.id === req.params.id);
  if (!enrollment) return res.status(404).json({ error: 'Matrícula não encontrada.' });

  const isAdmin = user && user.role === 'admin';
  const isOwn = enrollment.userId === userId;
  if (!isAdmin && !isOwn) return res.status(403).json({ error: 'Sem permissão.' });

  db.enrollments = db.enrollments.filter(e => e.id !== req.params.id);
  saveDb(db);
  res.json({ ok: true });
});

// ---------- Início do servidor ----------
ensureDb();
app.listen(PORT, () => {
  console.log('Plataforma de cursos rodando em http://localhost:' + PORT);
  console.log('Login do administrador: admin@plataforma.com / admin123');
});
