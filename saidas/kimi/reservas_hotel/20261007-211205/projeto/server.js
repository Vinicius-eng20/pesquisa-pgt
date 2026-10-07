const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do banco de dados
const db = new sqlite3.Database('./hotel.db', (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco:', err);
  } else {
    console.log('Conectado ao banco de dados SQLite');
    initDatabase();
  }
});

// Inicializar tabelas
function initDatabase() {
  db.serialize(() => {
    // Tabela de usuários
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      tipo TEXT CHECK(tipo IN ('hospede', 'gerente')) NOT NULL DEFAULT 'hospede',
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de quartos
    db.run(`CREATE TABLE IF NOT EXISTS quartos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL,
      tipo TEXT NOT NULL,
      descricao TEXT,
      capacidade INTEGER NOT NULL,
      preco_diaria DECIMAL(10,2) NOT NULL,
      ativo BOOLEAN DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Tabela de reservas
    db.run(`CREATE TABLE IF NOT EXISTS reservas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      quarto_id INTEGER NOT NULL,
      data_checkin DATE NOT NULL,
      data_checkout DATE NOT NULL,
      status TEXT CHECK(status IN ('pendente', 'confirmada', 'recusada', 'cancelada')) DEFAULT 'pendente',
      valor_total DECIMAL(10,2) NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (quarto_id) REFERENCES quartos(id)
    )`);

    // Criar usuário admin padrão se não existir
    const adminEmail = 'admin@hotel.com';
    db.get('SELECT id FROM usuarios WHERE email = ?', [adminEmail], (err, row) => {
      if (!row) {
        const senhaHash = bcrypt.hashSync('admin123', 10);
        db.run(`INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)`,
          ['Gerente do Hotel', adminEmail, senhaHash, 'gerente'],
          (err) => {
            if (err) console.error('Erro ao criar admin:', err);
            else console.log('Usuário gerente criado: admin@hotel.com / admin123');
          }
        );
      }
    });

    // Inserir quartos de exemplo se não existirem
    db.get('SELECT COUNT(*) as count FROM quartos', (err, row) => {
      if (row.count === 0) {
        const quartosExemplo = [
          ['101', 'Standard', 'Quarto confortável com vista para o jardim', 2, 150.00],
          ['102', 'Standard', 'Quarto confortável com vista para o jardim', 2, 150.00],
          ['201', 'Luxo', 'Quarto espaçoso com varanda e vista para o mar', 3, 300.00],
          ['202', 'Luxo', 'Quarto espaçoso com varanda e vista para o mar', 3, 300.00],
          ['301', 'Suíte', 'Suíte master com hidromassagem e sala de estar', 4, 500.00],
          ['302', 'Suíte Presidencial', 'Suíte luxuosa com dois quartos e vista panorâmica', 6, 800.00]
        ];

        const stmt = db.prepare(`INSERT INTO quartos (numero, tipo, descricao, capacidade, preco_diaria) VALUES (?, ?, ?, ?, ?)`);
        quartosExemplo.forEach(q => stmt.run(q));
        stmt.finalize();
        console.log('Quartos de exemplo criados');
      }
    });
  });
}

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuração de sessão
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './'
  }),
  secret: 'hotel-reservas-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
  }
}));

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Não autorizado' });
  }
}

function requireGerente(req, res, next) {
  if (req.session.userId && req.session.userTipo === 'gerente') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso negado. Apenas gerentes.' });
  }
}

// Rotas de autenticação
app.post('/api/registro', async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    
    db.run(
      'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)',
      [nome, email, senhaHash, 'hospede'],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email já cadastrado' });
          }
          return res.status(500).json({ error: 'Erro ao criar conta' });
        }
        
        req.session.userId = this.lastID;
        req.session.userTipo = 'hospede';
        req.session.userNome = nome;
        
        res.json({ 
          success: true, 
          usuario: { id: this.lastID, nome, email, tipo: 'hospede' }
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Erro no servidor' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;

  db.get('SELECT * FROM usuarios WHERE email = ?', [email], async (err, usuario) => {
    if (err) {
      return res.status(500).json({ error: 'Erro no servidor' });
    }

    if (!usuario) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    
    if (!senhaValida) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    req.session.userId = usuario.id;
    req.session.userTipo = usuario.tipo;
    req.session.userNome = usuario.nome;

    res.json({
      success: true,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo
      }
    });
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/usuario', requireAuth, (req, res) => {
  db.get(
    'SELECT id, nome, email, tipo FROM usuarios WHERE id = ?',
    [req.session.userId],
    (err, usuario) => {
      if (err || !usuario) {
        return res.status(404).json({ error: 'Usuário não encontrado' });
      }
      res.json({ usuario });
    }
  );
});

// Rotas de quartos (público para consulta)
app.get('/api/quartos/disponiveis', (req, res) => {
  const { checkin, checkout } = req.query;

  if (!checkin || !checkout) {
    return res.status(400).json({ error: 'Datas de check-in e check-out são obrigatórias' });
  }

  const query = `
    SELECT q.* 
    FROM quartos q
    WHERE q.ativo = 1 
    AND q.id NOT IN (
      SELECT r.quarto_id 
      FROM reservas r 
      WHERE r.status IN ('pendente', 'confirmada')
      AND (
        (r.data_checkin <= ? AND r.data_checkout >= ?)
        OR (r.data_checkin <= ? AND r.data_checkout >= ?)
        OR (r.data_checkin >= ? AND r.data_checkout <= ?)
      )
    )
    ORDER BY q.numero
  `;

  db.all(query, [checkin, checkin, checkout, checkout, checkin, checkout], (err, quartos) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar quartos' });
    }
    res.json({ quartos });
  });
});

// Rotas de quartos (gerente)
app.get('/api/quartos', requireAuth, requireGerente, (req, res) => {
  db.all('SELECT * FROM quartos ORDER BY numero', (err, quartos) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar quartos' });
    }
    res.json({ quartos });
  });
});

app.post('/api/quartos', requireAuth, requireGerente, (req, res) => {
  const { numero, tipo, descricao, capacidade, preco_diaria } = req.body;

  if (!numero || !tipo || !capacidade || !preco_diaria) {
    return res.status(400).json({ error: 'Campos obrigatórios faltando' });
  }

  db.run(
    'INSERT INTO quartos (numero, tipo, descricao, capacidade, preco_diaria) VALUES (?, ?, ?, ?, ?)',
    [numero, tipo, descricao, capacidade, preco_diaria],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao criar quarto' });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

app.put('/api/quartos/:id', requireAuth, requireGerente, (req, res) => {
  const { id } = req.params;
  const { numero, tipo, descricao, capacidade, preco_diaria, ativo } = req.body;

  db.run(
    'UPDATE quartos SET numero = ?, tipo = ?, descricao = ?, capacidade = ?, preco_diaria = ?, ativo = ? WHERE id = ?',
    [numero, tipo, descricao, capacidade, preco_diaria, ativo, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao atualizar quarto' });
      }
      res.json({ success: true });
    }
  );
});

app.delete('/api/quartos/:id', requireAuth, requireGerente, (req, res) => {
  const { id } = req.params;

  db.run('DELETE FROM quartos WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Erro ao remover quarto' });
    }
    res.json({ success: true });
  });
});

// Rotas de reservas (hóspede)
app.get('/api/minhas-reservas', requireAuth, (req, res) => {
  const query = `
    SELECT r.*, q.numero as quarto_numero, q.tipo as quarto_tipo 
    FROM reservas r
    JOIN quartos q ON r.quarto_id = q.id
    WHERE r.usuario_id = ?
    ORDER BY r.criado_em DESC
  `;

  db.all(query, [req.session.userId], (err, reservas) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar reservas' });
    }
    res.json({ reservas });
  });
});

app.post('/api/reservas', requireAuth, (req, res) => {
  const { quarto_id, data_checkin, data_checkout } = req.body;

  if (!quarto_id || !data_checkin || !data_checkout) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  // Verificar se o quarto está disponível
  const checkQuery = `
    SELECT COUNT(*) as count 
    FROM reservas 
    WHERE quarto_id = ? 
    AND status IN ('pendente', 'confirmada')
    AND (
      (data_checkin <= ? AND data_checkout >= ?)
      OR (data_checkin <= ? AND data_checkout >= ?)
      OR (data_checkin >= ? AND data_checkout <= ?)
    )
  `;

  db.get(checkQuery, [quarto_id, data_checkin, data_checkin, data_checkout, data_checkout, data_checkin, data_checkout], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao verificar disponibilidade' });
    }

    if (result.count > 0) {
      return res.status(400).json({ error: 'Quarto não disponível nas datas selecionadas' });
    }

    // Calcular valor total
    const checkin = new Date(data_checkin);
    const checkout = new Date(data_checkout);
    const diffTime = Math.abs(checkout - checkin);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    db.get('SELECT preco_diaria FROM quartos WHERE id = ?', [quarto_id], (err, quarto) => {
      if (err || !quarto) {
        return res.status(404).json({ error: 'Quarto não encontrado' });
      }

      const valor_total = diffDays * quarto.preco_diaria;

      db.run(
        'INSERT INTO reservas (usuario_id, quarto_id, data_checkin, data_checkout, valor_total) VALUES (?, ?, ?, ?, ?)',
        [req.session.userId, quarto_id, data_checkin, data_checkout, valor_total],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Erro ao criar reserva' });
          }
          res.json({ success: true, id: this.lastID, valor_total });
        }
      );
    });
  });
});

app.delete('/api/reservas/:id', requireAuth, (req, res) => {
  const { id } = req.params;

  db.run(
    'UPDATE reservas SET status = "cancelada" WHERE id = ? AND usuario_id = ?',
    [id, req.session.userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao cancelar reserva' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Reserva não encontrada' });
      }
      res.json({ success: true });
    }
  );
});

// Rotas de reservas (gerente)
app.get('/api/todas-reservas', requireAuth, requireGerente, (req, res) => {
  const query = `
    SELECT r.*, u.nome as hospede_nome, u.email as hospede_email, 
           q.numero as quarto_numero, q.tipo as quarto_tipo
    FROM reservas r
    JOIN usuarios u ON r.usuario_id = u.id
    JOIN quartos q ON r.quarto_id = q.id
    ORDER BY r.criado_em DESC
  `;

  db.all(query, (err, reservas) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar reservas' });
    }
    res.json({ reservas });
  });
});

app.put('/api/reservas/:id/status', requireAuth, requireGerente, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!['confirmada', 'recusada'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  db.run(
    'UPDATE reservas SET status = ? WHERE id = ?',
    [status, id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao atualizar status' });
      }
      res.json({ success: true });
    }
  );
});

// Servir arquivos estáticos
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
