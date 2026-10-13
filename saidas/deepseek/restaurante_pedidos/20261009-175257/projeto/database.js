const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'restaurante.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  senha TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cliente',
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pratos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  descricao TEXT,
  preco REAL NOT NULL,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER NOT NULL,
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'recebido',
  itens TEXT NOT NULL,
  criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
);
`);

// Cria gerente inicial se não existir
const existeGerente = db.prepare("SELECT id FROM usuarios WHERE role='gerente'").get();
if (!existeGerente) {
  const hash = bcrypt.hashSync('gerente123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, role) VALUES (?, ?, ?, ?)')
    .run('Gerente', 'gerente@restaurante.com', hash, 'gerente');
  console.log('Gerente criado: gerente@restaurante.com / gerente123');
}

// Cria alguns pratos de exemplo se o cardápio estiver vazio
const totalPratos = db.prepare('SELECT COUNT(*) AS n FROM pratos').get().n;
if (totalPratos === 0) {
  const inserir = db.prepare('INSERT INTO pratos (nome, descricao, preco) VALUES (?, ?, ?)');
  inserir.run('Pizza Margherita', 'Molho de tomate, mussarela e manjericão', 38.90);
  inserir.run('Lasanha Bolonhesa', 'Lasanha caseira com molho de carne', 45.00);
  inserir.run('Salada Caesar', 'Alface, croutons, parmesão e molho caesar', 28.50);
  inserir.run('Filé com Fritas', 'Filé mignon grelhado com batatas fritas', 62.00);
  inserir.run('Refrigerante', 'Lata 350ml', 6.00);
  inserir.run('Suco Natural', 'Laranja, limão ou maracujá', 9.00);
}

module.exports = db;
