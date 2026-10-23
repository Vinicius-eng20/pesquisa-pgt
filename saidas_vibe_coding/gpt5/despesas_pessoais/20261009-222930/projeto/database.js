const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const db = new Database("database.sqlite");

db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  description TEXT NOT NULL,
  amount INTEGER NOT NULL,
  expense_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(category_id) REFERENCES categories(id)
);
`);

function seed() {
  const admin = db.prepare("SELECT id FROM users WHERE email = ?").get("admin@admin.com");

  if (!admin) {
    const passwordHash = bcrypt.hashSync("admin123", 10);
    db.prepare(`
      INSERT INTO users (name, email, password_hash, role, active)
      VALUES (?, ?, ?, ?, ?)
    `).run("Administrador", "admin@admin.com", passwordHash, "admin", 1);
  }

  const categoryCount = db.prepare("SELECT COUNT(*) AS total FROM categories").get().total;

  if (categoryCount === 0) {
    const insert = db.prepare("INSERT INTO categories (name, active) VALUES (?, 1)");
    ["Alimentação", "Transporte", "Moradia", "Saúde", "Educação", "Lazer", "Contas", "Outros"].forEach((name) => {
      insert.run(name);
    });
  }
}

seed();

module.exports = db;
