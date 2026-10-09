const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Armazenamento de dados (ficam salvos em data.json) ----
const DATA_FILE = path.join(__dirname, 'data.json');

function loadDb() {
  if (fs.existsSync(DATA_FILE)) {
    try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
    catch (e) { console.error('Falha ao ler data.json, iniciando vazio.'); }
  }
  return createDefaultDb();
}

function saveDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8');
}

function createDefaultDb() {
  const passwordHash = (pass) =>
    crypto.createHash('sha256').update('sal__' + pass).digest('hex');

  const produtos = [
    { nome: 'Smartphone Galaxy S24', preco: 5999.90, categoria: 'Eletronicos', descricao: 'Smartphone 128GB, câmeras triplas, 5G, tela de 6.2 polegadas.', quantidade: 20, imagem: 'https://picsum.photos/seed/smartphone-1/400/400' },
    { nome: 'Notebook AirBook Pro 14"', preco: 4599.00, categoria: 'Eletronicos', descricao: 'Processador de alta performance, 16GB RAM, 512GB SSD.', quantidade: 15, imagem: 'https://picsum.photos/seed/notebook-1/400/400' },
    { nome: 'Fone Bluetooth SoundMax', preco: 349.90, categoria: 'Eletronicos', descricao: 'Cancelamento de ruído, 30h de bateria, à prova d\'água.', quantidade: 50, imagem: 'https://picsum.photos/seed/fone-1/400/400' },
    { nome: 'Smart TV 55" 4K', preco: 2799.90, categoria: 'Eletronicos', descricao: 'Tela 4K, HDR, com sistema de apps integrado.', quantidade: 12, imagem: 'https://picsum.photos/seed/tv-1/400/400' },
    { nome: 'Câmera Digital 24MP', preco: 1899.00, categoria: 'Eletronicos', descricao: 'Lente intercambiável, gravação 4K, estabilização.', quantidade: 8, imagem: 'https://picsum.photos/seed/camera-1/400/400' },

    { nome: 'Camiseta Fitness Dry', preco: 79.90, categoria: 'Moda', descricao: 'Tecido respirável, modelagem esportiva, unissex.', quantidade: 100, imagem: 'https://picsum.photos/seed/camiseta-1/400/400' },
    { nome: 'Tênis Runner Comfort', preco: 399.90, categoria: 'Moda', descricao: 'Amortecimento de impacto, solado leve, diversas cores.', quantidade: 60, imagem: 'https://picsum.photos/seed/tenis-1/400/400' },
    { nome: 'Jaqueta Corta-Vento', preco: 259.90, categoria: 'Moda', descricao: 'Resistente ao vento e chuva, capuz, bolsos internos.', quantidade: 40, imagem: 'https://picsum.photos/seed/jaqueta-1/400/400' },
    { nome: 'Calça Jeans Slim', preco: 189.90, categoria: 'Moda', descricao: 'Ajuste slim, 98% algodão, confortável para o dia a dia.', quantidade: 80, imagem: 'https://picsum.photos/seed/jeans-1/400/400' },
    { nome: 'Bolsa Carreira Elegance', preco: 449.90, categoria: 'Moda', descricao: 'Couro sintético de alta qualidade, compartimento para laptop.', quantidade: 30, imagem: 'https://picsum.photos/seed/bolsa-1/400/400' },

    { nome: 'Cafeteira Espresso Automática', preco: 899.90, categoria: 'Casa e Cozinha', descricao: '20 bares de pressão, 1.5L, panela de leite, 3 intensidades.', quantidade: 25, imagem: 'https://picsum.photos/seed/cafe-1/400/400' },
    { nome: 'Jogo de Panelas 10 Peças', preco: 549.90, categoria: 'Casa e Cozinha', descricao: 'Antiaderente, cabo ergonômico, indução, forno e lava-louças.', quantidade: 18, imagem: 'https://picsum.photos/seed/panelas-1/400/400' },
    { nome: 'Air Fryer 5L', preco: 499.90, categoria: 'Casa e Cozinha', descricao: 'Cozimento sem óleo, cesto removível, timer digital.', quantidade: 35, imagem: 'https://picsum.photos/seed/fritadeira-1/400/400' },
    { nome: 'Jogo de Cama Percal 400', preco: 299.90, categoria: 'Casa e Cozinha', descricao: '200x220, 4 peças, toque macio, cores elegantes.', quantidade: 55, imagem: 'https://picsum.photos/seed/jogodecama-1/400/400' },

    { nome: 'Barra Protreinadora 3mm', preco: 149.90, categoria: 'Esportes', descricao: 'Aço carbono, 3mm, pegada confortável.', quantidade: 70, imagem: 'https://picsum.photos/seed/barra-1/400/400' },
    { nome: 'Kit Halteres 20kg', preco: 349.90, categoria: 'Esportes', descricao: 'Par de halteres, 2,5kg a 10kg, revestimento emborrachado.', quantidade: 22, imagem: 'https://picsum.photos/seed/halteres-1/400/400' },
    { nome: 'Mochila de Trilha 45L', preco: 329.90, categoria: 'Esportes', descricao: 'Ajuste de costas, suporte para hidratação, resistente.', quantidade: 28, imagem: 'https://picsum.photos/seed/mochila-1/400/400' },
    { nome: 'Bicicleta Aro 29 MTB', preco: 2199.00, categoria: 'Esportes', descricao: 'Quadro de alumínio, freio a disco, 21 marchas.', quantidade: 10, imagem: 'https://picsum.photos/seed/bike-1/400/400' },

    { nome: 'Kit Skincare Completo', preco: 249.90, categoria: 'Beleza', descricao: 'Limpeza, tônico, sérum e hidratante facial.', quantidade: 45, imagem: 'https://picsum.photos/seed/skincare-1/400/400' },
    { nome: 'Perfume Elixir 100ml', preco: 499.90, categoria: 'Beleza', descricao: 'Fragrância amadeirada, longa duração, unissex.', quantidade: 40, imagem: 'https://picsum.photos/seed/perfume-1/400/400' },
    { nome: 'Maquinha de Cabelo 2200W', preco: 179.90, categoria: 'Beleza', descricao: 'Placas cerâmica, 5 temperaturas, cabo 360°.', quantidade: 50, imagem: 'https://picsum.photos/seed/secador-1/400/400' }
  ];

  const db = {
    usuarios: [
      { id: crypto.randomUUID(), nome: 'Dono da Loja', email: 'dono@loja.com', senhaHash: passwordHash('admin123'), papel: 'admin', criadoEm: new Date().toISOString() },
      { id: crypto.randomUUID(), nome: 'Cliente Exemplo', email: 'cliente@loja.com', senhaHash: passwordHash('cliente123'), papel: 'cliente', criadoEm: new Date().toISOString() }
    ],
    produtos: produtos.map((p, i) => ({ id: crypto.randomUUID(), criadoEm: new Date().toISOString(), ...p })),
    pedidos: [],
    seq: 1001
  };
  saveDb(db);
  return db;
}

let db = loadDb();

// ---- Sessões (login que persiste) ----
app.use(session({
  name: 'loja.sid',
  secret: 'segredo-central-departamentos-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 30, httpOnly: true }
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- Helpers ----
const passwordHash = (pass) =>
  crypto.createHash('sha256').update('sal__' + pass).digest('hex');

function requireAuth(req, res, next) {
  if (!req.session.usuarioId) return res.status(401).json({ erro: 'Faça login para continuar.' });
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.usuarioId) return res.status(401).json({ erro: 'Faça login para continuar.' });
  const u = db.usuarios.find(x => x.id === req.session.usuarioId);
  if (!u || u.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito ao dono da loja.' });
  next();
}

function publicUser(u) {
  return { id: u.id, nome: u.nome, email: u.email, papel: u.papel };
}

function limparSenha(prod) {
  const { imagem, ...rest } = prod;
  return rest;
}

// ---- ROTAS DE AUTENTICAÇÃO ----
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: 'Informe e-mail e senha.' });
  const u = db.usuarios.find(x => x.email.toLowerCase() === String(email).toLowerCase());
  if (!u || u.senhaHash !== passwordHash(senha))
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  req.session.usuarioId = u.id;
  saveDb(db);
  res.json(publicUser(u));
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.post('/api/cadastro', (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Preencha todos os campos.' });
  if (String(senha).length < 6) return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
  if (db.usuarios.some(x => x.email.toLowerCase() === String(email).toLowerCase()))
    return res.status(409).json({ erro: 'Este e-mail já está cadastrado.' });
  const novo = { id: crypto.randomUUID(), nome, email, senhaHash: passwordHash(senha), papel: 'cliente', criadoEm: new Date().toISOString() };
  db.usuarios.push(novo);
  saveDb(db);
  req.session.usuarioId = novo.id;
  res.json(publicUser(novo));
});

app.get('/api/usuario', requireAuth, (req, res) => {
  const u = db.usuarios.find(x => x.id === req.session.usuarioId);
  if (!u) return res.status(401).json({ erro: 'Sessão inválida.' });
  res.json(publicUser(u));
});

// ---- PRODUTOS (público) ----
app.get('/api/produtos', (req, res) => {
  res.json(db.produtos);
});

app.get('/api/produtos/:id', (req, res) => {
  const p = db.produtos.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ erro: 'Produto não encontrado.' });
  res.json(p);
});

// ---- ADMIN: PRODUTOS ----
app.get('/api/admin/produtos', requireAdmin, (req, res) => res.json(db.produtos));

app.post('/api/admin/produtos', requireAdmin, (req, res) => {
  const { nome, preco, categoria, descricao, quantidade, imagem } = req.body;
  if (!nome || preco === undefined || preco === null || preco === '') return res.status(400).json({ erro: 'Nome e preço são obrigatórios.' });
  const novo = {
    id: crypto.randomUUID(),
    nome,
    preco: Number(preco),
    categoria: categoria || 'Geral',
    descricao: descricao || '',
    quantidade: Number(quantidade) || 0,
    imagem: imagem || ('https://picsum.photos/seed/' + encodeURIComponent(nome) + '/' + 400 + '/' + 400),
    criadoEm: new Date().toISOString()
  };
  db.produtos.unshift(novo);
  saveDb(db);
  res.status(201).json(novo);
});

app.put('/api/admin/produtos/:id', requireAdmin, (req, res) => {
  const p = db.produtos.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ erro: 'Produto não encontrado.' });
  const { nome, preco, categoria, descricao, quantidade, imagem } = req.body;
  if (nome !== undefined) p.nome = nome;
  if (preco !== undefined && preco !== '') p.preco = Number(preco);
  if (categoria !== undefined) p.categoria = categoria;
  if (descricao !== undefined) p.descricao = descricao;
  if (quantidade !== undefined) p.quantidade = Number(quantidade) || 0;
  if (imagem !== undefined && imagem) p.imagem = imagem;
  saveDb(db);
  res.json(p);
});

app.delete('/api/admin/produtos/:id', requireAdmin, (req, res) => {
  const i = db.produtos.findIndex(x => x.id === req.params.id);
  if (i === -1) return res.status(404).json({ erro: 'Produto não encontrado.' });
  db.produtos.splice(i, 1);
  saveDb(db);
  res.json({ ok: true });
});

// ---- PEDIDOS (cliente) ----
app.post('/api/pedidos', requireAuth, (req, res) => {
  const { items, endereco } = req.body;
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ erro: 'Carrinho vazio.' });
  if (!endereco || !endereco.nome || !endereco.rua || !endereco.cidade)
    return res.status(400).json({ erro: 'Preencha os dados de entrega.' });

  const u = db.usuarios.find(x => x.id === req.session.usuarioId);
  let total = 0;
  const itensFinais = [];
  for (const it of items) {
    const p = db.produtos.find(x => x.id === it.id);
    if (!p) return res.status(400).json({ erro: 'Produto do carrinho não encontrado.' });
    const qtd = Math.max(1, Number(it.qtd) || 1);
    const sub = p.preco * qtd;
    total += sub;
    itensFinais.push({ produtoId: p.id, nome: p.nome, preco: p.preco, qtd, subtotal: sub, imagem: p.imagem });
  }

  const pedido = {
    id: crypto.randomUUID(),
    numero: 'PED-' + (db.seq++),
    clienteId: u.id,
    clienteNome: u.nome,
    clienteEmail: u.email,
    itens: itensFinais,
    total,
    endereco,
    status: 'Pendente',
    criadoEm: new Date().toISOString()
  };
  db.pedidos.unshift(pedido);
  saveDb(db);
  res.status(201).json(pedido);
});

app.get('/api/pedidos', requireAuth, (req, res) => {
  const meus = db.pedidos.filter(p => p.clienteId === req.session.usuarioId);
  res.json(meus);
});

// ---- ADMIN: PEDIDOS ----
app.get('/api/admin/pedidos', requireAdmin, (req, res) => res.json(db.pedidos));

app.put('/api/admin/pedidos/:id/status', requireAdmin, (req, res) => {
  const p = db.pedidos.find(x => x.id === req.params.id);
  if (!p) return res.status(404).json({ erro: 'Pedido não encontrado.' });
  const { status } = req.body;
  const validos = ['Pendente', 'Pago', 'Em preparo', 'Enviado', 'Entregue', 'Cancelado'];
  if (!validos.includes(status)) return res.status(400).json({ erro: 'Status inválido.' });
  p.status = status;
  saveDb(db);
  res.json(p);
});

app.listen(PORT, () => {
  console.log('');
  console.log('==================================================');
  console.log('  CENTRAL DEPARTAMENTOS - Loja online pronta!');
  console.log('==================================================');
  console.log('  No seu computador:  http://localhost:' + PORT);
  console.log('');
  console.log('  Contas prontas para usar:');
  console.log('    DONO DA LOJA :  dono@loja.com    /  admin123');
  console.log('    CLIENTE      :  cliente@loja.com /  cliente123');
  console.log('==================================================');
  console.log('');
  console.log('  Para colocar na internet, use o comando "ver na internet" do');
  console.log('  README ou um serviço gratuito. Veja o README.md.');
  console.log('');
});
