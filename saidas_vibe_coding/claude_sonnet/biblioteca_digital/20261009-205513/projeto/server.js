const express = require('express');
const session = require('express-session');
const SqliteStore = require('connect-sqlite3')(session);
const bcrypt = require('bcrypt');
const path = require('path');
const Database = require('better-sqlite3');

const app = express();
const PORT = 3000;

// Configurar banco de dados
const db = new Database('biblioteca.db');
db.pragma('journal_mode = WAL');

// Criar tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('leitor', 'bibliotecario')),
    bloqueado INTEGER DEFAULT 0,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS itens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    autor TEXT NOT NULL,
    tipo TEXT NOT NULL,
    ano INTEGER,
    isbn TEXT,
    descricao TEXT,
    quantidade_total INTEGER DEFAULT 1,
    quantidade_disponivel INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS emprestimos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    data_emprestimo DATETIME DEFAULT CURRENT_TIMESTAMP,
    data_devolucao_prevista DATETIME NOT NULL,
    data_devolucao_real DATETIME,
    status TEXT DEFAULT 'ativo' CHECK(status IN ('ativo', 'devolvido', 'atrasado')),
    FOREIGN KEY (usuario_id) REFERENCES usuarios (id),
    FOREIGN KEY (item_id) REFERENCES itens (id)
  );

  CREATE INDEX IF NOT EXISTS idx_emprestimos_usuario ON emprestimos(usuario_id);
  CREATE INDEX IF NOT EXISTS idx_emprestimos_item ON emprestimos(item_id);
  CREATE INDEX IF NOT EXISTS idx_emprestimos_status ON emprestimos(status);
`);

// Criar usuários padrão se não existirem
const checkAdmin = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@biblioteca.com');
if (!checkAdmin) {
  const senhaHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(
    'Administrador',
    'admin@biblioteca.com',
    senhaHash,
    'bibliotecario'
  );
}

const checkLeitor = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('leitor@exemplo.com');
if (!checkLeitor) {
  const senhaHash = bcrypt.hashSync('leitor123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(
    'Leitor Exemplo',
    'leitor@exemplo.com',
    senhaHash,
    'leitor'
  );
}

// Adicionar alguns itens de exemplo se não existirem
const checkItens = db.prepare('SELECT COUNT(*) as count FROM itens').get();
if (checkItens.count === 0) {
  const inserirItem = db.prepare(`
    INSERT INTO itens (titulo, autor, tipo, ano, isbn, descricao, quantidade_total, quantidade_disponivel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  inserirItem.run(
    'Dom Casmurro',
    'Machado de Assis',
    'Livro',
    1899,
    '978-8508040407',
    'Romance clássico da literatura brasileira',
    3,
    3
  );

  inserirItem.run(
    'O Pequeno Príncipe',
    'Antoine de Saint-Exupéry',
    'Livro',
    1943,
    '978-8522008731',
    'Conto poético sobre amizade e valores humanos',
    5,
    5
  );

  inserirItem.run(
    'Revista National Geographic - Edição Amazônia',
    'National Geographic',
    'Revista',
    2023,
    null,
    'Edição especial sobre a Amazônia',
    2,
    2
  );

  inserirItem.run(
    '1984',
    'George Orwell',
    'Livro',
    1949,
    '978-8535914849',
    'Distopia sobre totalitarismo e vigilância',
    4,
    4
  );
}

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  store: new SqliteStore({
    db: 'sessions.db',
    dir: '.'
  }),
  secret: 'biblioteca-digital-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
  }
}));

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  next();
}

function requireBibliotecario(req, res, next) {
  if (!req.session.userId || req.session.userTipo !== 'bibliotecario') {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

// Rotas de autenticação
app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;

  const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);

  if (!usuario || !bcrypt.compareSync(senha, usuario.senha)) {
    return res.status(401).json({ erro: 'Email ou senha inválidos' });
  }

  req.session.userId = usuario.id;
  req.session.userNome = usuario.nome;
  req.session.userTipo = usuario.tipo;
  req.session.userBloqueado = usuario.bloqueado;

  res.json({
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    tipo: usuario.tipo,
    bloqueado: usuario.bloqueado
  });
});

app.post('/api/registrar', (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }

  const usuarioExiste = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
  if (usuarioExiste) {
    return res.status(400).json({ erro: 'Email já cadastrado' });
  }

  const senhaHash = bcrypt.hashSync(senha, 10);

  try {
    const result = db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(
      nome,
      email,
      senhaHash,
      'leitor'
    );

    req.session.userId = result.lastInsertRowid;
    req.session.userNome = nome;
    req.session.userTipo = 'leitor';
    req.session.userBloqueado = 0;

    res.json({
      id: result.lastInsertRowid,
      nome,
      email,
      tipo: 'leitor',
      bloqueado: 0
    });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao registrar usuário' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ sucesso: true });
});

app.get('/api/usuario-atual', requireAuth, (req, res) => {
  const usuario = db.prepare('SELECT id, nome, email, tipo, bloqueado FROM usuarios WHERE id = ?').get(req.session.userId);
  res.json(usuario);
});

// Rotas de itens
app.get('/api/itens', requireAuth, (req, res) => {
  const { busca } = req.query;
  let query = 'SELECT * FROM itens';
  let params = [];

  if (busca) {
    query += ' WHERE titulo LIKE ? OR autor LIKE ? OR tipo LIKE ?';
    const buscaParam = `%${busca}%`;
    params = [buscaParam, buscaParam, buscaParam];
  }

  query += ' ORDER BY titulo';

  const itens = db.prepare(query).all(...params);
  res.json(itens);
});

app.get('/api/itens/:id', requireAuth, (req, res) => {
  const item = db.prepare('SELECT * FROM itens WHERE id = ?').get(req.params.id);
  if (!item) {
    return res.status(404).json({ erro: 'Item não encontrado' });
  }
  res.json(item);
});

app.post('/api/itens', requireBibliotecario, (req, res) => {
  const { titulo, autor, tipo, ano, isbn, descricao, quantidade_total } = req.body;

  if (!titulo || !autor || !tipo || !quantidade_total) {
    return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO itens (titulo, autor, tipo, ano, isbn, descricao, quantidade_total, quantidade_disponivel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(titulo, autor, tipo, ano || null, isbn || null, descricao || null, quantidade_total, quantidade_total);

    const item = db.prepare('SELECT * FROM itens WHERE id = ?').get(result.lastInsertRowid);
    res.json(item);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao cadastrar item' });
  }
});

app.put('/api/itens/:id', requireBibliotecario, (req, res) => {
  const { titulo, autor, tipo, ano, isbn, descricao, quantidade_total } = req.body;
  const itemId = req.params.id;

  const itemAtual = db.prepare('SELECT * FROM itens WHERE id = ?').get(itemId);
  if (!itemAtual) {
    return res.status(404).json({ erro: 'Item não encontrado' });
  }

  const emprestimosAtivos = db.prepare('SELECT COUNT(*) as count FROM emprestimos WHERE item_id = ? AND status = ?')
    .get(itemId, 'ativo').count;

  const novaQuantidadeDisponivel = quantidade_total - emprestimosAtivos;

  if (novaQuantidadeDisponivel < 0) {
    return res.status(400).json({ erro: 'Quantidade total não pode ser menor que empréstimos ativos' });
  }

  try {
    db.prepare(`
      UPDATE itens
      SET titulo = ?, autor = ?, tipo = ?, ano = ?, isbn = ?, descricao = ?,
          quantidade_total = ?, quantidade_disponivel = ?
      WHERE id = ?
    `).run(titulo, autor, tipo, ano || null, isbn || null, descricao || null, quantidade_total, novaQuantidadeDisponivel, itemId);

    const item = db.prepare('SELECT * FROM itens WHERE id = ?').get(itemId);
    res.json(item);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar item' });
  }
});

app.delete('/api/itens/:id', requireBibliotecario, (req, res) => {
  const itemId = req.params.id;

  const emprestimosAtivos = db.prepare('SELECT COUNT(*) as count FROM emprestimos WHERE item_id = ? AND status = ?')
    .get(itemId, 'ativo').count;

  if (emprestimosAtivos > 0) {
    return res.status(400).json({ erro: 'Não é possível remover item com empréstimos ativos' });
  }

  try {
    db.prepare('DELETE FROM itens WHERE id = ?').run(itemId);
    res.json({ sucesso: true });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao remover item' });
  }
});

// Rotas de empréstimos
app.get('/api/emprestimos/meus', requireAuth, (req, res) => {
  const emprestimos = db.prepare(`
    SELECT e.*, i.titulo, i.autor, i.tipo, u.nome as usuario_nome
    FROM emprestimos e
    JOIN itens i ON e.item_id = i.id
    JOIN usuarios u ON e.usuario_id = u.id
    WHERE e.usuario_id = ?
    ORDER BY e.data_emprestimo DESC
  `).all(req.session.userId);

  // Atualizar status de atrasados
  const hoje = new Date().toISOString();
  emprestimos.forEach(emp => {
    if (emp.status === 'ativo' && emp.data_devolucao_prevista < hoje) {
      db.prepare('UPDATE emprestimos SET status = ? WHERE id = ?').run('atrasado', emp.id);
      emp.status = 'atrasado';
    }
  });

  res.json(emprestimos);
});

app.get('/api/emprestimos/todos', requireBibliotecario, (req, res) => {
  const emprestimos = db.prepare(`
    SELECT e.*, i.titulo, i.autor, i.tipo, u.nome as usuario_nome, u.email as usuario_email
    FROM emprestimos e
    JOIN itens i ON e.item_id = i.id
    JOIN usuarios u ON e.usuario_id = u.id
    ORDER BY e.data_emprestimo DESC
  `).all();

  // Atualizar status de atrasados
  const hoje = new Date().toISOString();
  emprestimos.forEach(emp => {
    if (emp.status === 'ativo' && emp.data_devolucao_prevista < hoje) {
      db.prepare('UPDATE emprestimos SET status = ? WHERE id = ?').run('atrasado', emp.id);
      emp.status = 'atrasado';
    }
  });

  res.json(emprestimos);
});

app.post('/api/emprestimos', requireAuth, (req, res) => {
  const { item_id } = req.body;
  const usuario_id = req.session.userId;

  // Verificar se usuário está bloqueado
  const usuario = db.prepare('SELECT bloqueado FROM usuarios WHERE id = ?').get(usuario_id);
  if (usuario.bloqueado) {
    return res.status(403).json({ erro: 'Usuário bloqueado. Entre em contato com a biblioteca.' });
  }

  // Verificar disponibilidade
  const item = db.prepare('SELECT * FROM itens WHERE id = ?').get(item_id);
  if (!item || item.quantidade_disponivel <= 0) {
    return res.status(400).json({ erro: 'Item não disponível para empréstimo' });
  }

  // Verificar se já tem empréstimo ativo deste item
  const emprestimoExistente = db.prepare(
    'SELECT id FROM emprestimos WHERE usuario_id = ? AND item_id = ? AND status = ?'
  ).get(usuario_id, item_id, 'ativo');

  if (emprestimoExistente) {
    return res.status(400).json({ erro: 'Você já possui este item emprestado' });
  }

  // Data de devolução: 14 dias
  const dataDevolucao = new Date();
  dataDevolucao.setDate(dataDevolucao.getDate() + 14);

  try {
    const result = db.prepare(`
      INSERT INTO emprestimos (usuario_id, item_id, data_devolucao_prevista)
      VALUES (?, ?, ?)
    `).run(usuario_id, item_id, dataDevolucao.toISOString());

    db.prepare('UPDATE itens SET quantidade_disponivel = quantidade_disponivel - 1 WHERE id = ?').run(item_id);

    const emprestimo = db.prepare(`
      SELECT e.*, i.titulo, i.autor, i.tipo
      FROM emprestimos e
      JOIN itens i ON e.item_id = i.id
      WHERE e.id = ?
    `).get(result.lastInsertRowid);

    res.json(emprestimo);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao realizar empréstimo' });
  }
});

app.post('/api/emprestimos/:id/devolver', requireAuth, (req, res) => {
  const emprestimoId = req.params.id;
  const usuario_id = req.session.userId;

  const emprestimo = db.prepare('SELECT * FROM emprestimos WHERE id = ?').get(emprestimoId);

  if (!emprestimo) {
    return res.status(404).json({ erro: 'Empréstimo não encontrado' });
  }

  if (emprestimo.usuario_id !== usuario_id && req.session.userTipo !== 'bibliotecario') {
    return res.status(403).json({ erro: 'Sem permissão para devolver este empréstimo' });
  }

  if (emprestimo.status === 'devolvido') {
    return res.status(400).json({ erro: 'Item já foi devolvido' });
  }

  try {
    const dataAtual = new Date().toISOString();

    db.prepare(`
      UPDATE emprestimos
      SET status = 'devolvido', data_devolucao_real = ?
      WHERE id = ?
    `).run(dataAtual, emprestimoId);

    db.prepare('UPDATE itens SET quantidade_disponivel = quantidade_disponivel + 1 WHERE id = ?')
      .run(emprestimo.item_id);

    const emprestimoAtualizado = db.prepare(`
      SELECT e.*, i.titulo, i.autor, i.tipo
      FROM emprestimos e
      JOIN itens i ON e.item_id = i.id
      WHERE e.id = ?
    `).get(emprestimoId);

    res.json(emprestimoAtualizado);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao devolver item' });
  }
});

// Rotas de gerenciamento de usuários (bibliotecário)
app.get('/api/usuarios', requireBibliotecario, (req, res) => {
  const usuarios = db.prepare(`
    SELECT u.id, u.nome, u.email, u.tipo, u.bloqueado, u.criado_em,
           COUNT(CASE WHEN e.status = 'atrasado' THEN 1 END) as emprestimos_atrasados
    FROM usuarios u
    LEFT JOIN emprestimos e ON u.id = e.usuario_id
    WHERE u.tipo = 'leitor'
    GROUP BY u.id
    ORDER BY u.nome
  `).all();

  res.json(usuarios);
});

app.post('/api/usuarios/:id/bloquear', requireBibliotecario, (req, res) => {
  const usuarioId = req.params.id;
  const { bloqueado } = req.body;

  try {
    db.prepare('UPDATE usuarios SET bloqueado = ? WHERE id = ?').run(bloqueado ? 1 : 0, usuarioId);
    const usuario = db.prepare('SELECT id, nome, email, tipo, bloqueado FROM usuarios WHERE id = ?').get(usuarioId);
    res.json(usuario);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar usuário' });
  }
});

// Servir página HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`Biblioteca Digital rodando!`);
  console.log(`Acesse: http://localhost:${PORT}`);
  console.log(`===========================================\n`);
  console.log(`Contas padrão:\n`);
  console.log(`Bibliotecário:`);
  console.log(`  Email: admin@biblioteca.com`);
  console.log(`  Senha: admin123\n`);
  console.log(`Leitor:`);
  console.log(`  Email: leitor@exemplo.com`);
  console.log(`  Senha: leitor123\n`);
  console.log(`===========================================\n`);
});
