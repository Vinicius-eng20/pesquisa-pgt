const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, 'tarefas.db');
const db = new sqlite3.Database(dbPath);

function initDB() {
  db.serialize(() => {
    // Tabela de usuários
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('gerente', 'membro')),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tabela de tarefas
    db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'em_andamento', 'concluida')),
        priority TEXT NOT NULL DEFAULT 'media' CHECK(priority IN ('baixa', 'media', 'alta')),
        assigned_to INTEGER NOT NULL,
        created_by INTEGER NOT NULL,
        due_date TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (assigned_to) REFERENCES users(id),
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Inserir usuários padrão se não existirem
    db.get('SELECT COUNT(*) as count FROM users', (err, row) => {
      if (err) {
        console.error('Erro ao verificar usuários:', err);
        return;
      }

      if (row.count === 0) {
        const salt = bcrypt.genSaltSync(10);
        const passGerente = bcrypt.hashSync('123456', salt);
        const passAna = bcrypt.hashSync('123456', salt);
        const passBruno = bcrypt.hashSync('123456', salt);

        const insertUser = db.prepare(`
          INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)
        `);

        insertUser.run('Carlos (Gerente)', 'gerente@equipe.com', passGerente, 'gerente');
        insertUser.run('Ana Silva', 'ana@equipe.com', passAna, 'membro');
        insertUser.run('Bruno Souza', 'bruno@equipe.com', passBruno, 'membro', function (err) {
          if (!err) {
            console.log('Usuários de demonstração criados com sucesso!');
            // Criar tarefas de exemplo
            criarTarefasIniciais();
          }
        });
        insertUser.finalize();
      }
    });
  });
}

function criarTarefasIniciais() {
  const insertTask = db.prepare(`
    INSERT INTO tasks (title, description, status, priority, assigned_to, created_by, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertTask.run(
    'Revisar relatório mensal',
    'Conferir os números do mês anterior e preparar resumo para diretoria.',
    'em_andamento',
    'alta',
    2, // Ana
    1, // Carlos
    '2025-05-10'
  );

  insertTask.run(
    'Organizar arquivos do projeto',
    'Padronizar pastas e documentos no servidor compartilhado.',
    'pendente',
    'media',
    3, // Bruno
    1, // Carlos
    '2025-05-15'
  );

  insertTask.run(
    'Atualizar cadastro de fornecedores',
    'Telefonar para confirmação dos dados bancários atuais.',
    'concluida',
    'baixa',
    2, // Ana
    2, // Ana (criada por ela mesma)
    '2025-05-02'
  );

  insertTask.finalize();
}

initDB();

module.exports = db;
