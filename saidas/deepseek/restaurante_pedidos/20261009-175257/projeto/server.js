const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'troque-este-segredo-em-producao-restaurante-xyz';

app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

function gerarToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, nome: user.nome }, JWT_SECRET, {
    expiresIn: '30d'
  });
}

function auth(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ erro: 'Não autenticado' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    return res.status(401).json({ erro: 'Sessão inválida' });
  }
}

function soGerente(req, res, next) {
  if (req.user.role !== 'gerente') return res.status(403).json({ erro: 'Acesso restrito ao gerente' });
  next();
}

// ---------- AUTENTICAÇÃO ----------
app.post('/api/registrar', (req, res) => {
  const { nome, email, senha, role } = req.body || {};
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha nome, email e senha' });
  if (senha.length < 4) return res.status(400).json({ erro: 'Senha muito curta' });

  const existente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.toLowerCase());
  if (existente) return res.status(400).json({ erro: 'Este email já está cadastrado' });

  // Só permite criar gerente se não existir nenhum gerente ainda
  let userRole = 'cliente';
  if (role === 'gerente') {
    const existeGerente = db.prepare("SELECT id FROM usuarios WHERE role='gerente'").get();
    if (existeGerente) return res.status(403).json({ erro: 'Já existe um gerente cadastrado' });
    userRole = 'gerente';
  }

  const hash = bcrypt.hashSync(senha, 10);
  const info = db.prepare('INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)')
    .run(nome, email.toLowerCase(), hash, userRole);

  const user = { id: info.lastInsertRowid, nome, email: email.toLowerCase(), role: userRole };
  const token = gerarToken(user);
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ ok: true, user });
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body || {};
  if (!email || !senha) return res.status(400).json({ erro: 'Preencha email e senha' });
  const user = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ erro: 'Email ou senha incorretos' });
  if (!bcrypt.compareSync(senha, user.senha)) return res.status(401).json({ erro: 'Email ou senha incorretos' });

  const token = gerarToken(user);
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  res.json({ ok: true, user: { id: user.id, nome: user.nome, email: user.email, role: user.role } });
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

app.get('/api/eu', auth, (req, res) => {
  res.json({ user: req.user });
});

// ---------- CARDÁPIO ----------
app.get('/api/pratos', (req, res) => {
  const pratos = db.prepare('SELECT * FROM pratos ORDER BY nome').all();
  res.json(pratos);
});

app.post('/api/pratos', auth, soGerente, (req, res) => {
  const { nome, descricao, preco } = req.body || {};
  if (!nome || preco == null) return res.status(400).json({ erro: 'Nome e preço são obrigatórios' });
  const info = db.prepare('INSERT INTO pratos (nome, descricao, preco) VALUES (?, ?, ?)')
    .run(nome, descricao || '', Number(preco));
  const prato = db.prepare('SELECT * FROM pratos WHERE id = ?').get(info.lastInsertRowid);
  res.json(prato);
});

app.put('/api/pratos/:id', auth, soGerente, (req, res) => {
  const { nome, descricao, preco } = req.body || {};
  const id = Number(req.params.id);
  const existe = db.prepare('SELECT id FROM pratos WHERE id = ?').get(id);
  if (!existe) return res.status(404).json({ erro: 'Prato não encontrado' });
  db.prepare('UPDATE pratos SET nome = ?, descricao = ?, preco = ? WHERE id = ?')
    .run(nome, descricao || '', Number(preco), id);
  res.json(db.prepare('SELECT * FROM pratos WHERE id = ?').get(id));
});

app.delete('/api/pratos/:id', auth, soGerente, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM pratos WHERE id = ?').run(id);
  res.json({ ok: true });
});

// ---------- PEDIDOS ----------
app.post('/api/pedidos', auth, (req, res) => {
  const { itens } = req.body || {};
  if (!Array.isArray(itens) || itens.length === 0) return res.status(400).json({ erro: 'Pedido vazio' });

  const itensValidos = [];
  let total = 0;
  for (const it of itens) {
    const prato = db.prepare('SELECT * FROM pratos WHERE id = ?').get(Number(it.prato_id));
    const qtd = Math.max(1, parseInt(it.quantidade) || 1);
    if (!prato) continue;
    itensValidos.push({ prato_id: prato.id, nome: prato.nome, preco: prato.preco, quantidade: qtd });
    total += prato.preco * qtd;
  }
  if (itensValidos.length === 0) return res.status(400).json({ erro: 'Nenhum prato válido' });

  const info = db.prepare('INSERT INTO pedidos (usuario_id, total, status, itens) VALUES (?, ?, ?, ?)')
    .run(req.user.id, total, 'recebido', JSON.stringify(itensValidos));

  res.json({ ok: true, pedidoId: info.lastInsertRowid });
});

app.get('/api/meus-pedidos', auth, (req, res) => {
  const pedidos = db.prepare('SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY id DESC').all(req.user.id);
  res.json(pedidos.map(p => ({ ...p, itens: JSON.parse(p.itens) })));
});

app.get('/api/pedidos', auth, soGerente, (req, res) => {
  const pedidos = db.prepare(`
    SELECT p.*, u.nome AS cliente_nome, u.email AS cliente_email
    FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id
    ORDER BY p.id DESC
  `).all();
  res.json(pedidos.map(p => ({ ...p, itens: JSON.parse(p.itens) })));
});

app.put('/api/pedidos/:id/status', auth, soGerente, (req, res) => {
  const { status } = req.body || {};
  const validos = ['recebido', 'em_preparo', 'pronto', 'entregue', 'cancelado'];
  if (!validos.includes(status)) return res.status(400).json({ erro: 'Status inválido' });
  const id = Number(req.params.id);
  const existe = db.prepare('SELECT id FROM pedidos WHERE id = ?').get(id);
  if (!existe) return res.status(404).json({ erro: 'Pedido não encontrado' });
  db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(status, id);
  res.json({ ok: true });
});

// ---------- FALLBACK ----------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
