const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Banco de dados
const db = new Database('restaurante.db');
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'cliente'
);
CREATE TABLE IF NOT EXISTS pratos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  preco REAL NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Principal',
  disponivel INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pendente',
  total REAL NOT NULL,
  criado_em TEXT NOT NULL,
  FOREIGN KEY(usuario_id) REFERENCES usuarios(id)
);
CREATE TABLE IF NOT EXISTS itens_pedido (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL,
  prato_id INTEGER NOT NULL,
  nome_prato TEXT NOT NULL,
  preco REAL NOT NULL,
  quantidade INTEGER NOT NULL,
  FOREIGN KEY(pedido_id) REFERENCES pedidos(id)
);
`);

// Gerente padrão
const gerenteExiste = db.prepare("SELECT id FROM usuarios WHERE tipo='gerente' LIMIT 1").get();
if (!gerenteExiste) {
  db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)')
    .run('Gerente', 'gerente@restaurante.com', bcrypt.hashSync('admin123', 10), 'gerente');
  console.log('Gerente criado: gerente@restaurante.com / admin123');
}

// Pratos exemplo
const qtdPratos = db.prepare('SELECT COUNT(*) as c FROM pratos').get().c;
if (qtdPratos === 0) {
  const ins = db.prepare('INSERT INTO pratos (nome, descricao, preco, categoria) VALUES (?, ?, ?, ?)');
  ins.run('Frango Grelhado', 'Frango grelhado com legumes', 32.90, 'Principal');
  ins.run('Feijoada', 'Feijoada completa com arroz e couve', 45.00, 'Principal');
  ins.run('Salada Caesar', 'Salada com frango e molho caesar', 24.50, 'Entrada');
  ins.run('Pudim de Leite', 'Pudim caseiro', 12.00, 'Sobremesa');
  ins.run('Suco Natural', 'Suco natural de laranja', 8.00, 'Bebida');
}

app.use(express.json());
app.use(session({
  secret: 'restaurante-segredo-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function requerLogin(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Faça login' });
  next();
}
function requerGerente(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Faça login' });
  if (req.session.usuario.tipo !== 'gerente') return res.status(403).json({ erro: 'Apenas gerente' });
  next();
}

// Auth
app.post('/api/cadastro', (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha todos os campos' });
  try {
    const hash = bcrypt.hashSync(senha, 10);
    const info = db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(nome, email.toLowerCase(), hash, 'cliente');
    req.session.usuario = { id: info.lastInsertRowid, nome, email: email.toLowerCase(), tipo: 'cliente' };
    res.json(req.session.usuario);
  } catch (e) {
    res.status(400).json({ erro: 'Email já cadastrado' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get((email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(senha, u.senha)) return res.status(401).json({ erro: 'Email ou senha incorretos' });
  req.session.usuario = { id: u.id, nome: u.nome, email: u.email, tipo: u.tipo };
  res.json(req.session.usuario);
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/eu', (req, res) => {
  res.json(req.session.usuario || null);
});

// Pratos
app.get('/api/pratos', (req, res) => {
  const pratos = db.prepare('SELECT * FROM pratos ORDER BY categoria, nome').all();
  res.json(pratos);
});

app.post('/api/pratos', requerGerente, (req, res) => {
  const { nome, descricao, preco, categoria, disponivel } = req.body;
  if (!nome || preco == null) return res.status(400).json({ erro: 'Nome e preço são obrigatórios' });
  const info = db.prepare('INSERT INTO pratos (nome, descricao, preco, categoria, disponivel) VALUES (?, ?, ?, ?, ?)')
    .run(nome, descricao || '', Number(preco), categoria || 'Principal', disponivel ? 1 : 1);
  res.json(db.prepare('SELECT * FROM pratos WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/pratos/:id', requerGerente, (req, res) => {
  const { nome, descricao, preco, categoria, disponivel } = req.body;
  db.prepare('UPDATE pratos SET nome=?, descricao=?, preco=?, categoria=?, disponivel=? WHERE id=?')
    .run(nome, descricao || '', Number(preco), categoria || 'Principal', disponivel ? 1 : 0, req.params.id);
  res.json(db.prepare('SELECT * FROM pratos WHERE id = ?').get(req.params.id));
});

app.delete('/api/pratos/:id', requerGerente, (req, res) => {
  db.prepare('DELETE FROM pratos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Pedidos
app.post('/api/pedidos', requerLogin, (req, res) => {
  const { itens } = req.body;
  if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ erro: 'Pedido vazio' });
  let total = 0;
  const itensFinal = [];
  for (const it of itens) {
    const prato = db.prepare('SELECT * FROM pratos WHERE id = ?').get(it.prato_id);
    if (!prato || !prato.disponivel) return res.status(400).json({ erro: 'Prato indisponível' });
    const qtd = Number(it.quantidade) || 1;
    total += prato.preco * qtd;
    itensFinal.push({ prato_id: prato.id, nome_prato: prato.nome, preco: prato.preco, quantidade: qtd });
  }
  const agora = new Date().toISOString();
  const pedidoInfo = db.prepare('INSERT INTO pedidos (usuario_id, status, total, criado_em) VALUES (?, ?, ?, ?)')
    .run(req.session.usuario.id, 'Pendente', total, agora);
  const pedidoId = pedidoInfo.lastInsertRowid;
  const insItem = db.prepare('INSERT INTO itens_pedido (pedido_id, prato_id, nome_prato, preco, quantidade) VALUES (?, ?, ?, ?, ?)');
  for (const it of itensFinal) insItem.run(pedidoId, it.prato_id, it.nome_prato, it.preco, it.quantidade);
  res.json({ id: pedidoId });
});

function pedidoCompleto(p) {
  const itens = db.prepare('SELECT * FROM itens_pedido WHERE pedido_id = ?').all(p.id);
  return { ...p, itens };
}

app.get('/api/meus-pedidos', requerLogin, (req, res) => {
  const pedidos = db.prepare('SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY id DESC').all(req.session.usuario.id);
  res.json(pedidos.map(pedidoCompleto));
});

app.get('/api/pedidos', requerGerente, (req, res) => {
  const pedidos = db.prepare(`
    SELECT p.*, u.nome as cliente_nome, u.email as cliente_email
    FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id
    ORDER BY p.id DESC
  `).all();
  res.json(pedidos.map(pedidoCompleto));
});

app.put('/api/pedidos/:id/status', requerGerente, (req, res) => {
  const { status } = req.body;
  const permitidos = ['Pendente', 'Preparando', 'Pronto', 'Entregue', 'Cancelado'];
  if (!permitidos.includes(status)) return res.status(400).json({ erro: 'Status inválido' });
  db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log('Servidor rodando em http://localhost:' + PORT);
});
