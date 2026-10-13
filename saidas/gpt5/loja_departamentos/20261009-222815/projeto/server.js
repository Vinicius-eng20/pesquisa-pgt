const express = require('express');
const session = require('express-session');
const SQLiteStoreFactory = require('connect-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const methodOverride = require('method-override');
const db = require('./src/db');

const app = express();
const SQLiteStore = SQLiteStoreFactory(session);

const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  store: new SQLiteStore({
    db: 'sessions.sqlite',
    dir: __dirname
  }),
  secret: process.env.SESSION_SECRET || 'troque-esta-chave-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30
  }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.cartCount = 0;

  if (req.session.user) {
    const count = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) AS total
      FROM cart_items
      WHERE user_id = ?
    `).get(req.session.user.id);
    res.locals.cartCount = count.total || 0;
  }

  next();
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      message: 'Acesso negado.'
    });
  }
  next();
}

function money(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

app.locals.money = money;

app.get('/', (req, res) => {
  const search = (req.query.search || '').trim();
  const category = (req.query.category || '').trim();

  let sql = 'SELECT * FROM products WHERE active = 1';
  const params = [];

  if (search) {
    sql += ' AND (name LIKE ? OR description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }

  sql += ' ORDER BY created_at DESC';

  const products = db.prepare(sql).all(...params);
  const categories = db.prepare(`
    SELECT DISTINCT category
    FROM products
    WHERE active = 1 AND category IS NOT NULL AND category != ''
    ORDER BY category
  `).all();

  res.render('home', {
    products,
    categories,
    search,
    category
  });
});

app.get('/register', (req, res) => {
  res.render('register', {
    error: null,
    name: '',
    email: ''
  });
});

app.post('/register', (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  if (!name || !email || password.length < 6) {
    return res.render('register', {
      error: 'Informe nome, email e senha com pelo menos 6 caracteres.',
      name,
      email
    });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) {
    return res.render('register', {
      error: 'Este email já está cadastrado.',
      name,
      email
    });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, 'customer')
  `).run(name, email, hash);

  req.session.user = {
    id: result.lastInsertRowid,
    name,
    email,
    role: 'customer'
  };

  res.redirect('/');
});

app.get('/login', (req, res) => {
  res.render('login', {
    error: null,
    email: ''
  });
});

app.post('/login', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.render('login', {
      error: 'Email ou senha inválidos.',
      email
    });
  }

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };

  res.redirect('/');
});

app.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.post('/cart/add/:id', requireLogin, (req, res) => {
  const productId = Number(req.params.id);
  const quantity = Math.max(1, Number(req.body.quantity || 1));

  const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(productId);
  if (!product) {
    return res.redirect('/');
  }

  const existing = db.prepare(`
    SELECT * FROM cart_items
    WHERE user_id = ? AND product_id = ?
  `).get(req.session.user.id, productId);

  if (existing) {
    db.prepare(`
      UPDATE cart_items
      SET quantity = quantity + ?
      WHERE id = ?
    `).run(quantity, existing.id);
  } else {
    db.prepare(`
      INSERT INTO cart_items (user_id, product_id, quantity)
      VALUES (?, ?, ?)
    `).run(req.session.user.id, productId, quantity);
  }

  res.redirect('/cart');
});

app.get('/cart', requireLogin, (req, res) => {
  const items = db.prepare(`
    SELECT cart_items.*, products.name, products.price, products.image_url, products.stock
    FROM cart_items
    JOIN products ON products.id = cart_items.product_id
    WHERE cart_items.user_id = ?
    ORDER BY cart_items.id DESC
  `).all(req.session.user.id);

  let total = 0;
  items.forEach(item => {
    item.subtotal = item.quantity * item.price;
    total += item.subtotal;
  });

  res.render('cart', { items, total, error: null });
});

app.post('/cart/update/:id', requireLogin, (req, res) => {
  const itemId = Number(req.params.id);
  const quantity = Math.max(1, Number(req.body.quantity || 1));

  db.prepare(`
    UPDATE cart_items
    SET quantity = ?
    WHERE id = ? AND user_id = ?
  `).run(quantity, itemId, req.session.user.id);

  res.redirect('/cart');
});

app.post('/cart/remove/:id', requireLogin, (req, res) => {
  db.prepare(`
    DELETE FROM cart_items
    WHERE id = ? AND user_id = ?
  `).run(Number(req.params.id), req.session.user.id);

  res.redirect('/cart');
});

app.post('/checkout', requireLogin, (req, res) => {
  const items = db.prepare(`
    SELECT cart_items.*, products.name, products.price, products.stock, products.active
    FROM cart_items
    JOIN products ON products.id = cart_items.product_id
    WHERE cart_items.user_id = ?
  `).all(req.session.user.id);

  if (items.length === 0) {
    return res.redirect('/cart');
  }

  for (const item of items) {
    if (!item.active || item.quantity > item.stock) {
      let total = 0;
      items.forEach(i => {
        i.subtotal = i.quantity * i.price;
        total += i.subtotal;
      });

      return res.render('cart', {
        items,
        total,
        error: `Produto "${item.name}" indisponível ou com estoque insuficiente.`
      });
    }
  }

  const transaction = db.transaction(() => {
    let total = 0;
    items.forEach(item => {
      total += item.quantity * item.price;
    });

    const order = db.prepare(`
      INSERT INTO orders (user_id, total, status)
      VALUES (?, ?, 'Recebido')
    `).run(req.session.user.id, total);

    for (const item of items) {
      db.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, price, quantity)
        VALUES (?, ?, ?, ?, ?)
      `).run(order.lastInsertRowid, item.product_id, item.name, item.price, item.quantity);

      db.prepare(`
        UPDATE products
        SET stock = stock - ?
        WHERE id = ?
      `).run(item.quantity, item.product_id);
    }

    db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.session.user.id);

    return order.lastInsertRowid;
  });

  const orderId = transaction();
  res.redirect(`/orders/${orderId}`);
});

app.get('/orders', requireLogin, (req, res) => {
  const orders = db.prepare(`
    SELECT *
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).all(req.session.user.id);

  res.render('orders', { orders });
});

app.get('/orders/:id', requireLogin, (req, res) => {
  const order = db.prepare(`
    SELECT orders.*, users.name AS customer_name, users.email AS customer_email
    FROM orders
    JOIN users ON users.id = orders.user_id
    WHERE orders.id = ?
  `).get(Number(req.params.id));

  if (!order) {
    return res.status(404).render('error', { message: 'Pedido não encontrado.' });
  }

  if (req.session.user.role !== 'admin' && order.user_id !== req.session.user.id) {
    return res.status(403).render('error', { message: 'Acesso negado.' });
  }

  const items = db.prepare(`
    SELECT *
    FROM order_items
    WHERE order_id = ?
  `).all(order.id);

  res.render('order-detail', { order, items });
});

app.get('/admin', requireAdmin, (req, res) => {
  res.redirect('/admin/products');
});

app.get('/admin/products', requireAdmin, (req, res) => {
  const products = db.prepare(`
    SELECT *
    FROM products
    ORDER BY created_at DESC
  `).all();

  res.render('admin-products', { products });
});

app.get('/admin/products/new', requireAdmin, (req, res) => {
  res.render('admin-product-form', {
    product: null,
    error: null,
    action: '/admin/products'
  });
});

app.post('/admin/products', requireAdmin, (req, res) => {
  const product = {
    name: (req.body.name || '').trim(),
    description: (req.body.description || '').trim(),
    category: (req.body.category || '').trim(),
    price: Number(req.body.price || 0),
    stock: Number(req.body.stock || 0),
    image_url: (req.body.image_url || '').trim()
  };

  if (!product.name || product.price < 0 || product.stock < 0) {
    return res.render('admin-product-form', {
      product,
      error: 'Informe nome, preço e estoque válidos.',
      action: '/admin/products'
    });
  }

  db.prepare(`
    INSERT INTO products (name, description, category, price, stock, image_url, active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `).run(product.name, product.description, product.category, product.price, product.stock, product.image_url);

  res.redirect('/admin/products');
});

app.get('/admin/products/:id/edit', requireAdmin, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(Number(req.params.id));

  if (!product) {
    return res.status(404).render('error', { message: 'Produto não encontrado.' });
  }

  res.render('admin-product-form', {
    product,
    error: null,
    action: `/admin/products/${product.id}`
  });
});

app.post('/admin/products/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);

  const product = {
    id,
    name: (req.body.name || '').trim(),
    description: (req.body.description || '').trim(),
    category: (req.body.category || '').trim(),
    price: Number(req.body.price || 0),
    stock: Number(req.body.stock || 0),
    image_url: (req.body.image_url || '').trim(),
    active: req.body.active ? 1 : 0
  };

  if (!product.name || product.price < 0 || product.stock < 0) {
    return res.render('admin-product-form', {
      product,
      error: 'Informe nome, preço e estoque válidos.',
      action: `/admin/products/${id}`
    });
  }

  db.prepare(`
    UPDATE products
    SET name = ?, description = ?, category = ?, price = ?, stock = ?, image_url = ?, active = ?
    WHERE id = ?
  `).run(
    product.name,
    product.description,
    product.category,
    product.price,
    product.stock,
    product.image_url,
    product.active,
    id
  );

  res.redirect('/admin/products');
});

app.post('/admin/products/:id/delete', requireAdmin, (req, res) => {
  db.prepare(`
    UPDATE products
    SET active = 0
    WHERE id = ?
  `).run(Number(req.params.id));

  res.redirect('/admin/products');
});

app.get('/admin/orders', requireAdmin, (req, res) => {
  const orders = db.prepare(`
    SELECT orders.*, users.name AS customer_name, users.email AS customer_email
    FROM orders
    JOIN users ON users.id = orders.user_id
    ORDER BY orders.created_at DESC
  `).all();

  res.render('admin-orders', { orders });
});

app.post('/admin/orders/:id/status', requireAdmin, (req, res) => {
  const status = req.body.status || 'Recebido';

  const allowed = [
    'Recebido',
    'Em separação',
    'Enviado',
    'Entregue',
    'Cancelado'
  ];

  if (allowed.includes(status)) {
    db.prepare(`
      UPDATE orders
      SET status = ?
      WHERE id = ?
    `).run(status, Number(req.params.id));
  }

  res.redirect('/admin/orders');
});

app.use((req, res) => {
  res.status(404).render('error', {
    message: 'Página não encontrada.'
  });
});

app.listen(PORT, () => {
  console.log(`Loja rodando em http://localhost:${PORT}`);
});
