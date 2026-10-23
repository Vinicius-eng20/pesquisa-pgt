const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database('agendamentos.db');

// Criar tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'cliente'
  );

  CREATE TABLE IF NOT EXISTS servicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco REAL,
    duracao INTEGER DEFAULT 30
  );

  CREATE TABLE IF NOT EXISTS horarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    hora TEXT NOT NULL,
    disponivel INTEGER DEFAULT 1,
    UNIQUE(data, hora)
  );

  CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    servico_id INTEGER NOT NULL,
    horario_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pendente',
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (servico_id) REFERENCES servicos(id),
    FOREIGN KEY (horario_id) REFERENCES horarios(id)
  );
`);

// Criar admin se não existir
const adminExiste = db.prepare('SELECT id FROM usuarios WHERE tipo = ?').get('admin');
if (!adminExiste) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(
    'Administrador', 'admin@admin.com', hash, 'admin'
  );
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'segredo-agendamento-2024-muito-secreto',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

function precisaLogin(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Não autenticado' });
  next();
}

function precisaAdmin(req, res, next) {
  if (!req.session.usuario || req.session.usuario.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

// ============ AUTENTICAÇÃO ============

app.post('/api/registrar', (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha todos os campos' });
  try {
    const hash = bcrypt.hashSync(senha, 10);
    const info = db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(nome, email, hash, 'cliente');
    req.session.usuario = { id: info.lastInsertRowid, nome, email, tipo: 'cliente' };
    res.json({ ok: true, usuario: req.session.usuario });
  } catch (e) {
    res.status(400).json({ erro: 'Este e-mail já está cadastrado' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!usuario || !bcrypt.compareSync(senha, usuario.senha)) {
    return res.status(400).json({ erro: 'E-mail ou senha incorretos' });
  }
  req.session.usuario = { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo };
  res.json({ ok: true, usuario: req.session.usuario });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/eu', (req, res) => {
  res.json({ usuario: req.session.usuario || null });
});

// ============ SERVIÇOS ============

app.get('/api/servicos', (req, res) => {
  const servicos = db.prepare('SELECT * FROM servicos ORDER BY nome').all();
  res.json(servicos);
});

app.post('/api/servicos', precisaAdmin, (req, res) => {
  const { nome, descricao, preco, duracao } = req.body;
  if (!nome) return res.status(400).json({ erro: 'Nome é obrigatório' });
  const info = db.prepare('INSERT INTO servicos (nome, descricao, preco, duracao) VALUES (?, ?, ?, ?)').run(
    nome, descricao || '', preco || 0, duracao || 30
  );
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.put('/api/servicos/:id', precisaAdmin, (req, res) => {
  const { nome, descricao, preco, duracao } = req.body;
  db.prepare('UPDATE servicos SET nome = ?, descricao = ?, preco = ?, duracao = ? WHERE id = ?').run(
    nome, descricao || '', preco || 0, duracao || 30, req.params.id
  );
  res.json({ ok: true });
});

app.delete('/api/servicos/:id', precisaAdmin, (req, res) => {
  const emUso = db.prepare('SELECT id FROM agendamentos WHERE servico_id = ?').get(req.params.id);
  if (emUso) return res.status(400).json({ erro: 'Existem agendamentos com este serviço' });
  db.prepare('DELETE FROM servicos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ HORÁRIOS ============

app.get('/api/horarios', (req, res) => {
  const horarios = db.prepare('SELECT * FROM horarios ORDER BY data, hora').all();
  res.json(horarios);
});

app.get('/api/horarios-livres', (req, res) => {
  const horarios = db.prepare(`
    SELECT h.* FROM horarios h
    WHERE h.disponivel = 1
    AND h.id NOT IN (
      SELECT horario_id FROM agendamentos WHERE status IN ('pendente', 'confirmado')
    )
    ORDER BY h.data, h.hora
  `).all();
  res.json(horarios);
});

app.post('/api/horarios', precisaAdmin, (req, res) => {
  const { data, hora } = req.body;
  if (!data || !hora) return res.status(400).json({ erro: 'Data e hora são obrigatórias' });
  try {
    const info = db.prepare('INSERT INTO horarios (data, hora) VALUES (?, ?)').run(data, hora);
    res.json({ ok: true, id: info.lastInsertRowid });
  } catch (e) {
    res.status(400).json({ erro: 'Este horário já existe' });
  }
});

app.put('/api/horarios/:id', precisaAdmin, (req, res) => {
  const { data, hora, disponivel } = req.body;
  db.prepare('UPDATE horarios SET data = ?, hora = ?, disponivel = ? WHERE id = ?').run(
    data, hora, disponivel ? 1 : 0, req.params.id
  );
  res.json({ ok: true });
});

app.delete('/api/horarios/:id', precisaAdmin, (req, res) => {
  const emUso = db.prepare('SELECT id FROM agendamentos WHERE horario_id = ?').get(req.params.id);
  if (emUso) return res.status(400).json({ erro: 'Existem agendamentos com este horário' });
  db.prepare('DELETE FROM horarios WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ============ AGENDAMENTOS ============

app.get('/api/meus-agendamentos', precisaLogin, (req, res) => {
  const lista = db.prepare(`
    SELECT a.*, s.nome AS servico_nome, s.preco AS servico_preco, h.data, h.hora
    FROM agendamentos a
    JOIN servicos s ON s.id = a.servico_id
    JOIN horarios h ON h.id = a.horario_id
    WHERE a.usuario_id = ?
    ORDER BY h.data DESC, h.hora DESC
  `).all(req.session.usuario.id);
  res.json(lista);
});

app.post('/api/agendamentos', precisaLogin, (req, res) => {
  const { servico_id, horario_id } = req.body;
  if (!servico_id || !horario_id) return res.status(400).json({ erro: 'Selecione serviço e horário' });

  const ocupado = db.prepare(`
    SELECT id FROM agendamentos WHERE horario_id = ? AND status IN ('pendente', 'confirmado')
  `).get(horario_id);
  if (ocupado) return res.status(400).json({ erro: 'Este horário já está ocupado' });

  const info = db.prepare('INSERT INTO agendamentos (usuario_id, servico_id, horario_id) VALUES (?, ?, ?)').run(
    req.session.usuario.id, servico_id, horario_id
  );
  res.json({ ok: true, id: info.lastInsertRowid });
});

app.delete('/api/agendamentos/:id', precisaLogin, (req, res) => {
  const ag = db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(req.params.id);
  if (!ag) return res.status(404).json({ erro: 'Agendamento não encontrado' });
  if (ag.usuario_id !== req.session.usuario.id && req.session.usuario.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Sem permissão' });
  }
  db.prepare('DELETE FROM agendamentos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/todos-agendamentos', precisaAdmin, (req, res) => {
  const lista = db.prepare(`
    SELECT a.*, u.nome AS cliente_nome, u.email AS cliente_email,
           s.nome AS servico_nome, h.data, h.hora
    FROM agendamentos a
    JOIN usuarios u ON u.id = a.usuario_id
    JOIN servicos s ON s.id = a.servico_id
    JOIN horarios h ON h.id = a.horario_id
    ORDER BY h.data DESC, h.hora DESC
  `).all();
  res.json(lista);
});

app.put('/api/agendamentos/:id/status', precisaAdmin, (req, res) => {
  const { status } = req.body;
  if (!['pendente', 'confirmado', 'recusado'].includes(status)) {
    return res.status(400).json({ erro: 'Status inválido' });
  }
  db.prepare('UPDATE agendamentos SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

// Servir o front
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('==================================================');
  console.log('Servidor rodando em: http://localhost:' + PORT);
  console.log('Admin: admin@admin.com | Senha: admin123');
  console.log('==================================================');
});
