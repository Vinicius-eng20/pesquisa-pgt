const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database('agendamento.db');

// Configuração do banco de dados
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL CHECK(tipo IN ('cliente', 'admin')),
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS servicos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    duracao INTEGER NOT NULL,
    preco REAL NOT NULL,
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS horarios_disponiveis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dia_semana INTEGER NOT NULL CHECK(dia_semana >= 0 AND dia_semana <= 6),
    hora_inicio TEXT NOT NULL,
    hora_fim TEXT NOT NULL,
    ativo INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS agendamentos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente_id INTEGER NOT NULL,
    servico_id INTEGER NOT NULL,
    data DATE NOT NULL,
    hora TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente', 'confirmado', 'recusado', 'cancelado')),
    observacoes TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (cliente_id) REFERENCES usuarios(id),
    FOREIGN KEY (servico_id) REFERENCES servicos(id)
  );
`);

// Criar usuário admin padrão se não existir
const adminExiste = db.prepare('SELECT id FROM usuarios WHERE tipo = ?').get('admin');
if (!adminExiste) {
  const senhaHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(
    'Administrador',
    'admin@sistema.com',
    senhaHash,
    'admin'
  );
  console.log('Usuário admin criado: admin@sistema.com / admin123');
}

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'segredo-super-secreto-' + Math.random(),
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.userId || req.session.userTipo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

// Rotas de autenticação
app.post('/api/registrar', (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
    }

    const usuarioExiste = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email);
    if (usuarioExiste) {
      return res.status(400).json({ erro: 'Email já cadastrado' });
    }

    const senhaHash = bcrypt.hashSync(senha, 10);
    const resultado = db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(
      nome,
      email,
      senhaHash,
      'cliente'
    );

    req.session.userId = resultado.lastInsertRowid;
    req.session.userNome = nome;
    req.session.userTipo = 'cliente';

    res.json({ sucesso: true, usuario: { id: resultado.lastInsertRowid, nome, tipo: 'cliente' } });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao registrar usuário' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { email, senha } = req.body;
    
    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    
    if (!usuario || !bcrypt.compareSync(senha, usuario.senha)) {
      return res.status(401).json({ erro: 'Email ou senha inválidos' });
    }

    req.session.userId = usuario.id;
    req.session.userNome = usuario.nome;
    req.session.userTipo = usuario.tipo;

    res.json({ 
      sucesso: true, 
      usuario: { 
        id: usuario.id, 
        nome: usuario.nome, 
        tipo: usuario.tipo 
      } 
    });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ sucesso: true });
});

app.get('/api/usuario-atual', (req, res) => {
  if (!req.session.userId) {
    return res.json({ autenticado: false });
  }

  res.json({
    autenticado: true,
    usuario: {
      id: req.session.userId,
      nome: req.session.userNome,
      tipo: req.session.userTipo
    }
  });
});

// Rotas de serviços
app.get('/api/servicos', (req, res) => {
  try {
    const servicos = db.prepare('SELECT * FROM servicos WHERE ativo = 1 ORDER BY nome').all();
    res.json(servicos);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar serviços' });
  }
});

app.post('/api/servicos', requireAdmin, (req, res) => {
  try {
    const { nome, descricao, duracao, preco } = req.body;
    
    if (!nome || !duracao || !preco) {
      return res.status(400).json({ erro: 'Nome, duração e preço são obrigatórios' });
    }

    const resultado = db.prepare('INSERT INTO servicos (nome, descricao, duracao, preco) VALUES (?, ?, ?, ?)').run(
      nome,
      descricao || '',
      parseInt(duracao),
      parseFloat(preco)
    );

    const servico = db.prepare('SELECT * FROM servicos WHERE id = ?').get(resultado.lastInsertRowid);
    res.json(servico);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao criar serviço' });
  }
});

app.put('/api/servicos/:id', requireAdmin, (req, res) => {
  try {
    const { nome, descricao, duracao, preco, ativo } = req.body;
    
    db.prepare('UPDATE servicos SET nome = ?, descricao = ?, duracao = ?, preco = ?, ativo = ? WHERE id = ?').run(
      nome,
      descricao || '',
      parseInt(duracao),
      parseFloat(preco),
      ativo ? 1 : 0,
      req.params.id
    );

    const servico = db.prepare('SELECT * FROM servicos WHERE id = ?').get(req.params.id);
    res.json(servico);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar serviço' });
  }
});

app.delete('/api/servicos/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('UPDATE servicos SET ativo = 0 WHERE id = ?').run(req.params.id);
    res.json({ sucesso: true });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao deletar serviço' });
  }
});

// Rotas de horários disponíveis
app.get('/api/horarios-disponiveis', (req, res) => {
  try {
    const horarios = db.prepare('SELECT * FROM horarios_disponiveis WHERE ativo = 1 ORDER BY dia_semana, hora_inicio').all();
    res.json(horarios);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar horários' });
  }
});

app.post('/api/horarios-disponiveis', requireAdmin, (req, res) => {
  try {
    const { dia_semana, hora_inicio, hora_fim } = req.body;
    
    if (dia_semana === undefined || !hora_inicio || !hora_fim) {
      return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
    }

    const resultado = db.prepare('INSERT INTO horarios_disponiveis (dia_semana, hora_inicio, hora_fim) VALUES (?, ?, ?)').run(
      parseInt(dia_semana),
      hora_inicio,
      hora_fim
    );

    const horario = db.prepare('SELECT * FROM horarios_disponiveis WHERE id = ?').get(resultado.lastInsertRowid);
    res.json(horario);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao criar horário' });
  }
});

app.delete('/api/horarios-disponiveis/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('UPDATE horarios_disponiveis SET ativo = 0 WHERE id = ?').run(req.params.id);
    res.json({ sucesso: true });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao deletar horário' });
  }
});

// Rotas de agendamentos
app.get('/api/agendamentos', requireAuth, (req, res) => {
  try {
    let agendamentos;
    
    if (req.session.userTipo === 'admin') {
      agendamentos = db.prepare(`
        SELECT a.*, s.nome as servico_nome, u.nome as cliente_nome, u.email as cliente_email
        FROM agendamentos a
        JOIN servicos s ON a.servico_id = s.id
        JOIN usuarios u ON a.cliente_id = u.id
        ORDER BY a.data DESC, a.hora DESC
      `).all();
    } else {
      agendamentos = db.prepare(`
        SELECT a.*, s.nome as servico_nome, s.preco as servico_preco
        FROM agendamentos a
        JOIN servicos s ON a.servico_id = s.id
        WHERE a.cliente_id = ?
        ORDER BY a.data DESC, a.hora DESC
      `).all(req.session.userId);
    }

    res.json(agendamentos);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar agendamentos' });
  }
});

app.get('/api/horarios-livres/:data/:servico_id', requireAuth, (req, res) => {
  try {
    const { data, servico_id } = req.params;
    const dataObj = new Date(data + 'T00:00:00');
    const diaSemana = dataObj.getDay();

    // Buscar horários disponíveis para o dia da semana
    const horariosDisponiveis = db.prepare(
      'SELECT * FROM horarios_disponiveis WHERE dia_semana = ? AND ativo = 1'
    ).all(diaSemana);

    if (horariosDisponiveis.length === 0) {
      return res.json([]);
    }

    // Buscar serviço para saber a duração
    const servico = db.prepare('SELECT duracao FROM servicos WHERE id = ?').get(servico_id);
    if (!servico) {
      return res.status(404).json({ erro: 'Serviço não encontrado' });
    }

    // Buscar agendamentos já feitos para esta data
    const agendamentosExistentes = db.prepare(
      'SELECT hora FROM agendamentos WHERE data = ? AND status IN ("pendente", "confirmado")'
    ).all(data);

    const horariosOcupados = new Set(agendamentosExistentes.map(a => a.hora));

    // Gerar slots de horários
    const horariosLivres = [];
    
    for (const horarioDisp of horariosDisponiveis) {
      const [horaInicio, minInicio] = horarioDisp.hora_inicio.split(':').map(Number);
      const [horaFim, minFim] = horarioDisp.hora_fim.split(':').map(Number);
      
      let horaAtual = horaInicio * 60 + minInicio;
      const horaFimMin = horaFim * 60 + minFim;
      
      while (horaAtual + servico.duracao <= horaFimMin) {
        const h = Math.floor(horaAtual / 60).toString().padStart(2, '0');
        const m = (horaAtual % 60).toString().padStart(2, '0');
        const horarioStr = `${h}:${m}`;
        
        if (!horariosOcupados.has(horarioStr)) {
          horariosLivres.push(horarioStr);
        }
        
        horaAtual += 30; // Intervalos de 30 minutos
      }
    }

    res.json(horariosLivres);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar horários livres' });
  }
});

app.post('/api/agendamentos', requireAuth, (req, res) => {
  try {
    const { servico_id, data, hora, observacoes } = req.body;
    
    if (!servico_id || !data || !hora) {
      return res.status(400).json({ erro: 'Serviço, data e hora são obrigatórios' });
    }

    // Verificar se o horário ainda está disponível
    const agendamentoExistente = db.prepare(
      'SELECT id FROM agendamentos WHERE data = ? AND hora = ? AND status IN ("pendente", "confirmado")'
    ).get(data, hora);

    if (agendamentoExistente) {
      return res.status(400).json({ erro: 'Este horário já foi agendado' });
    }

    const resultado = db.prepare(
      'INSERT INTO agendamentos (cliente_id, servico_id, data, hora, observacoes) VALUES (?, ?, ?, ?, ?)'
    ).run(
      req.session.userId,
      servico_id,
      data,
      hora,
      observacoes || ''
    );

    const agendamento = db.prepare(`
      SELECT a.*, s.nome as servico_nome, s.preco as servico_preco
      FROM agendamentos a
      JOIN servicos s ON a.servico_id = s.id
      WHERE a.id = ?
    `).get(resultado.lastInsertRowid);

    res.json(agendamento);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao criar agendamento' });
  }
});

app.put('/api/agendamentos/:id/status', requireAuth, (req, res) => {
  try {
    const { status } = req.body;
    const agendamentoId = req.params.id;

    // Buscar agendamento
    const agendamento = db.prepare('SELECT * FROM agendamentos WHERE id = ?').get(agendamentoId);
    
    if (!agendamento) {
      return res.status(404).json({ erro: 'Agendamento não encontrado' });
    }

    // Verificar permissões
    if (status === 'cancelado' && agendamento.cliente_id !== req.session.userId) {
      return res.status(403).json({ erro: 'Você só pode cancelar seus próprios agendamentos' });
    }

    if ((status === 'confirmado' || status === 'recusado') && req.session.userTipo !== 'admin') {
      return res.status(403).json({ erro: 'Apenas administradores podem confirmar ou recusar agendamentos' });
    }

    db.prepare('UPDATE agendamentos SET status = ? WHERE id = ?').run(status, agendamentoId);

    const agendamentoAtualizado = db.prepare(`
      SELECT a.*, s.nome as servico_nome, u.nome as cliente_nome
      FROM agendamentos a
      JOIN servicos s ON a.servico_id = s.id
      JOIN usuarios u ON a.cliente_id = u.id
      WHERE a.id = ?
    `).get(agendamentoId);

    res.json(agendamentoAtualizado);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar agendamento' });
  }
});

// Servir frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
