const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

/* ---------------- Banco de dados simples em arquivo ---------------- */
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'db.json');

const defaultDB = {
  nextId: 1,
  users: [{
    id: 1,
    username: 'admin',
    name: 'Administrador',
    passwordHash: hashPassword('admin123'),
    role: 'admin'
  }],
  products: [
    { id: 1, name: 'Smartphone Galaxy A55 5G', category: 'Eletrônicos', description: 'Tela 6,6" Super AMOLED, 8GB RAM, 256GB, câmera tripla de 50MP.', price: 1899.90, stock: 20, image: '📱' },
    { id: 2, name: 'Notebook Dell Inspiron 15', category: 'Eletrônicos', description: 'Intel Core i5, 16GB RAM, SSD 512GB, Windows 11.', price: 3499.00, stock: 10, image: '💻' },
    { id: 3, name: 'Fone de Ouvido Bluetooth X12', category: 'Eletrônicos', description: 'Cancelamento de ruído, 30h de bateria, à prova d\u2019água.', price: 349.90, stock: 40, image: '🎧' },
    { id: 4, name: 'Smart TV 55" 4K UHD', category: 'Eletrônicos', description: 'Tecnologia QLED, Dolby Vision, 3 HDMI, Wi-Fi 6.', price: 2799.00, stock: 8, image: '📺' },
    { id: 5, name: 'Cafeteira Espresso Automática', category: 'Cozinha', description: 'Moinho integrado, 15 barras, espumador de leite.', price: 1299.00, stock: 12, image: '☕' },
    { id: 6, name: 'Air Fryer 5L Digital', category: 'Cozinha', description: 'Painel digital, 8 funções, capacidade para 4 pessoas.', price: 549.90, stock: 25, image: '🍟' },
    { id: 7, name: 'Kit de Panelas Antiaderente 5 pçs', category: 'Cozinha', description: 'Antiaderente premium, compatível com fogão a indução.', price: 399.00, stock: 30, image: '🍳' },
    { id: 8, name: 'Camiseta Masculina Básica', category: 'Moda', description: '100% algodão, modelagem regular, cores variadas.', price: 59.90, stock: 100, image: '👕' },
    { id: 9, name: 'Tênis Esportivo Runner', category: 'Moda', description: 'Amortecimento responsivo, cabedal respirável.', price: 299.90, stock: 50, image: '👟' },
    { id: 10, name: 'Bolsa Feminina em Couro', category: 'Moda', description: 'Couro legítimo, alça de ombro, múltiplos compartimentos.', price: 449.00, stock: 15, image: '👜' },
    { id: 11, name: 'Kit de Maquiagem Profissional', category: 'Beleza', description: 'Base, pó, paleta de sombras e 6 batons.', price: 219.90, stock: 35, image: '💄' },
    { id: 12, name: 'Perfume Importado 100ml', category: 'Beleza', description: 'Fragrância amadeirada, fixação prolongada.', price: 389.00, stock: 22, image: '🧴' },
    { id: 13, name: 'Bola de Futebol Oficial', category: 'Esportes', description: 'Tamanho 5, costura termocolada, aprovada para competições.', price: 179.90, stock: 40, image: '⚽' },
    { id: 14, name: 'Halteres Ajustáveis (2 x 20kg)', category: 'Esportes', description: 'Par de halteres com discos removíveis, acabamento antiderrapante.', price: 699.00, stock: 14, image: '🏋️' },
    { id: 15, name: 'Livro - Dom Casmurro', category: 'Livros', description: 'Edição ilustrada, capricho editorial, capa dura.', price: 49.90, stock: 60, image: '📚' },
    { id: 16, name: 'Mochila Antifurto USB', category: 'Livros', description: 'Compartimento acolchoado para notebook, porta USB, à prova de chuva.', price: 259.00, stock: 28, image: '🎒' },
    { id: 17, name: 'Robô Aspirador a Vácuo', category: 'Lar', description: 'Mapeamento a laser, controlado pelo app, 180 minutos de bateria.', price: 2199.00, stock: 9, image: '🤖' },
    { id: 18, name: 'Colchão Ortopédico Casal', category: 'Lar', description: 'Densidade D-33, 45cm de altura, proteção de memória.', price: 1499.00, stock: 11, image: '🛏️' },
    { id: 19, name: 'Jogo de Cama 4 pçs Percal 400', category: 'Lar', description: 'Fio perfumado, toque aveludado, cores neutras.', price: 329.00, stock: 20, image: '🛌' },
    { id: 20, name: 'Kit Brinquedo de Montar 1000 peças', category: 'Infantil', description: 'Peças compatíveis, estímulos criativos, idades 8+.', price: 199.90, stock: 33, image: '🧸' }
  ],
  orders: []
};

function hashPassword(pw) {
  return crypto.createHash('sha256').update(String(pw)).digest('hex');
}

let db;
function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      if (!db.products) db.products = [];
      if (!db.orders) db.orders = [];
      if (!db.users) db.users = [];
      if (!db.nextId) db.nextId = 1;
    } else {
      fs.mkdirSync(DB_DIR, { recursive: true });
      db = defaultDB;
      saveDB();
    }
  } catch (e) {
    console.error('Erro ao carregar banco, usando padrão:', e.message);
    db = defaultDB;
  }
}
function saveDB() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}
loadDB();

function newId() {
  const id = db.nextId++;
  saveDB();
  return id;
}

/* ---------------- Autenticação ---------------- */
function createToken(user) {
  return crypto.createHmac('sha256', 'mega-mall-secret').update(String(user.id)).digest('hex');
}
function getUserFromToken(token) {
  if (!token) return null;
  return db.users.find(u => createToken(u) === token) || null;
}
function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const user = getUserFromToken(token);
  if (!user) return res.status(401).json({ error: 'Não autenticado' });
  req.user = user;
  next();
}
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito ao lojista' });
  next();
}

/* ---------------- Conta do usuário ---------------- */
app.post('/api/auth/register', (req, res) => {
  const { username, name, password } = req.body || {};
  if (!username || !name || !password) return res.status(400).json({ error: 'Preencha nome, usuário e senha.' });
  if (String(username).trim().length < 3) return res.status(400).json({ error: 'O usuário deve ter ao menos 3 caracteres.' });
  if (String(password).length < 4) return res.status(400).json({ error: 'A senha deve ter ao menos 4 caracteres.' });
  if (db.users.some(u => u.username.toLowerCase() === String(username).trim().toLowerCase()))
    return res.status(409).json({ error: 'Este usuário já existe.' });

  const id = newId();
  const user = { id, username: String(username).trim(), name: String(name).trim(), passwordHash: hashPassword(password), role: 'cliente' };
  db.users.push(user);
  saveDB();
  res.json({ token: createToken(user), user: publicUser(user) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.users.find(u => u.username.toLowerCase() === String(username || '').trim().toLowerCase());
  if (!user || user.passwordHash !== hashPassword(password))
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  res.json({ token: createToken(user), user: publicUser(user) });
});

function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role };
}

/* ---------------- Produtos ---------------- */
app.get('/api/products', (req, res) => {
  res.json(db.products);
});

app.post('/api/products', requireAuth, requireAdmin, (req, res) => {
  const { name, category, description, price, stock, image } = req.body || {};
  if (!name || !category) return res.status(400).json({ error: 'Nome e categoria são obrigatórios.' });
  const id = newId();
  const product = {
    id,
    name: String(name).trim(),
    category: String(category).trim(),
    description: String(description || '').trim(),
    price: Math.max(0, Number(price) || 0),
    stock: Math.max(0, Math.floor(Number(stock) || 0)),
    image: String(image || '').trim() || '🛍️'
  };
  db.products.push(product);
  saveDB();
  res.json(product);
});

app.put('/api/products/:id', requireAuth, requireAdmin, (req, res) => {
  const product = db.products.find(p => p.id === Number(req.params.id));
  if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
  const b = req.body || {};
  if (b.name !== undefined) product.name = String(b.name).trim();
  if (b.category !== undefined) product.category = String(b.category).trim();
  if (b.description !== undefined) product.description = String(b.description).trim();
  if (b.price !== undefined) product.price = Math.max(0, Number(b.price) || 0);
  if (b.stock !== undefined) product.stock = Math.max(0, Math.floor(Number(b.stock) || 0));
  if (b.image !== undefined) product.image = String(b.image).trim() || '🛍️';
  saveDB();
  res.json(product);
});

app.delete('/api/products/:id', requireAuth, requireAdmin, (req, res) => {
  const before = db.products.length;
  db.products = db.products.filter(p => p.id !== Number(req.params.id));
  if (db.products.length === before) return res.status(404).json({ error: 'Produto não encontrado.' });
  saveDB();
  res.json({ ok: true });
});

/* ---------------- Pedidos ---------------- */
const STATUSES = ['pendente', 'processando', 'enviado', 'entregue', 'cancelado'];

app.get('/api/orders', requireAuth, (req, res) => {
  if (req.user.role === 'admin') {
    res.json(db.orders);
  } else {
    res.json(db.orders.filter(o => o.userId === req.user.id));
  }
});

app.get('/api/orders/:id', requireAuth, (req, res) => {
  const order = db.orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
  if (order.userId !== req.user.id && req.user.role !== 'admin')
    return res.status(403).json({ error: 'Você não pode ver este pedido.' });
  res.json(order);
});

app.post('/api/orders', requireAuth, (req, res) => {
  const { items, customer } = req.body || {};
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'O carrinho está vazio.' });

  const finalItems = [];
  let total = 0;
  for (const it of items) {
    const product = db.products.find(p => p.id === Number(it.productId));
    const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
    if (!product) return res.status(400).json({ error: 'Um dos produtos não existe mais.' });
    if (product.stock < qty)
      return res.status(400).json({ error: `Estoque insuficiente para "${product.name}".` });
    finalItems.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: qty
    });
    total += product.price * qty;
    product.stock -= qty;
  }

  const id = newId();
  const order = {
    id,
    code: 'MM-' + String(id).padStart(5, '0'),
    userId: req.user.id,
    customer: {
      name: String(customer?.name || req.user.name || 'Cliente'),
      email: String(customer?.email || ''),
      phone: String(customer?.phone || ''),
      address: String(customer?.address || '')
    },
    payment: String(customer?.payment || 'cartao'),
    items: finalItems,
    total: Math.round(total * 100) / 100,
    status: 'pendente',
    createdAt: new Date().toISOString()
  };
  db.orders.unshift(order);
  saveDB();
  res.json(order);
});

app.patch('/api/orders/:id/status', requireAuth, requireAdmin, (req, res) => {
  const order = db.orders.find(o => o.id === Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
  const status = String(req.body?.status || '');
  if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Situação inválida.' });

  const canceling = order.status !== 'cancelado' && status === 'cancelado';
  order.status = status;
  if (canceling) {
    for (const it of order.items) {
      const product = db.products.find(p => p.id === it.productId);
      if (product) product.stock += it.quantity;
    }
  }
  saveDB();
  res.json(order);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('-----------------------------------------------------');
  console.log('  Loja no ar! Acesse: http://localhost:' + PORT);
  console.log('  Login do lojista (padrão): admin / admin123');
  console.log('-----------------------------------------------------');
});
