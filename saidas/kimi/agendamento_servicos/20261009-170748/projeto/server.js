const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-mude-em-producao';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Banco de dados
const db = new sqlite3.Database('./agendamento.db', (err) => {
  if (err) console.error(err);
  else console.log('Banco de dados conectado');
});

// Criar tabelas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'cliente',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS servicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    duracao INTEGER NOT NULL,
    preco REAL NOT NULL,
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS horarios_disponiveis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    data TEXT NOT NULL,
    hora TEXT NOT NULL,
    disponivel INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(data, hora)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    servico_id INTEGER NOT NULL,
    data TEXT NOT NULL,
    hora TEXT NOT NULL,
    status TEXT DEFAULT 'pendente',
    observacoes TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES usuarios(id),
    FOREIGN KEY (servico_id) REFERENCES servicos(id)
  )`);

  // Criar usuário admin padrão
  const senhaHash = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO usuarios (id, nome, email, senha, tipo) 
    VALUES (1, 'Administrador', 'admin@admin.com', ?, 'admin')`, [senhaHash]);
});

// Middleware de autenticação
function autenticar(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ erro: 'Token não fornecido' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ erro: 'Token inválido' });
    req.usuario = decoded;
    next();
  });
}

function ehAdmin(req, res, next) {
  if (req.usuario.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

// ========== ROTAS DE AUTENTICAÇÃO ==========

app.post('/api/registro', async (req, res) => {
  const { nome, email, senha } = req.body;
  
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Preencha todos os campos' });
  }

  const senhaHash = bcrypt.hashSync(senha, 10);

  db.run('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)',
    [nome, email, senhaHash],
    function(err) {
      if (err) {
        return res.status(400).json({ erro: 'Email já cadastrado' });
      }
      res.json({ mensagem: 'Conta criada com sucesso', id: this.lastID });
    }
  );
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;

  db.get('SELECT * FROM usuarios WHERE email = ?', [email], (err, usuario) => {
    if (err || !usuario) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    if (!bcrypt.compareSync(senha, usuario.senha)) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, tipo: usuario.tipo },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      token, 
      usuario: { 
        id: usuario.id, 
        nome: usuario.nome, 
        email: usuario.email, 
        tipo: usuario.tipo 
      } 
    });
  });
});

// ========== ROTAS DE SERVIÇOS ==========

app.get('/api/servicos', autenticar, (req, res) => {
  db.all('SELECT * FROM servicos WHERE ativo = 1 ORDER BY nome', [], (err, servicos) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(servicos);
  });
});

app.get('/api/servicos/todos', autenticar, ehAdmin, (req, res) => {
  db.all('SELECT * FROM servicos ORDER BY nome', [], (err, servicos) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(servicos);
  });
});

app.post('/api/servicos', autenticar, ehAdmin, (req, res) => {
  const { nome, descricao, duracao, preco } = req.body;

  db.run('INSERT INTO servicos (nome, descricao, duracao, preco) VALUES (?, ?, ?, ?)',
    [nome, descricao, duracao, preco],
    function(err) {
      if (err) return res.status(500).json({ erro: err.message });
      res.json({ id: this.lastID, mensagem: 'Serviço criado com sucesso' });
    }
  );
});

app.put('/api/servicos/:id', autenticar, ehAdmin, (req, res) => {
  const { nome, descricao, duracao, preco, ativo } = req.body;

  db.run('UPDATE servicos SET nome = ?, descricao = ?, duracao = ?, preco = ?, ativo = ? WHERE id = ?',
    [nome, descricao, duracao, preco, ativo, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ erro: err.message });
      res.json({ mensagem: 'Serviço atualizado com sucesso' });
    }
  );
});

app.delete('/api/servicos/:id', autenticar, ehAdmin, (req, res) => {
  db.run('UPDATE servicos SET ativo = 0 WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ mensagem: 'Serviço desativado com sucesso' });
  });
});

// ========== ROTAS DE HORÁRIOS DISPONÍVEIS ==========

app.get('/api/horarios/:data', autenticar, (req, res) => {
  const data = req.params.data;
  
  db.all(`
    SELECT h.*, 
      CASE WHEN a.id IS NOT NULL THEN 0 ELSE h.disponivel END as disponivel
    FROM horarios_disponiveis h
    LEFT JOIN agendamentos a ON a.data = h.data AND a.hora = h.hora AND a.status != 'cancelado'
    WHERE h.data = ?
    ORDER BY h.hora
  `, [data], (err, horarios) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(horarios);
  });
});

app.post('/api/horarios', autenticar, ehAdmin, (req, res) => {
  const { data, hora } = req.body;

  db.run('INSERT OR REPLACE INTO horarios_disponiveis (data, hora, disponivel) VALUES (?, ?, 1)',
    [data, hora],
    function(err) {
      if (err) return res.status(500).json({ erro: err.message });
      res.json({ mensagem: 'Horário adicionado com sucesso' });
    }
  );
});

app.delete('/api/horarios/:id', autenticar, ehAdmin, (req, res) => {
  db.run('DELETE FROM horarios_disponiveis WHERE id = ?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    res.json({ mensagem: 'Horário removido com sucesso' });
  });
});

// ========== ROTAS DE AGENDAMENTOS ==========

app.get('/api/agendamentos/meus', autenticar, (req, res) => {
  db.all(`
    SELECT a.*, s.nome as servico_nome, s.duracao, s.preco
    FROM agendamentos a
    JOIN servicos s ON s.id = a.servico_id
    WHERE a.cliente_id = ?
    ORDER BY a.data DESC, a.hora DESC
  `, [req.usuario.id], (err, agendamentos) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(agendamentos);
  });
});

app.get('/api/agendamentos/todos', autenticar, ehAdmin, (req, res) => {
  db.all(`
    SELECT a.*, s.nome as servico_nome, s.duracao, s.preco,
           u.nome as cliente_nome, u.email as cliente_email
    FROM agendamentos a
    JOIN servicos s ON s.id = a.servico_id
    JOIN usuarios u ON u.id = a.cliente_id
    ORDER BY a.data DESC, a.hora DESC
  `, [], (err, agendamentos) => {
    if (err) return res.status(500).json({ erro: err.message });
    res.json(agendamentos);
  });
});

app.post('/api/agendamentos', autenticar, (req, res) => {
  const { servico_id, data, hora, observacoes } = req.body;

  // Verificar se horário está disponível
  db.get(`
    SELECT h.*, a.id as agendamento_id
    FROM horarios_disponiveis h
    LEFT JOIN agendamentos a ON a.data = h.data AND a.hora = h.hora AND a.status != 'cancelado'
    WHERE h.data = ? AND h.hora = ?
  `, [data, hora], (err, horario) => {
    if (err) return res.status(500).json({ erro: err.message });
    
    if (!horario || horario.agendamento_id) {
      return res.status(400).json({ erro: 'Horário não disponível' });
    }

    db.run(`
      INSERT INTO agendamentos (cliente_id, servico_id, data, hora, observacoes)
      VALUES (?, ?, ?, ?, ?)
    `, [req.usuario.id, servico_id, data, hora, observacoes],
    function(err) {
      if (err) return res.status(500).json({ erro: err.message });
      res.json({ id: this.lastID, mensagem: 'Agendamento criado com sucesso' });
    });
  });
});

app.put('/api/agendamentos/:id/status', autenticar, ehAdmin, (req, res) => {
  const { status } = req.body;

  db.run('UPDATE agendamentos SET status = ? WHERE id = ?',
    [status, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ erro: err.message });
      res.json({ mensagem: 'Status atualizado com sucesso' });
    }
  );
});

app.delete('/api/agendamentos/:id', autenticar, (req, res) => {
  // Cliente pode cancelar apenas seus próprios agendamentos
  const query = req.usuario.tipo === 'admin' 
    ? 'UPDATE agendamentos SET status = ? WHERE id = ?'
    : 'UPDATE agendamentos SET status = ? WHERE id = ? AND cliente_id = ?';
  
  const params = req.usuario.tipo === 'admin'
    ? ['cancelado', req.params.id]
    : ['cancelado', req.params.id, req.usuario.id];

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ erro: err.message });
    if (this.changes === 0) {
      return res.status(403).json({ erro: 'Não autorizado' });
    }
    res.json({ mensagem: 'Agendamento cancelado com sucesso' });
  });
});

// Servir o frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
  console.log(`Login admin padrão: admin@admin.com / admin123`);
});
