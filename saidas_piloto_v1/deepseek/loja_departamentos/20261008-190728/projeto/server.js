const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Banco de dados ----------
const db = new Database(path.join(__dirname, 'loja.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  is_admin INTEGER DEFAULT 0,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS produtos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco REAL NOT NULL,
  categoria TEXT NOT NULL,
  estoque INTEGER DEFAULT 0,
  imagem TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  total REAL NOT NULL,
  status TEXT DEFAULT 'pendente',
  endereco TEXT,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);

CREATE TABLE IF NOT EXISTS itens_pedido (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id INTEGER NOT NULL,
  produto_id INTEGER NOT NULL,
  quantidade INTEGER NOT NULL,
  preco_unitario REAL NOT NULL,
  nome_produto TEXT NOT NULL,
  FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
  FOREIGN KEY (produto_id) REFERENCES produtos(id)
);
`);

// Criar admin padrão
const adminExiste = db.prepare('SELECT id FROM usuarios WHERE is_admin = 1').get();
if (!adminExiste) {
  const senhaHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, is_admin) VALUES (?, ?, ?, 1)')
    .run('Administrador', 'admin@loja.com', senhaHash);
  console.log('Admin padrão criado: admin@loja.com / admin123');
}

// Produtos de exemplo
const qtdProdutos = db.prepare('SELECT COUNT(*) as c FROM produtos').get().c;
if (qtdProdutos === 0) {
  const inserir = db.prepare('INSERT INTO produtos (nome, descricao, preco, categoria, estoque) VALUES (?, ?, ?, ?, ?)');
  const exemplos = [
    ['Camiseta Básica', 'Camiseta de algodão confortável', 49.90, 'Roupas', 50],
    ['Tênis Esportivo', 'Tênis ideal para corridas', 199.90, 'Calçados', 30],
    ['Fone Bluetooth', 'Fone sem fio com cancelamento de ruído', 299.90, 'Eletrônicos', 20],
    ['Livro de Romance', 'Best-seller nacional', 39.90, 'Livros', 100],
    ['Panela Antiaderente', 'Panela de 24cm', 89.90, 'Casa', 40],
    ['Bola de Futebol', 'Bola oficial de campo', 129.90, 'Esportes', 25],
    ['Perfume Feminino', 'Fragrância marcante 100ml', 249.90, 'Beleza', 15],
    ['Mochila Escolar', 'Mochila resistente com vários compartimentos', 159.90, 'Acessórios', 35]
  ];
  for (const p of exemplos) inserir.run(...p);
  console.log('Produtos de exemplo criados.');
}

// ---------- Middlewares ----------
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'loja-virtual-segredo-' + Date.now(),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

// Upload de imagens
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_'))
});
const upload = multer({ storage });

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ erro: 'Faça login para continuar' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ erro: 'Faça login' });
  const u = db.prepare('SELECT is_admin FROM usuarios WHERE id = ?').get(req.session.userId);
  if (!u || !u.is_admin) return res.status(403).json({ erro: 'Acesso restrito ao administrador' });
  next();
}

// ---------- Autenticação ----------
app.post('/api/registrar', (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha todos os campos' });
  if (senha.length < 4) return res.status(400).json({ erro: 'Senha muito curta' });
  try {
    const hash = bcrypt.hashSync(senha, 10);
    const info = db.prepare('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)').run(nome, email.toLowerCase(), hash);
    req.session.userId = info.lastInsertRowid;
    res.json({ ok: true, usuario: { id: info.lastInsertRowid, nome, email, is_admin: 0 } });
  } catch (e) {
    res.status(400).json({ erro: 'E-mail já cadastrado' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get((email || '').toLowerCase());
  if (!u || !bcrypt.compareSync(senha || '', u.senha)) return res.status(401).json({ erro: 'E-mail ou senha inválidos' });
  req.session.userId = u.id;
  res.json({ ok: true, usuario: { id: u.id, nome: u.nome, email: u.email, is_admin: u.is_admin } });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/eu', (req, res) => {
  if (!req.session.userId) return res.json({ usuario: null });
  const u = db.prepare('SELECT id, nome, email, is_admin FROM usuarios WHERE id = ?').get(req.session.userId);
  res.json({ usuario: u || null });
});

// ---------- Produtos ----------
app.get('/api/produtos', (req, res) => {
  const { categoria, busca } = req.query;
  let sql = 'SELECT * FROM produtos WHERE 1=1';
  const params = [];
  if (categoria) { sql += ' AND categoria = ?'; params.push(categoria); }
  if (busca) { sql += ' AND (nome LIKE ? OR descricao LIKE ?)'; params.push('%' + busca + '%', '%' + busca + '%'); }
  sql += ' ORDER BY id DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/categorias', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT categoria FROM produtos ORDER BY categoria').all();
  res.json(rows.map(r => r.categoria));
});

app.post('/api/produtos', requireAdmin, upload.single('imagem'), (req, res) => {
  const { nome, descricao, preco, categoria, estoque } = req.body;
  if (!nome || !preco || !categoria) return res.status(400).json({ erro: 'Preencha os campos obrigatórios' });
  const imagem = req.file ? '/uploads/' + req.file.filename : null;
  const info = db.prepare('INSERT INTO produtos (nome, descricao, preco, categoria, estoque, imagem) VALUES (?, ?, ?, ?, ?, ?)')
    .run(nome, descricao || '', parseFloat(preco), categoria, parseInt(estoque) || 0, imagem);
  res.json(db.prepare('SELECT * FROM produtos WHERE id = ?').get(info.lastInsertRowid));
});

app.put('/api/produtos/:id', requireAdmin, upload.single('imagem'), (req, res) => {
  const id = req.params.id;
  const existente = db.prepare('SELECT * FROM produtos WHERE id = ?').get(id);
  if (!existente) return res.status(404).json({ erro: 'Produto não encontrado' });
  const { nome, descricao, preco, categoria, estoque } = req.body;
  const imagem = req.file ? '/uploads/' + req.file.filename : existente.imagem;
  db.prepare('UPDATE produtos SET nome=?, descricao=?, preco=?, categoria=?, estoque=?, imagem=? WHERE id=?')
    .run(nome || existente.nome, descricao ?? existente.descricao, parseFloat(preco) || existente.preco, categoria || existente.categoria, parseInt(estoque) ?? existente.estoque, imagem, id);
  res.json(db.prepare('SELECT * FROM produtos WHERE id = ?').get(id));
});

app.delete('/api/produtos/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM produtos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Pedidos ----------
app.post('/api/pedidos', requireLogin, (req, res) => {
  const { itens, endereco } = req.body;
  if (!itens || !itens.length) return res.status(400).json({ erro: 'Carrinho vazio' });
  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(req.session.userId);

  const tx = db.transaction(() => {
    let total = 0;
    const itensValidos = [];
    for (const item of itens) {
      const prod = db.prepare('SELECT * FROM produtos WHERE id = ?').get(item.produto_id);
      if (!prod) throw new Error('Produto não encontrado');
      if (prod.estoque < item.quantidade) throw new Error('Estoque insuficiente para ' + prod.nome);
      const precoUnit = prod.preco;
      total += precoUnit * item.quantidade;
      itensValidos.push({ ...item, preco_unitario: precoUnit, nome_produto: prod.nome });
    }
    const info = db.prepare('INSERT INTO pedidos (usuario_id, total, status, endereco) VALUES (?, ?, ?, ?)')
      .run(user.id, total, 'pendente', endereco || '');
    for (const it of itensValidos) {
      db.prepare('INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario, nome_produto) VALUES (?, ?, ?, ?, ?)')
        .run(info.lastInsertRowid, it.produto_id, it.quantidade, it.preco_unitario, it.nome_produto);
      db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ?').run(it.quantidade, it.produto_id);
    }
    return info.lastInsertRowid;
  });

  try {
    const pedidoId = tx();
    res.json({ ok: true, pedido_id: pedidoId });
  } catch (e) {
    res.status(400).json({ erro: e.message });
  }
});

app.get('/api/meus-pedidos', requireLogin, (req, res) => {
  const pedidos = db.prepare('SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY id DESC').all(req.session.userId);
  for (const p of pedidos) {
    p.itens = db.prepare('SELECT * FROM itens_pedido WHERE pedido_id = ?').all(p.id);
  }
  res.json(pedidos);
});

app.get('/api/admin/pedidos', requireAdmin, (req, res) => {
  const pedidos = db.prepare(`
    SELECT p.*, u.nome as cliente_nome, u.email as cliente_email
    FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id
    ORDER BY p.id DESC
  `).all();
  for (const p of pedidos) {
    p.itens = db.prepare('SELECT * FROM itens_pedido WHERE pedido_id = ?').all(p.id);
  }
  res.json(pedidos);
});

app.put('/api/admin/pedidos/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  const validos = ['pendente', 'pago', 'enviado', 'entregue', 'cancelado'];
  if (!validos.includes(status)) return res.status(400).json({ erro: 'Status inválido' });
  db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.get('/api/admin/clientes', requireAdmin, (req, res) => {
  const clientes = db.prepare('SELECT id, nome, email, criado_em FROM usuarios WHERE is_admin = 0 ORDER BY id DESC').all();
  res.json(clientes);
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('Servidor rodando na porta ' + PORT);
  console.log('Acesse: http://localhost:' + PORT);
  console.log('Admin: admin@loja.com / admin123');
});
