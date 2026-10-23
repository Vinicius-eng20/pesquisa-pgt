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

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('manager', 'member')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'em andamento', 'concluída')),
    assigned_to INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    due_date TEXT DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const countUsers = db.prepare('SELECT COUNT(*) AS total FROM users').get().total;
if (countUsers === 0) {
  const hash = bcrypt.hashSync('123456', 10);
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run('Gerente', 'gerente@equipe.com', hash, 'manager');
}

const SQLiteStore = SQLiteStoreFactory(session);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: dataDir
  }),
  secret: process.env.SESSION_SECRET || 'troque-esta-chave-secreta-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30,
    httpOnly: true
  }
}));

app.use((req, res, next) => {
  res.locals.currentUser = req.session.user || null;
  res.locals.message = req.session.message || null;
  res.locals.error = req.session.error || null;
  delete req.session.message;
  delete req.session.error;
  next();
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireManager(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'manager') {
    req.session.error = 'Você não tem permissão para acessar esta página.';
    return res.redirect('/tarefas');
  }
  next();
}

function refreshSessionUser(req) {
  if (!req.session.user) return;
  const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.session.user.id);
  if (user) req.session.user = user;
}

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/tarefas');
  res.redirect('/login');
});

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/tarefas');
  res.render('login');
});

app.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    req.session.error = 'E-mail ou senha incorretos.';
    return res.redirect('/login');
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  res.redirect('/tarefas');
});

app.post('/logout', requireLogin, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login');
  });
});

app.get('/tarefas', requireLogin, (req, res) => {
  refreshSessionUser(req);

  const user = req.session.user;
  let tasks;

  if (user.role === 'manager') {
    tasks = db.prepare(`
      SELECT tasks.*, 
             assigned.name AS assigned_name,
             creator.name AS creator_name
      FROM tasks
      JOIN users assigned ON assigned.id = tasks.assigned_to
      JOIN users creator ON creator.id = tasks.created_by
      ORDER BY 
        CASE tasks.status
          WHEN 'pendente' THEN 1
          WHEN 'em andamento' THEN 2
          WHEN 'concluída' THEN 3
        END,
        tasks.created_at DESC
    `).all();
  } else {
    tasks = db.prepare(`
      SELECT tasks.*, 
             assigned.name AS assigned_name,
             creator.name AS creator_name
      FROM tasks
      JOIN users assigned ON assigned.id = tasks.assigned_to
      JOIN users creator ON creator.id = tasks.created_by
      WHERE tasks.assigned_to = ?
      ORDER BY 
        CASE tasks.status
          WHEN 'pendente' THEN 1
          WHEN 'em andamento' THEN 2
          WHEN 'concluída' THEN 3
        END,
        tasks.created_at DESC
    `).all(user.id);
  }

  const members = db.prepare(`
    SELECT id, name, email, role 
    FROM users 
    ORDER BY role ASC, name ASC
  `).all();

  res.render('tasks', { tasks, members });
});

app.post('/tarefas', requireLogin, (req, res) => {
  const user = req.session.user;

  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const dueDate = String(req.body.due_date || '').trim();

  let assignedTo;

  if (user.role === 'manager') {
    assignedTo = Number(req.body.assigned_to);
    const assignedUser = db.prepare('SELECT id FROM users WHERE id = ?').get(assignedTo);
    if (!assignedUser) {
      req.session.error = 'Usuário responsável inválido.';
      return res.redirect('/tarefas');
    }
  } else {
    assignedTo = user.id;
  }

  if (!title) {
    req.session.error = 'Informe o título da tarefa.';
    return res.redirect('/tarefas');
  }

  db.prepare(`
    INSERT INTO tasks (title, description, assigned_to, created_by, due_date)
    VALUES (?, ?, ?, ?, ?)
  `).run(title, description, assignedTo, user.id, dueDate);

  req.session.message = 'Tarefa criada com sucesso.';
  res.redirect('/tarefas');
});

app.post('/tarefas/:id/status', requireLogin, (req, res) => {
  const user = req.session.user;
  const taskId = Number(req.params.id);
  const status = String(req.body.status || '');

  if (!['pendente', 'em andamento', 'concluída'].includes(status)) {
    req.session.error = 'Status inválido.';
    return res.redirect('/tarefas');
  }

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  if (!task) {
    req.session.error = 'Tarefa não encontrada.';
    return res.redirect('/tarefas');
  }

  if (user.role !== 'manager' && task.assigned_to !== user.id) {
    req.session.error = 'Você só pode alterar suas próprias tarefas.';
    return res.redirect('/tarefas');
  }

  db.prepare(`
    UPDATE tasks
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, taskId);

  req.session.message = 'Status atualizado.';
  res.redirect('/tarefas');
});

app.get('/tarefas/:id/editar', requireLogin, requireManager, (req, res) => {
  const taskId = Number(req.params.id);
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);

  if (!task) {
    req.session.error = 'Tarefa não encontrada.';
    return res.redirect('/tarefas');
  }

  const members = db.prepare(`
    SELECT id, name, email, role 
    FROM users 
    ORDER BY role ASC, name ASC
  `).all();

  res.render('edit-task', { task, members });
});

app.post('/tarefas/:id/editar', requireLogin, requireManager, (req, res) => {
  const taskId = Number(req.params.id);

  const title = String(req.body.title || '').trim();
  const description = String(req.body.description || '').trim();
  const status = String(req.body.status || '');
  const assignedTo = Number(req.body.assigned_to);
  const dueDate = String(req.body.due_date || '').trim();

  if (!title) {
    req.session.error = 'Informe o título da tarefa.';
    return res.redirect(`/tarefas/${taskId}/editar`);
  }

  if (!['pendente', 'em andamento', 'concluída'].includes(status)) {
    req.session.error = 'Status inválido.';
    return res.redirect(`/tarefas/${taskId}/editar`);
  }

  const assignedUser = db.prepare('SELECT id FROM users WHERE id = ?').get(assignedTo);
  if (!assignedUser) {
    req.session.error = 'Usuário responsável inválido.';
    return res.redirect(`/tarefas/${taskId}/editar`);
  }

  db.prepare(`
    UPDATE tasks
    SET title = ?, description = ?, status = ?, assigned_to = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, description, status, assignedTo, dueDate, taskId);

  req.session.message = 'Tarefa atualizada.';
  res.redirect('/tarefas');
});

app.post('/tarefas/:id/remover', requireLogin, requireManager, (req, res) => {
  const taskId = Number(req.params.id);
  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  req.session.message = 'Tarefa removida.';
  res.redirect('/tarefas');
});

app.get('/usuarios', requireLogin, requireManager, (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, role, created_at
    FROM users
    ORDER BY role ASC, name ASC
  `).all();

  res.render('users', { users });
});

app.post('/usuarios', requireLogin, requireManager, (req, res) => {
  const name = String(req.body.name || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase();
  const password = String(req.body.password || '');
  const role = String(req.body.role || '');

  if (!name || !email || !password) {
    req.session.error = 'Preencha nome, e-mail e senha.';
    return res.redirect('/usuarios');
  }

  if (!['manager', 'member'].includes(role)) {
    req.session.error = 'Tipo de usuário inválido.';
    return res.redirect('/usuarios');
  }

  if (password.length < 6) {
    req.session.error = 'A senha deve ter pelo menos 6 caracteres.';
    return res.redirect('/usuarios');
  }

  try {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`
      INSERT INTO users (name, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `).run(name, email, hash, role);

    req.session.message = 'Usuário criado com sucesso.';
  } catch (error) {
    req.session.error = 'Não foi possível criar o usuário. Talvez o e-mail já exista.';
  }

  res.redirect('/usuarios');
});

app.post('/usuarios/:id/remover', requireLogin, requireManager, (req, res) => {
  const userId = Number(req.params.id);

  if (userId === req.session.user.id) {
    req.session.error = 'Você não pode remover a própria conta.';
    return res.redirect('/usuarios');
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  req.session.message = 'Usuário removido.';
  res.redirect('/usuarios');
});

app.get('/minha-conta', requireLogin, (req, res) => {
  res.render('account');
});

app.post('/minha-conta', requireLogin, (req, res) => {
  const userId = req.session.user.id;
  const name = String(req.body.name || '').trim();
  const password = String(req.body.password || '');

  if (!name) {
    req.session.error = 'Informe seu nome.';
    return res.redirect('/minha-conta');
  }

  if (password) {
    if (password.length < 6) {
      req.session.error = 'A senha deve ter pelo menos 6 caracteres.';
      return res.redirect('/minha-conta');
    }

    const hash = bcrypt.hashSync(password, 10);
    db.prepare(`
      UPDATE users
      SET name = ?, password_hash = ?
      WHERE id = ?
    `).run(name, hash, userId);
  } else {
    db.prepare(`
      UPDATE users
      SET name = ?
      WHERE id = ?
    `).run(name, userId);
  }

  refreshSessionUser(req);
  req.session.message = 'Conta atualizada.';
  res.redirect('/minha-conta');
});

app.use((req, res) => {
  res.status(404).render('404');
});

app.listen(PORT, () => {
  console.log(`Sistema rodando em http://localhost:${PORT}`);
});
