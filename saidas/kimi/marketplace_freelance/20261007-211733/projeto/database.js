const Database = require('better-sqlite3');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = process.env.DATABASE_PATH || './database.sqlite';
const db = new Database(dbPath);

// Habilitar foreign keys
db.pragma('foreign_keys = ON');

// Criar tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_admin INTEGER DEFAULT 0,
    is_suspended INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price REAL NOT NULL,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_services_user ON services(user_id);
  CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
  CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
  CREATE INDEX IF NOT EXISTS idx_contracts_provider ON contracts(provider_id);
`);

// Criar admin padrão se não existir
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@freelancehub.com');
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare(`
    INSERT INTO users (name, email, password, is_admin)
    VALUES (?, ?, ?, 1)
  `).run('Administrador', 'admin@freelancehub.com', hashedPassword);
  console.log('✓ Conta admin criada: admin@freelancehub.com / admin123');
}

module.exports = db;
