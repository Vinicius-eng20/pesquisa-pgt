const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');

const dbPath = path.resolve(__dirname, 'despesas.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados SQLite:', err.message);
  } else {
    console.log('Conectado ao banco de dados SQLite com sucesso.');
  }
});

// Inicialização das tabelas e dados padrão
db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  // Tabela de Usuários
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'user',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de Categorias
  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      color TEXT DEFAULT '#4F46E5',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de Gastos / Despesas
  db.run(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category_id INTEGER NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
    )
  `);

  // Criação do Administrador padrão caso não exista
  const checkAdmin = db.prepare('SELECT id FROM users WHERE email = ?');
  checkAdmin.get(['admin@admin.com'], (err, row) => {
    if (!row) {
      const hash = bcrypt.hashSync('admin123', 10);
      db.run(
        'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
        ['Administrador', 'admin@admin.com', hash, 'admin', 'active'],
        (insertErr) => {
          if (!insertErr) {
            console.log('Conta de administrador padrão criada: admin@admin.com / admin123');
          }
        }
      );
    }
  });

  // Categorias padrão iniciais
  const defaultCategories = [
    { name: 'Alimentação', color: '#EF4444' },
    { name: 'Moradia & Contas', color: '#3B82F6' },
    { name: 'Transporte', color: '#F59E0B' },
    { name: 'Saúde', color: '#10B981' },
    { name: 'Lazer & Cultura', color: '#8B5CF6' },
    { name: 'Educação', color: '#06B6D4' },
    { name: 'Outros', color: '#6B7280' }
  ];

  const checkCategory = db.prepare('SELECT id FROM categories WHERE name = ?');
  const insertCategory = db.prepare('INSERT INTO categories (name, color) VALUES (?, ?)');

  defaultCategories.forEach((cat) => {
    checkCategory.get([cat.name], (err, row) => {
      if (!row) {
        insertCategory.run([cat.name, cat.color]);
      }
    });
  });
});

module.exports = db;
