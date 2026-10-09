const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = __dirname;
const DB_FILE = path.join(DATA_DIR, 'data.json');
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'restaurante-troque-este-segredo';
const TOKEN_TTL = '12h';

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/* ============================================================
   Persistência (arquivo data.json)
   ============================================================ */
let db = { accounts: [], dishes: [], orders: [] };
let saveTimer = null;

function loadDb() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      db = Object.assign({ accounts: [], dishes: [], orders: [] }, parsed);
    }
  } catch (e) {
    console.error('Erro ao carregar dados:', e.message);
  }
}

function saveDb() {
  try {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error('Erro ao salvar dados:', e.message);
  }
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveDb();
  }, 250);
}

function genId() {
  return crypto.randomBytes(8).toString('hex');
}

/* ============================================================
   Dados iniciais (primeira execução)
   ============================================================ */
function seed() {
  if (db.accounts.length === 0) {
    const gerentePass = bcrypt.hashSync('1234', SALT_ROUNDS);
    const clientePass = bcrypt.hashSync('1234', SALT_ROUNDS);
    db.accounts.push({
      id: genId(),
      name: 'Gerente',
      email: 'gerente@restaurante.com',
      passwordHash: gerentePass,
      role: 'gerente',
      createdAt: Date.now()
    });
    db.accounts.push({
      id: genId(),
      name: 'Cliente',
      email: 'cliente@restaurante.com',
      passwordHash: clientePass,
      role: 'cliente',
      createdAt: Date.now()
    });
  }

  if (db.dishes.length === 0) {
    const categorias = ['Entradas', 'Principais', 'Bebidas', 'Sobremesas'];
    db.dishes = [
      { id: genId(), name: 'Bolinho de Costela', description: 'Bolinho crocante recheado de costela desfiada', price: 28, category: 'Entradas', available: true, createdAt: Date.now() },
      { id: genId(), name: 'Pão de Alho', description: 'Pão de alho amanteigado grelhado na chapa', price: 14, category: 'Entradas', available: true, createdAt: Date.now() },
      { id: genId(), name: 'Feijoada', description: 'Feijoada completa com couve, laranja e farofa', price: 52, category: 'Principais', available: true, createdAt: Date.now() },
      { id: genId(), name: 'Bife de Costela', description: 'Bife grelhado com arroz, feijão e fritas', price: 58, category: 'Principais', available: true, createdAt: Date.now() },
      { id: genId(), name: 'Frango Grelhado', description: 'Sobrecoxa grelhada com arroz, vinagrete e purê', price: 42, category: 'Principais', available: true, createdAt: Date.now() },
      { id: genId(), name: 'Refrigerante', description: 'Lata 350ml', price: 8, category: 'Bebidas', available: true, createdAt: Date.now() },
      { id: genId(), name: 'Suco Natural', description: 'Laranja, limão ou abacaxi (500ml)', price: 12, category: 'Bebidas', available: true, createdAt: Date.now() },
      { id: genId(), name: 'Pudim', description: 'Pudim de leite condensado com calda de caramelo', price: 16, category: 'Sobremesas', available: true, createdAt: Date.now() }
    ];
    saveDb();
  }
}

/* ============================================================
   Autenticação
   ============================================================ */
function readToken(req) {
  const cookieToken = req.cookies && req.cookies.token;
  const header = req.headers['authorization'];
  if (cookieToken) return cookieToken;
  if (header && header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

function getCurrentUser(req) {
  const token = readToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return db.accounts.find(a => a.id === payload.id) || null;
  } catch (e) {
    return null;
  }
}

function signToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function publicUser(user) {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function requireAuth(req, res, next) {
  const user = getCurrentUser(req);
  if (!user) {
    res.status(401).json({ error: 'Não autenticado. Faça login.' });
    return;
  }
  req.user = user;
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Você não tem permissão para essa ação.' });
      return;
    }
    next();
  };
}

/* ============================================================
   Rotas de autenticação
   ============================================================ */
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!name || !cleanEmail || !password) {
    return res.status(400).json({ error: 'Preencha nome, e-mail e senha.' });
  }
  if (password.length < 4) {
    return res.status(400).json({ error: 'A senha precisa ter pelo menos 4 caracteres.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'E-mail inválido.' });
  }
  if (db.accounts.some(a => a.email.toLowerCase() === cleanEmail)) {
    return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });
  }

  const user = {
    id: genId(),
    name: name.trim(),
    email: cleanEmail,
    passwordHash: bcrypt.hashSync(password, SALT_ROUNDS),
    role: 'cliente',
    createdAt: Date.now()
  };
  db.accounts.push(user);
  scheduleSave();

  const token = signToken(user);
  res.cookie('token', token, { httpOnly: true, maxAge: 12 * 60 * 60 * 1000, sameSite: 'lax' });
  res.status(201).json({ user: publicUser(user), token });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = (email || '').trim().toLowerCase();
  const user = db.accounts.find(a => a.email.toLowerCase() === cleanEmail);
  if (!user) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  const ok = bcrypt.compareSync(password || '', user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  const token = signToken(user);
  res.cookie('token', token, { httpOnly: true, maxAge: 12 * 60 * 60 * 1000, sameSite: 'lax' });
  res.json({ user: publicUser(user), token });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ ok: true });
});

/* ============================================================
   Cardápio
   ============================================================ */
app.get('/api/dishes', (req, res) => {
  res.json(db.dishes);
});

app.post('/api/dishes', requireAuth, requireRole(['gerente']), (req, res) => {
  const { name, description, price, category, available } = req.body || {};
  if (!name || name.trim() === '') {
    return res.status(400).json({ error: 'O nome do prato é obrigatório.' });
  }
  const p = Number(price);
  if (isNaN(p) || p < 0) {
    return res.status(400).json({ error: 'Preço inválido.' });
  }
  const dish = {
    id: genId(),
    name: name.trim(),
    description: (description || '').trim(),
    price: p,
    category: (category || 'Outros').trim() || 'Outros',
    available: available !== false,
    createdAt: Date.now()
  };
  db.dishes.push(dish);
  scheduleSave();
  res.status(201).json(dish);
});

app.put('/api/dishes/:id', requireAuth, requireRole(['gerente']), (req, res) => {
  const dish = db.dishes.find(d => d.id === req.params.id);
  if (!dish) return res.status(404).json({ error: 'Prato não encontrado.' });
  const { name, description, price, category, available } = req.body || {};
  if (name !== undefined && name.trim() === '') {
    return res.status(400).json({ error: 'O nome do prato é obrigatório.' });
  }
  if (name !== undefined) dish.name = name.trim();
  if (description !== undefined) dish.description = description.trim();
  if (price !== undefined) {
    const p = Number(price);
    if (isNaN(p) || p < 0) return res.status(400).json({ error: 'Preço inválido.' });
    dish.price = p;
  }
  if (category !== undefined) dish.category = category.trim() || 'Outros';
  if (available !== undefined) dish.available = !!available;
  scheduleSave();
  res.json(dish);
});

app.delete('/api/dishes/:id', requireAuth, requireRole(['gerente']), (req, res) => {
  const idx = db.dishes.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Prato não encontrado.' });
  db.dishes.splice(idx, 1);
  scheduleSave();
  res.json({ ok: true });
});

/* ============================================================
   Pedidos
   ============================================================ */
const SITUACOES = ['novo', 'preparando', 'pronto', 'entregue', 'cancelado'];
const SITUACAO_LABEL = {
  novo: 'Novo',
  preparando: 'Em preparo',
  pronto: 'Pronto',
  entregue: 'Entregue',
  cancelado: 'Cancelado'
};

function serializeOrder(order) {
  return {
    id: order.id,
    items: order.items,
    situation: order.situation,
    total: order.total,
    note: order.note,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    history: order.history
  };
}

app.get('/api/orders', requireAuth, (req, res) => {
  let orders = db.orders;
  if (req.user.role === 'gerente') {
    orders = orders.slice().sort((a, b) => b.createdAt - a.createdAt);
  } else {
    orders = orders
      .filter(o => o.customerId === req.user.id)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
  res.json(orders.map(serializeOrder));
});

app.post('/api/orders', requireAuth, (req, res) => {
  const { items, note } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Seu carrinho está vazio.' });
  }

  const serializedItems = [];
  let total = 0;
  for (const it of items) {
    const dish = db.dishes.find(d => d.id === it.dishId);
    if (!dish) {
      return res.status(400).json({ error: 'Um dos itens do carrinho não é mais válido.' });
    }
    const qty = Math.max(1, parseInt(it.qty, 10) || 1);
    const subtotal = dish.price * qty;
    total += subtotal;
    serializedItems.push({
      dishId: dish.id,
      name: dish.name,
      price: dish.price,
      qty: qty,
      subtotal: subtotal
    });
  }

  const order = {
    id: genId(),
    customerId: req.user.id,
    customerName: req.user.name,
    customerEmail: req.user.email,
    items: serializedItems,
    situation: 'novo',
    total: total,
    note: (note || '').trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    history: [
      { situation: 'novo', at: Date.now(), by: req.user.name }
    ]
  };
  db.orders.push(order);
  scheduleSave();
  res.status(201).json(serializeOrder(order));
});

app.put('/api/orders/:id/situation', requireAuth, requireRole(['gerente']), (req, res) => {
  const order = db.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: 'Pedido não encontrado.' });
  const { situation } = req.body || {};
  if (!SITUACOES.includes(situation)) {
    return res.status(400).json({ error: 'Situação inválida.' });
  }
  order.situation = situation;
  order.updatedAt = Date.now();
  order.history.push({
    situation: situation,
    at: Date.now(),
    by: req.user.name
  });
  scheduleSave();
  res.json(serializeOrder(order));
});

/* ============================================================
   SPA fallback
   ============================================================ */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicializa e sobe
loadDb();
seed();
saveDb();

app.listen(PORT, () => {
  console.log(`\n🍽️  Restaurante pronto em: http://localhost:${PORT}\n`);
  console.log('Contas iniciais (troque-as pela interface):');
  console.log('  Gerente : gerente@restaurante.com / 1234');
  console.log('  Cliente : cliente@restaurante.com / 1234\n');
});
