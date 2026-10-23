const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

const db = new Database('loja.db');
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
    departamento TEXT NOT NULL,
    estoque INTEGER DEFAULT 0,
    imagem TEXT,
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'Pendente',
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  CREATE TABLE IF NOT EXISTS itens_pedido (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario REAL NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  );
`);

const adminExiste = db.prepare('SELECT id FROM usuarios WHERE is_admin = 1').get();
if (!adminExiste) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, is_admin) VALUES (?, ?, ?, 1)')
    .run('Administrador', 'admin@loja.com', hash);
  console.log('Admin padrão criado: admin@loja.com / admin123');
}

const clienteExiste = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('cliente@loja.com');
if (!clienteExiste) {
  const hash = bcrypt.hashSync('cliente123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, is_admin) VALUES (?, ?, ?, 0)')
    .run('Cliente Exemplo', 'cliente@loja.com', hash);
  console.log('Cliente padrão criado: cliente@loja.com / cliente123');
}

const totalProdutos = db.prepare('SELECT COUNT(*) as c FROM produtos').get().c;
if (totalProdutos === 0) {
  const ins = db.prepare('INSERT INTO produtos (nome, descricao, preco, departamento, estoque, imagem) VALUES (?, ?, ?, ?, ?, ?)');
  const iniciais = [
    ['Camiseta Básica', 'Camiseta 100% algodão, confortável para o dia a dia.', 49.90, 'Roupas', 100, '👕'],
    ['Calça Jeans', 'Calça jeans tradicional, vários tamanhos.', 129.90, 'Roupas', 50, '👖'],
    ['Tênis Esportivo', 'Tênis leve e resistente para corrida.', 199.90, 'Calçados', 40, '👟'],
    ['Sandália Verão', 'Sandália confortável para o verão.', 89.90, 'Calçados', 60, '🩴'],
    ['Smartphone X', 'Smartphone com câmera de alta resolução.', 1499.00, 'Eletrônicos', 20, '📱'],
    ['Fone Bluetooth', 'Fone sem fio com ótima qualidade de som.', 249.90, 'Eletrônicos', 80, '🎧'],
    ['Notebook Pro', 'Notebook potente para trabalho e estudo.', 3499.00, 'Eletrônicos', 15, '💻'],
    ['Liquidificador', 'Liquidificador potente para sua cozinha.', 189.90, 'Casa', 30, '🍹'],
    ['Jogo de Panelas', 'Conjunto com 5 panelas antiaderentes.', 349.90, 'Casa', 25, '🍳'],
    ['Arroz 5kg', 'Arroz tipo 1, pacote de 5kg.', 29.90, 'Alimentos', 200, '🍚'],
    ['Café 500g', 'Café torrado e moído, 500g.', 19.90, 'Alimentos', 300, '☕'],
    ['Chocolate', 'Barra de chocolate ao leite 90g.', 8.90, 'Alimentos', 500, '🍫'],
    ['Boneca', 'Boneca de pano educativa.', 79.90, 'Brinquedos', 40, '🧸'],
    ['Quebra-cabeça', 'Quebra-cabeça 500 peças.', 39.90, 'Brinquedos', 70, '🧩'],
    ['Livro Romance', 'Best-seller de romance contemporâneo.', 45.90, 'Livros', 100, '📖'],
    ['Livro Infantil', 'Livro ilustrado para crianças.', 29.90, 'Livros', 120, '📚'],
  ];
  for (const p of iniciais) ins.run(...p);
  console.log('Produtos iniciais cadastrados.');
}

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());
app.use(session({
  secret: 'segredo-loja-virtual-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function autenticado(req, res, next) {
  if (!req.session.usuario) return res.status(401).json({ erro: 'Não autenticado' });
  next();
}

function ehAdmin(req, res, next) {
  if (!req.session.usuario || !req.session.usuario.is_admin) {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

// ===== AUTH =====
app.post('/api/auth/cadastro', (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha todos os campos' });
  const existe = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (existe) return res.status(400).json({ erro: 'Email já cadastrado' });
  const hash = bcrypt.hashSync(senha, 10);
  const r = db.prepare('INSERT INTO usuarios (nome, email, senha, is_admin) VALUES (?, ?, ?, 0)')
    .run(nome, email, hash);
  req.session.usuario = { id: r.lastInsertRowid, nome, email, is_admin: 0 };
  res.json({ ok: true, usuario: req.session.usuario });
});

app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body;
  const u = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
  if (!u || !bcrypt.compareSync(senha, u.senha)) {
    return res.status(400).json({ erro: 'Email ou senha inválidos' });
  }
  req.session.usuario = { id: u.id, nome: u.nome, email: u.email, is_admin: u.is_admin };
  res.json({ ok: true, usuario: req.session.usuario });
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/auth/me', (req, res) => {
  res.json({ usuario: req.session.usuario || null });
});

// ===== PRODUTOS =====
app.get('/api/produtos', (req, res) => {
  const { departamento, busca } = req.query;
  let sql = 'SELECT * FROM produtos';
  const cond = [];
  const params = [];
  if (departamento) { cond.push('departamento = ?'); params.push(departamento); }
  if (busca) { cond.push('(nome LIKE ? OR descricao LIKE ?)'); params.push(`%${busca}%`, `%${busca}%`); }
  if (cond.length) sql += ' WHERE ' + cond.join(' AND ');
  sql += ' ORDER BY criado_em DESC';
  res.json(db.prepare(sql).all(...params));
});

app.get('/api/departamentos', (req, res) => {
  const rows = db.prepare('SELECT DISTINCT departamento FROM produtos ORDER BY departamento').all();
  res.json(rows.map(r => r.departamento));
});

app.get('/api/produtos/:id', (req, res) => {
  const p = db.prepare('SELECT * FROM produtos WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ erro: 'Produto não encontrado' });
  res.json(p);
});

app.post('/api/produtos', ehAdmin, (req, res) => {
  const { nome, descricao, preco, departamento, estoque, imagem } = req.body;
  if (!nome || !preco || !departamento) return res.status(400).json({ erro: 'Preencha nome, preço e departamento' });
  const r = db.prepare('INSERT INTO produtos (nome, descricao, preco, departamento, estoque, imagem) VALUES (?, ?, ?, ?, ?, ?)')
    .run(nome, descricao || '', Number(preco), departamento, Number(estoque) || 0, imagem || '📦');
  res.json({ ok: true, id: r.lastInsertRowid });
});

app.put('/api/produtos/:id', ehAdmin, (req, res) => {
  const { nome, descricao, preco, departamento, estoque, imagem } = req.body;
  db.prepare('UPDATE produtos SET nome=?, descricao=?, preco=?, departamento=?, estoque=?, imagem=? WHERE id=?')
    .run(nome, descricao, Number(preco), departamento, Number(estoque), imagem, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/produtos/:id', ehAdmin, (req, res) => {
  db.prepare('DELETE FROM produtos WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ===== CARRINHO (sessão) =====
function getCarrinho(req) {
  if (!req.session.carrinho) req.session.carrinho = [];
  return req.session.carrinho;
}

app.get('/api/carrinho', (req, res) => {
  const c = getCarrinho(req);
  const itens = c.map(i => {
    const p = db.prepare('SELECT * FROM produtos WHERE id = ?').get(i.produto_id);
    return p ? { ...p, quantidade: i.quantidade } : null;
  }).filter(Boolean);
  const total = itens.reduce((s, i) => s + i.preco * i.quantidade, 0);
  res.json({ itens, total });
});

app.post('/api/carrinho/adicionar', (req, res) => {
  const { produto_id, quantidade } = req.body;
  const p = db.prepare('SELECT * FROM produtos WHERE id = ?').get(produto_id);
  if (!p) return res.status(404).json({ erro: 'Produto não encontrado' });
  const c = getCarrinho(req);
  const item = c.find(i => i.produto_id === Number(produto_id));
  if (item) item.quantidade += (Number(quantidade) || 1);
  else c.push({ produto_id: Number(produto_id), quantidade: Number(quantidade) || 1 });
  res.json({ ok: true });
});

app.put('/api/carrinho/:produto_id', (req, res) => {
  const { quantidade } = req.body;
  const c = getCarrinho(req);
  const idx = c.findIndex(i => i.produto_id === Number(req.params.produto_id));
  if (idx >= 0) {
    if (Number(quantidade) <= 0) c.splice(idx, 1);
    else c[idx].quantidade = Number(quantidade);
  }
  res.json({ ok: true });
});

app.delete('/api/carrinho/:produto_id', (req, res) => {
  const c = getCarrinho(req);
  const idx = c.findIndex(i => i.produto_id === Number(req.params.produto_id));
  if (idx >= 0) c.splice(idx, 1);
  res.json({ ok: true });
});

app.delete('/api/carrinho', (req, res) => {
  req.session.carrinho = [];
  res.json({ ok: true });
});

// ===== PEDIDOS =====
app.post('/api/pedidos', autenticado, (req, res) => {
  const c = getCarrinho(req);
  if (c.length === 0) return res.status(400).json({ erro: 'Carrinho vazio' });
  const itens = c.map(i => {
    const p = db.prepare('SELECT * FROM produtos WHERE id = ?').get(i.produto_id);
    return p ? { produto: p, quantidade: i.quantidade } : null;
  }).filter(Boolean);
  const total = itens.reduce((s, i) => s + i.produto.preco * i.quantidade, 0);

  const criar = db.transaction(() => {
    const r = db.prepare('INSERT INTO pedidos (usuario_id, total, status) VALUES (?, ?, ?)')
      .run(req.session.usuario.id, total, 'Pendente');
    const pedidoId = r.lastInsertRowid;
    const ins = db.prepare('INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)');
    for (const it of itens) ins.run(pedidoId, it.produto.id, it.quantidade, it.produto.preco);
    return pedidoId;
  });
  const pedidoId = criar();
  req.session.carrinho = [];
  res.json({ ok: true, pedido_id: pedidoId });
});

app.get('/api/pedidos/meus', autenticado, (req, res) => {
  const pedidos = db.prepare('SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY criado_em DESC')
    .all(req.session.usuario.id);
  for (const p of pedidos) {
    p.itens = db.prepare(`
      SELECT ip.*, pr.nome, pr.imagem
      FROM itens_pedido ip JOIN produtos pr ON pr.id = ip.produto_id
      WHERE ip.pedido_id = ?
    `).all(p.id);
  }
  res.json(pedidos);
});

app.get('/api/pedidos', ehAdmin, (req, res) => {
  const pedidos = db.prepare(`
    SELECT p.*, u.nome as cliente_nome, u.email as cliente_email
    FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id
    ORDER BY p.criado_em DESC
  `).all();
  for (const p of pedidos) {
    p.itens = db.prepare(`
      SELECT ip.*, pr.nome, pr.imagem
      FROM itens_pedido ip JOIN produtos pr ON pr.id = ip.produto_id
      WHERE ip.pedido_id = ?
    `).all(p.id);
  }
  res.json(pedidos);
});

app.put('/api/pedidos/:id/status', ehAdmin, (req, res) => {
  const { status } = req.body;
  const validos = ['Pendente', 'Em preparo', 'Enviado', 'Entregue', 'Cancelado'];
  if (!validos.includes(status)) return res.status(400).json({ erro: 'Status inválido' });
  db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`\n🛒 Loja Virtual rodando em http://localhost:${PORT}\n`);
});
