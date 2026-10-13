const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'dados_marketplace.sqlite'));

// Otimizações do SQLite para alta concorrência e integridade
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function inicializarBanco() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      telefone TEXT,
      bio TEXT,
      papel TEXT DEFAULT 'usuario', -- 'usuario' ou 'admin'
      suspenso INTEGER DEFAULT 0,  -- 0 = ativo, 1 = suspenso
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS servicos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      titulo TEXT NOT NULL,
      categoria TEXT NOT NULL,
      preco REAL NOT NULL,
      prazo_dias INTEGER NOT NULL,
      descricao TEXT NOT NULL,
      status TEXT DEFAULT 'pendente', -- 'pendente', 'aprovado', 'rejeitado'
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contratos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      servico_id INTEGER NOT NULL,
      cliente_id INTEGER NOT NULL,
      prestador_id INTEGER NOT NULL,
      valor REAL NOT NULL,
      detalhes_pedido TEXT,
      status TEXT DEFAULT 'em_andamento', -- 'em_andamento', 'concluido', 'cancelado'
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (servico_id) REFERENCES servicos (id) ON DELETE CASCADE,
      FOREIGN KEY (cliente_id) REFERENCES usuarios (id) ON DELETE CASCADE,
      FOREIGN KEY (prestador_id) REFERENCES usuarios (id) ON DELETE CASCADE
    );
  `);

  // Cria conta do Administrador se não existir
  const adminExiste = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@plataforma.com');
  if (!adminExiste) {
    const senhaHash = bcrypt.hashSync('admin123', 10);
    db.prepare(`
      INSERT INTO usuarios (nome, email, senha, telefone, bio, papel, suspenso)
      VALUES (?, ?, ?, ?, ?, 'admin', 0)
    `).run('Administrador do Sistema', 'admin@plataforma.com', senhaHash, '(11) 99999-0000', 'Gestão oficial da plataforma');
  }

  // Cria um usuário demo para demonstração inicial se o banco estiver vazio
  const demoExiste = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('marcos@exemplo.com');
  if (!demoExiste) {
    const senhaHashDemo = bcrypt.hashSync('123456', 10);
    const res = db.prepare(`
      INSERT INTO usuarios (nome, email, senha, telefone, bio, papel, suspenso)
      VALUES (?, ?, ?, ?, ?, 'usuario', 0)
    `).run('Marcos Designer', 'marcos@exemplo.com', senhaHashDemo, '(21) 98888-7777', 'Designer gráfico e ilustrador com 6 anos de experiência.');

    // Adiciona serviço demonstrativo aprovado
    db.prepare(`
      INSERT INTO servicos (usuario_id, titulo, categoria, preco, prazo_dias, descricao, status)
      VALUES (?, ?, ?, ?, ?, ?, 'aprovado')
    `).run(
      res.lastInsertRowid,
      'Criação de Logotipo Profissional e Identidade Visual',
      'Design',
      350.00,
      4,
      'Desenvolvo logotipos modernos, conceituais e prontos para registrar. Entrego em vetor (PDF, EPS, SVG) e imagens com fundo transparente.'
    );

    db.prepare(`
      INSERT INTO servicos (usuario_id, titulo, categoria, preco, prazo_dias, descricao, status)
      VALUES (?, ?, ?, ?, ?, ?, 'aprovado')
    `).run(
      res.lastInsertRowid,
      'Criação de Site Rápido e Responsivo',
      'Programação',
      800.00,
      7,
      'Desenvolvo seu site institucional completo, adaptado para celular, tablet e computador com formulário de contato integrado.'
    );
  }
}

inicializarBanco();

module.exports = db;
