const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const db = new Database('database.sqlite');

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    price REAL NOT NULL DEFAULT 0,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cart_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, product_id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(product_id) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Recebido',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER,
    product_name TEXT NOT NULL,
    price REAL NOT NULL,
    quantity INTEGER NOT NULL,
    FOREIGN KEY(order_id) REFERENCES orders(id)
  );
`);

const admin = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@loja.com');

if (!admin) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run('Dono da Loja', 'admin@loja.com', hash, 'admin');
}

const productCount = db.prepare('SELECT COUNT(*) AS total FROM products').get().total;

if (productCount === 0) {
  const insert = db.prepare(`
    INSERT INTO products (name, description, category, price, stock, image_url, active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);

  insert.run(
    'Smartphone Max 128GB',
    'Celular moderno com boa câmera, tela grande e ótimo desempenho.',
    'Eletrônicos',
    1499.90,
    20,
    'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=800'
  );

  insert.run(
    'Notebook Home Office',
    'Notebook ideal para estudos, trabalho e navegação na internet.',
    'Informática',
    2899.00,
    10,
    'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=800'
  );

  insert.run(
    'Cafeteira Elétrica',
    'Cafeteira prática para preparar café fresco todos os dias.',
    'Casa',
    189.90,
    30,
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800'
  );

  insert.run(
    'Tênis Esportivo',
    'Tênis confortável para caminhada, academia e uso diário.',
    'Moda',
    249.90,
    25,
    'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800'
  );

  insert.run(
    'Livro de Receitas',
    'Livro com receitas simples para almoço, jantar e sobremesas.',
    'Livros',
    59.90,
    40,
    'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800'
  );

  insert.run(
    'Fone Bluetooth',
    'Fone sem fio com boa bateria e som de qualidade.',
    'Eletrônicos',
    129.90,
    35,
    'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800'
  );
}

module.exports = db;
