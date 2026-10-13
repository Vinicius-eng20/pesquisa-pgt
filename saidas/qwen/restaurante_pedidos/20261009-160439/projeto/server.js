const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3000;

// ---------- Banco de dados ----------
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const db = new Database(path.join(dataDir, 'data.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('client','manager')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS dishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price REAL NOT NULL DEFAULT 0,
    category TEXT NOT NULL DEFAULT 'Geral',
    available INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    table_number TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','preparing','ready','delivered','cancelled')),
    total REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    dish_id INTEGER,
    dish_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);
`);

// ---------- Segurança: hash de senha (PBKDF2 nativo) ----------
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
}
function createSalt() {
  return crypto.randomBytes(16).toString('hex');
}
function verifyPassword(password, salt, hash) {
  const test = hashPassword(password, salt);
  try {
    return crypto.timingSafeEqual(Buffer.from(test, 'hex'), Buffer.from(hash, 'hex'));
  } catch (e) {
    return false;
  }
}

// ---------- Token de sessão ----------
const sessions = new Map(); // token -> userId
function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, userId);
  return token;
}
function getUserFromReq(req) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;
  const userId = sessions.get(token);
  if (!userId) return null;
  return db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(userId) || null;
}
function requireAuth(req, res, next) {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  req.user = user;
  next();
}
function requireManager(req, res, next) {
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
  if (user.role !== 'manager') return res.status(403).json({ error: 'Acesso apenas para gerentes.' });
  req.user = user;
  next();
}
function fail(res, message) {
  return res.status(400).json({ error: message });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Contas ----------
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !name.trim()) return fail(res, 'Informe o nome.');
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(res, 'Informe um e-mail válido.');
  if (!password || password.length < 4) return fail(res, 'A senha precisa ter pelo menos 4 caracteres.');
  const r = (role === 'manager') ? 'manager' : 'client';
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return fail(res, 'Já existe uma conta com este e-mail. Tente entrar.');
  const salt = createSalt();
  const hash = hashPassword(password, salt);
  const info = db.prepare('INSERT INTO users (name, email, password_hash, salt, role) VALUES (?,?,?,?,?)')
    .run(name.trim(), email.trim(), hash, salt, r);
  const token = createSession(info.lastInsertRowid);
  res.status(201).json({ token, user: { id: info.lastInsertRowid, name: name.trim(), email: email.trim(), role: r } });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return fail(res, 'Informe e-mail e senha.');
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim());
  if (!user || !verifyPassword(password, user.salt, user.password_hash)) {
    return fail(res, 'E-mail ou senha incorretos.');
  }
  const token = createSession(user.id);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (token) sessions.delete(token);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// ---------- Cardápio ----------
function dishAvailable(d) { return d.available === 1; }

app.get('/api/dishes', (req, res) => {
  const dishes = db.prepare('SELECT * FROM dishes ORDER BY category ASC, name ASC').all();
  res.json({ dishes });
});

app.post('/api/dishes', requireManager, (req, res) => {
  const { name, description, price, category, available } = req.body || {};
  if (!name || !name.trim()) return fail(res, 'Informe o nome do prato.');
  const p = parseFloat(price);
  if (isNaN(p) || p < 0) return fail(res, 'Informe um preço válido.');
  const cat = (category && category.trim()) ? category.trim() : 'Geral';
  const av = available ? 1 : 0;
  const info = db.prepare('INSERT INTO dishes (name, description, price, category, available) VALUES (?,?,?,?,?)')
    .run(name.trim(), description || '', p, cat, av);
  const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ dish });
});

app.put('/api/dishes/:id', requireManager, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const existing = db.prepare('SELECT * FROM dishes WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Prato não encontrado.' });
  const body = req.body || {};
  const name = (body.name !== undefined && body.name !== null && body.name !== '') ? body.name.trim() : existing.name;
  const description = body.description !== undefined ? (body.description || '') : existing.description;
  let price = existing.price;
  if (body.price !== undefined) {
    const p = parseFloat(body.price);
    if (isNaN(p) || p < 0) return fail(res, 'Informe um preço válido.');
    price = p;
  }
  const category = (body.category !== undefined && body.category !== null && body.category.trim()) ? body.category.trim() : existing.category;
  const available = body.available !== undefined ? (body.available ? 1 : 0) : existing.available;
  db.prepare('UPDATE dishes SET name=?, description=?, price=?, category=?, available=? WHERE id=?')
    .run(name, description, price, category, available, id);
  const dish = db.prepare('SELECT * FROM dishes WHERE id = ?').get(id);
  res.json({ dish });
});

app.delete('/api/dishes/:id', requireManager, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const info = db.prepare('DELETE FROM dishes WHERE id = ?').run(id);
  if (info.changes === 0) return res.status(404).json({ error: 'Prato não encontrado.' });
  res.json({ ok: true });
});

// ---------- Pedidos ----------
const VALID_STATUS = ['new', 'preparing', 'ready', 'delivered', 'cancelled'];

app.get('/api/orders/mine', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT o.*, u.name AS owner_name
    FROM orders o JOIN users u ON u.id = o.user_id
    WHERE o.user_id = ?
    ORDER BY o.created_at DESC, o.id DESC
  `).all(req.user.id);
  const itemStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC');
  rows.forEach(r => { r.items = itemStmt.all(r.id); });
  res.json({ orders: rows });
});

app.get('/api/orders/all', requireManager, (req, res) => {
  const rows = db.prepare(`
    SELECT o.*, u.name AS owner_name, u.email AS owner_email
    FROM orders o JOIN users u ON u.id = o.user_id
    ORDER BY o.created_at DESC, o.id DESC
  `).all();
  const itemStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC');
  rows.forEach(r => { r.items = itemStmt.all(r.id); });
  res.json({ orders: rows });
});

app.post('/api/orders', requireAuth, (req, res) => {
  const { items, table_number, notes } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) return fail(res, 'Seu carrinho está vazio.');

  let total = 0;
  const prepared = [];
  const insertDish = db.prepare('SELECT * FROM dishes WHERE id = ?');
  const insertItem = db.prepare('INSERT INTO order_items (order_id, dish_id, dish_name, quantity, unit_price) VALUES (?,?,?,?,?)');

  const createOrder = db.transaction(() => {
    for (const it of items) {
      const dish = insertDish.get(parseInt(it.dish_id, 10));
      if (!dish) return { error: 'Um dos itens não existe mais no cardápio. Atualize e tente de novo.' };
      if (!dishAvailable(dish)) return { error: '"' + dish.name + '" está indisponível agora.' };
      const qty = parseInt(it.quantity, 10);
      if (!qty || qty < 1) return { error: 'Quantidade inválida.' };
      total += dish.price * qty;
      prepared.push([dish.id, dish.name, qty, dish.price]);
    }
    const info = db.prepare('INSERT INTO orders (user_id, customer_name, table_number, notes, status, total) VALUES (?,?,?,?,?,?)')
      .run(req.user.id, req.user.name, table_number || '', notes || '', 'new', total);
    const orderId = info.lastInsertRowid;
    for (const [dishId, dishName, qty, unitPrice] of prepared) {
      insertItem.run(orderId, dishId, dishName, qty, unitPrice);
    }
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    return { order };
  });

  const result = createOrder();
  if (result.error) return fail(res, result.error);
  res.status(201).json({ order: result.order });
});

app.patch('/api/orders/:id/status', requireManager, (req, res) => {
  const id = parseInt(req.params.id, 10);
  const status = (req.body || {}).status;
  if (!VALID_STATUS.includes(status)) return fail(res, 'Situação inválida.');
  const info = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  if (info.changes === 0) return res.status(404).json({ error: 'Pedido não encontrado.' });
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('====================================================');
  console.log('  Sistema de Pedidos do Restaurante');
  console.log('');
  console.log('  No MESMO computador:  http://localhost:' + PORT);
  console.log('');
  console.log('  Em OUTROS aparelhos (mesma rede Wi-Fi):');
  console.log('  Descubra o IP com:  ipconfig   (Windows)  ou  ifconfig  (Mac)');
  console.log('  Depois abra: http://SEU_IP:' + PORT);
  console.log('');
  console.log('  Para parar, pressione Ctrl + C.');
  console.log('====================================================');
  console.log('');
  seedIfEmpty();
});

// ---------- Dados iniciais (só na primeira vez) ----------
function seedIfEmpty() {
  const users = db.prepare('SELECT COUNT(*) c FROM users').get().c;
  if (users === 0) {
    const salt = createSalt();
    db.prepare('INSERT INTO users (name, email, password_hash, salt, role) VALUES (?,?,?,?,?)')
      .run('Gerente', 'gerente@restaurante.com', hashPassword('123456', salt), salt, 'manager');
    console.log('Conta de gerente criada: gerente@restaurante.com / 123456');
  }
  const dishes = db.prepare('SELECT COUNT(*) c FROM dishes').get().c;
  if (dishes === 0) {
    const ins = db.prepare('INSERT INTO dishes (name, description, price, category, available) VALUES (?,?,?,?,?)');
    const data = [
      ['Picanha Grelhada', '300g de picanha com arroz, farofa e vinagrete.', 58.9, 'Pratos Principais', 1],
      ['Filé de Frango', 'Filé grelhado com batatas e legumes no vapor.', 34.9, 'Pratos Principais', 1],
      ['Massa à Bolonhesa', 'Espaguete ao molho bolonhesa com mussarela.', 39.9, 'Pratos Principais', 1],
      ['Lasanha à Milanesa', 'Lasanha com frango, presunto e queijo.', 42.5, 'Pratos Principais', 1],
      ['Feijoada Completa', 'Feijoada com arroz, couve, farofa e torresmo.', 54.9, 'Pratos Principais', 1],
      ['Salada Caprese', 'Mussarela de búfala, tomate e manjericão.', 28.9, 'Entradas', 1],
      ['Pão de Alho', 'Porção de pães de alho.', 12.9, 'Entradas', 1],
      ['Suco de Laranja', 'Suco natural 500ml.', 9.9, 'Bebidas', 1],
      ['Refrigerante Lata', 'Coca-Cola, Guaraná ou Fanta 350ml.', 6.9, 'Bebidas', 1],
      ['Água Mineral', 'Com ou sem gás, 500ml.', 4.5, 'Bebidas', 1],
      ['Cheesecake', 'Fatia de cheesecake de morango.', 14.9, 'Sobremesas', 1],
      ['Pudim', 'Fatia de pudim de leite.', 8.9, 'Sobremesas', 1]
    ];
    for (const d of data) ins.run(...d);
    console.log('Cardápio inicial criado com ' + data.length + ' pratos.');
  }
}
