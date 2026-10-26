const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const dataDir = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbFile = process.env.DB_FILE || path.join(dataDir, "restaurante.db");
const db = new Database(dbFile);

function init() {
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('customer','manager')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price_cents INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      total_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      menu_item_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price_cents INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
    );
  `);
}

function seed() {
  // Cria gerente padrão se não existir
  const managerEmail = "gerente@restaurante.com";
  const manager = db.prepare("SELECT id FROM users WHERE email = ?").get(managerEmail);
  if (!manager) {
    const hash = bcrypt.hashSync("123456", 10);
    db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'manager')")
      .run("Gerente", managerEmail, hash);
  }

  // Alguns itens iniciais do cardápio (só se estiver vazio)
  const count = db.prepare("SELECT COUNT(*) AS c FROM menu_items").get().c;
  if (count === 0) {
    const stmt = db.prepare("INSERT INTO menu_items (name, description, price_cents, is_active) VALUES (?, ?, ?, 1)");
    stmt.run("Prato do dia", "Arroz, feijão, salada e proteína", 2590);
    stmt.run("Massa alho e óleo", "Macarrão com alho e azeite", 2290);
    stmt.run("Suco natural", "Suco da fruta (300ml)", 890);
  }
}

module.exports = { db, init, seed };
