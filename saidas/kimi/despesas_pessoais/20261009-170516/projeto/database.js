const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath);

// Criar tabelas
db.serialize(() => {
    // Tabela de usuários
    db.run(`
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            senha TEXT NOT NULL,
            isAdmin INTEGER DEFAULT 0,
            ativo INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de categorias
    db.run(`
        CREATE TABLE IF NOT EXISTS categorias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL,
            cor TEXT DEFAULT '#007bff',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Tabela de despesas
    db.run(`
        CREATE TABLE IF NOT EXISTS despesas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            categoria_id INTEGER NOT NULL,
            descricao TEXT NOT NULL,
            valor REAL NOT NULL,
            data DATE NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
            FOREIGN KEY (categoria_id) REFERENCES categorias(id)
        )
    `);

    // Inserir categorias padrão
    const categoriasPadrao = [
        ['Alimentação', '#ff6b6b'],
        ['Transporte', '#4ecdc4'],
        ['Moradia', '#45b7d1'],
        ['Saúde', '#f9ca24'],
        ['Educação', '#6c5ce7'],
        ['Lazer', '#a29bfe'],
        ['Outros', '#95afc0']
    ];

    const stmt = db.prepare('INSERT OR IGNORE INTO categorias (nome, cor) VALUES (?, ?)');
    categoriasPadrao.forEach(cat => stmt.run(cat));
    stmt.finalize();

    console.log('✅ Banco de dados inicializado');
});

module.exports = db;
```

```json
