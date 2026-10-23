const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const db = new Database("database.sqlite");

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('customer', 'manager')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dishes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  available INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Recebido',
  total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  dish_id INTEGER,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (dish_id) REFERENCES dishes(id) ON DELETE SET NULL
);
`);

const manager = db.prepare("SELECT id FROM users WHERE role = 'manager' LIMIT 1").get();

if (!manager) {
  const hash = bcrypt.hashSync("gerente123", 10);
  db.prepare(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ('Gerente', 'gerente@restaurante.com', ?, 'manager')`
  ).run(hash);
}

const dishCount = db.prepare("SELECT COUNT(*) AS count FROM dishes").get().count;

if (dishCount === 0) {
  const insert = db.prepare(
    `INSERT INTO dishes (name, description, price, available)
     VALUES (?, ?, ?, 1)`
  );

  insert.run("Prato Executivo", "Arroz, feijão, bife, salada e batata frita.", 29.9);
  insert.run("Frango Grelhado", "Frango grelhado com legumes e arroz.", 27.5);
  insert.run("Lasanha à Bolonhesa", "Lasanha com molho bolonhesa e queijo gratinado.", 34.9);
  insert.run("Suco Natural", "Suco natural da fruta.", 8.9);
}

module.exports = db;
