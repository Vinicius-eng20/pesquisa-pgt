const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database('cursos.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'aluno'
  );

  CREATE TABLE IF NOT EXISTS cursos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    instrutor TEXT NOT NULL,
    carga_horaria INTEGER NOT NULL,
    preco REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS matriculas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    curso_id INTEGER NOT NULL,
    data_matricula TEXT NOT NULL,
    UNIQUE(usuario_id, curso_id),
    FOREIGN KEY(usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY(curso_id) REFERENCES cursos(id)
  );
`);

const adminExiste = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@admin.com');
if (!adminExiste) {
  db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)')
    .run('Administrador', 'admin@admin.com', bcrypt.hashSync('admin123', 10), 'admin');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'segredo-plataforma-cursos-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

function requireAuth(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Não autenticado' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.usuario || req.session.usuario.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

app.post('/api/registrar', (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha todos os campos' });
  if (senha.length < 4) return res.status(400).json({ erro: 'Senha muito curta' });
  try {
    const hash = bcrypt.hashSync(senha, 10);
    const info = db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)')
      .run(nome, email.toLowerCase(), hash, 'aluno');
    req.session.usuario = { id: info.lastInsertRowid, nome, email: email.toLowerCase(), tipo: 'aluno' };
    res.json({ ok: true, usuario: req.session.usuario });
  } catch (e) {
    res.status(400).json({ erro: 'Email já cadastrado' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get((email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(senha, u.senha)) {
    return res.status(401).json({ erro: 'Email ou senha inválidos' });
  }
  req.session.usuario = { id: u.id, nome: u.nome, email: u.email, tipo: u.tipo };
  res.json({ ok: true, usuario: req.session.usuario });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/eu', (req, res) => {
  res.json({ usuario: req.session.usuario || null });
});

app.get('/api/cursos', (req, res) => {
  const cursos = db.prepare('SELECT * FROM cursos ORDER BY id DESC').all();
  res.json(cursos);
});

app.get('/api/cursos/:id', (req, res) => {
  const curso = db.prepare('SELECT * FROM cursos WHERE id = ?').get(req.params.id);
  if (!curso) return res.status(404).json({ erro: 'Curso não encontrado' });
  res.json(curso);
});

app.post('/api/cursos', requireAdmin, (req, res) => {
  const { titulo, descricao, instrutor, carga_horaria, preco } = req.body;
  if (!titulo || !descricao || !instrutor) return res.status(400).json({ erro: 'Preencha todos os campos' });
  const info = db.prepare('INSERT INTO cursos (titulo, descricao, instrutor, carga_horaria, preco) VALUES (?, ?, ?, ?, ?)')
    .run(titulo, descricao, instrutor, Number(carga_horaria) || 0, Number(preco) || 0);
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/cursos/:id', requireAdmin, (req, res) => {
  const { titulo, descricao, instrutor, carga_horaria, preco } = req.body;
  db.prepare('UPDATE cursos SET titulo=?, descricao=?, instrutor=?, carga_horaria=?, preco=? WHERE id=?')
    .run(titulo, descricao, instrutor, Number(carga_horaria) || 0, Number(preco) || 0, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/cursos/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM matriculas WHERE curso_id = ?').run(req.params.id);
  db.prepare('DELETE FROM cursos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.post('/api/matriculas', requireAuth, (req, res) => {
  const { curso_id } = req.body;
  const curso = db.prepare('SELECT id FROM cursos WHERE id = ?').get(curso_id);
  if (!curso) return res.status(404).json({ erro: 'Curso não encontrado' });
  try {
    db.prepare('INSERT INTO matriculas (usuario_id, curso_id, data_matricula) VALUES (?, ?, ?)')
      .run(req.session.usuario.id, curso_id, new Date().toISOString());
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: 'Você já está matriculado neste curso' });
  }
});

app.get('/api/minhas-matriculas', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT m.id as matricula_id, m.data_matricula, c.*
    FROM matriculas m JOIN cursos c ON c.id = m.curso_id
    WHERE m.usuario_id = ?
    ORDER BY m.id DESC
  `).all(req.session.usuario.id);
  res.json(rows);
});

app.get('/api/admin/matriculas', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT m.id as matricula_id, m.data_matricula,
           u.nome as aluno_nome, u.email as aluno_email,
           c.titulo as curso_titulo, c.id as curso_id
    FROM matriculas m
    JOIN usuarios u ON u.id = m.usuario_id
    JOIN cursos c ON c.id = m.curso_id
    ORDER BY m.id DESC
  `).all();
  res.json(rows);
});

app.delete('/api/admin/matriculas/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM matriculas WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
