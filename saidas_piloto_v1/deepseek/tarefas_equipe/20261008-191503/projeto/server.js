const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcryptjs');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new sqlite3.Database(path.join(__dirname, 'data.db'));

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    assigned_to INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(assigned_to) REFERENCES users(id),
    FOREIGN KEY(created_by) REFERENCES users(id)
  )`);
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db', dir: __dirname }),
  secret: 'troque-esta-chave-secreta-para-algo-unico-123456',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: 'Não autenticado' });
  next();
}
function requireManager(req, res, next) {
  if (!req.session.userId || req.session.role !== 'gerente') {
    return res.status(403).json({ error: 'Apenas o gerente pode fazer isso' });
  }
  next();
}

app.post('/api/register', async (req, res) => {
  const { username, password, name } = req.body;
  if (!username || !password || !name) return res.status(400).json({ error: 'Preencha todos os campos' });
  db.get('SELECT COUNT(*) as c FROM users', async (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    const isFirst = row.c === 0;
    const role = isFirst ? 'gerente' : 'membro';
    const hash = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
      [username, hash, name, role],
      function (err2) {
        if (err2) return res.status(400).json({ error: 'Usuário já existe' });
        req.session.userId = this.lastID;
        req.session.role = role;
        req.session.name = name;
        res.json({ ok: true, role });
      });
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
    if (err || !user) return res.status(400).json({ error: 'Usuário ou senha inválidos' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Usuário ou senha inválidos' });
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.name = user.name;
    res.json({ ok: true, role: user.role });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', requireAuth, (req, res) => {
  db.get('SELECT id, username, name, role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Sessão inválida' });
    res.json(user);
  });
});

app.get('/api/members', requireAuth, (req, res) => {
  db.all("SELECT id, username, name, role FROM users WHERE role = 'membro' ORDER BY name", (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    res.json(rows);
  });
});

app.get('/api/tasks', requireAuth, (req, res) => {
  const isManager = req.session.role === 'gerente';
  const query = isManager
    ? `SELECT t.*, u.name AS assigned_name FROM tasks t JOIN users u ON t.assigned_to = u.id ORDER BY t.id DESC`
    : `SELECT t.*, u.name AS assigned_name FROM tasks t JOIN users u ON t.assigned_to = u.id WHERE t.assigned_to = ? ORDER BY t.id DESC`;
  const params = isManager ? [] : [req.session.userId];
  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor' });
    res.json(rows);
  });
});

app.post('/api/tasks', requireAuth, (req, res) => {
  const { title, description, assigned_to, status } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Título é obrigatório' });
  const isManager = req.session.role === 'gerente';
  let target = assigned_to;
  if (!isManager) target = req.session.userId;
  if (!target) return res.status(400).json({ error: 'Selecione um membro' });
  const st = status || 'pendente';
  const createdAt = new Date().toISOString();
  db.run('INSERT INTO tasks (title, description, status, assigned_to, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [title.trim(), description || '', st, target, req.session.userId, createdAt],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao criar tarefa' });
      res.json({ ok: true, id: this.lastID });
    });
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const id = req.params.id;
  const { title, description, status, assigned_to } = req.body;
  db.get('SELECT * FROM tasks WHERE id = ?', [id], (err, task) => {
    if (err || !task) return res.status(404).json({ error: 'Tarefa não encontrada' });
    const isManager = req.session.role === 'gerente';
    const isOwner = task.assigned_to === req.session.userId;
    if (!isManager && !isOwner) return res.status(403).json({ error: 'Sem permissão' });

    if (isManager) {
      const newTitle = title !== undefined ? title : task.title;
      const newDesc = description !== undefined ? description : task.description;
      const newStatus = status !== undefined ? status : task.status;
      const newAssigned = assigned_to !== undefined ? assigned_to : task.assigned_to;
      db.run('UPDATE tasks SET title = ?, description = ?, status = ?, assigned_to = ? WHERE id = ?',
        [newTitle, newDesc, newStatus, newAssigned, id],
        (e) => e ? res.status(500).json({ error: 'Erro ao atualizar' }) : res.json({ ok: true }));
    } else {
      if (status !== undefined) {
        db.run('UPDATE tasks SET status = ? WHERE id = ?', [status, id],
          (e) => e ? res.status(500).json({ error: 'Erro ao atualizar' }) : res.json({ ok: true }));
      } else {
        res.json({ ok: true });
      }
    }
  });
});

app.delete('/api/tasks/:id', requireManager, (req, res) => {
  db.run('DELETE FROM tasks WHERE id = ?', [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Erro ao remover' });
    res.json({ ok: true });
  });
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
