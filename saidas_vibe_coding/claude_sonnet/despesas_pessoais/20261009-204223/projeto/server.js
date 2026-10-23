const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'chave-secreta-super-segura-2024-despesas';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

const db = new sqlite3.Database('./database.sqlite', (err) => {
  if (err) {
    console.error('Erro ao conectar ao banco de dados:', err);
  } else {
    console.log('Conectado ao banco de dados SQLite');
    initDatabase();
  }
});

function initDatabase() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      tipo TEXT DEFAULT 'usuario',
      ativo INTEGER DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      ativo INTEGER DEFAULT 1,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS despesas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL,
      categoria_id INTEGER NOT NULL,
      descricao TEXT NOT NULL,
      valor REAL NOT NULL,
      data DATE NOT NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
      FOREIGN KEY (categoria_id) REFERENCES categorias(id)
    )`);

    db.get("SELECT COUNT(*) as count FROM usuarios WHERE tipo = 'admin'", async (err, row) => {
      if (row.count === 0) {
        const senhaHash = await bcrypt.hash('admin123', 10);
        db.run(
          "INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)",
          ['Administrador', 'admin@sistema.com', senhaHash, 'admin']
        );
      }
    });

    db.get("SELECT COUNT(*) as count FROM categorias", (err, row) => {
      if (row.count === 0) {
        const categoriasIniciais = [
          'Alimentação',
          'Transporte',
          'Moradia',
          'Saúde',
          'Educação',
          'Lazer',
          'Vestuário',
          'Outros'
        ];
        categoriasIniciais.forEach(cat => {
          db.run("INSERT INTO categorias (nome) VALUES (?)", [cat]);
        });
      }
    });
  });
}

function verificarToken(req, res, next) {
  const token = req.cookies.token;
  
  if (!token) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido' });
  }
}

function verificarAdmin(req, res, next) {
  if (req.usuario.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

app.post('/api/registro', async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    
    db.run(
      "INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)",
      [nome, email, senhaHash],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) {
            return res.status(400).json({ erro: 'Email já cadastrado' });
          }
          return res.status(500).json({ erro: 'Erro ao criar usuário' });
        }
        res.json({ mensagem: 'Usuário criado com sucesso' });
      }
    );
  } catch (err) {
    res.status(500).json({ erro: 'Erro no servidor' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'Email e senha são obrigatórios' });
  }

  db.get(
    "SELECT * FROM usuarios WHERE email = ? AND ativo = 1",
    [email],
    async (err, usuario) => {
      if (err) {
        return res.status(500).json({ erro: 'Erro no servidor' });
      }

      if (!usuario) {
        return res.status(401).json({ erro: 'Email ou senha incorretos' });
      }

      const senhaCorreta = await bcrypt.compare(senha, usuario.senha);

      if (!senhaCorreta) {
        return res.status(401).json({ erro: 'Email ou senha incorretos' });
      }

      const token = jwt.sign(
        { id: usuario.id, email: usuario.email, tipo: usuario.tipo },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.cookie('token', token, {
        httpOnly: true,
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.json({
        mensagem: 'Login realizado com sucesso',
        usuario: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          tipo: usuario.tipo
        }
      });
    }
  );
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ mensagem: 'Logout realizado com sucesso' });
});

app.get('/api/usuario-atual', verificarToken, (req, res) => {
  db.get(
    "SELECT id, nome, email, tipo FROM usuarios WHERE id = ?",
    [req.usuario.id],
    (err, usuario) => {
      if (err || !usuario) {
        return res.status(404).json({ erro: 'Usuário não encontrado' });
      }
      res.json(usuario);
    }
  );
});

app.get('/api/categorias', verificarToken, (req, res) => {
  db.all(
    "SELECT * FROM categorias WHERE ativo = 1 ORDER BY nome",
    [],
    (err, categorias) => {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao buscar categorias' });
      }
      res.json(categorias);
    }
  );
});

app.post('/api/despesas', verificarToken, (req, res) => {
  const { categoria_id, descricao, valor, data } = req.body;

  if (!categoria_id || !descricao || !valor || !data) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }

  db.run(
    "INSERT INTO despesas (usuario_id, categoria_id, descricao, valor, data) VALUES (?, ?, ?, ?, ?)",
    [req.usuario.id, categoria_id, descricao, valor, data],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao criar despesa' });
      }
      res.json({ mensagem: 'Despesa registrada com sucesso', id: this.lastID });
    }
  );
});

app.get('/api/despesas', verificarToken, (req, res) => {
  const { mes, ano } = req.query;
  
  let query = `
    SELECT d.*, c.nome as categoria_nome 
    FROM despesas d
    INNER JOIN categorias c ON d.categoria_id = c.id
    WHERE d.usuario_id = ?
  `;
  
  let params = [req.usuario.id];

  if (mes && ano) {
    query += ` AND strftime('%m', d.data) = ? AND strftime('%Y', d.data) = ?`;
    params.push(mes.padStart(2, '0'), ano);
  }

  query += ` ORDER BY d.data DESC, d.criado_em DESC`;

  db.all(query, params, (err, despesas) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao buscar despesas' });
    }
    res.json(despesas);
  });
});

app.get('/api/despesas/total-mes', verificarToken, (req, res) => {
  const { mes, ano } = req.query;

  if (!mes || !ano) {
    return res.status(400).json({ erro: 'Mês e ano são obrigatórios' });
  }

  db.get(
    `SELECT COALESCE(SUM(valor), 0) as total 
     FROM despesas 
     WHERE usuario_id = ? 
     AND strftime('%m', data) = ? 
     AND strftime('%Y', data) = ?`,
    [req.usuario.id, mes.padStart(2, '0'), ano],
    (err, resultado) => {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao calcular total' });
      }
      res.json({ total: resultado.total });
    }
  );
});

app.delete('/api/despesas/:id', verificarToken, (req, res) => {
  db.run(
    "DELETE FROM despesas WHERE id = ? AND usuario_id = ?",
    [req.params.id, req.usuario.id],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao excluir despesa' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ erro: 'Despesa não encontrada' });
      }
      res.json({ mensagem: 'Despesa excluída com sucesso' });
    }
  );
});

app.post('/api/admin/categorias', verificarToken, verificarAdmin, (req, res) => {
  const { nome } = req.body;

  if (!nome) {
    return res.status(400).json({ erro: 'Nome é obrigatório' });
  }

  db.run(
    "INSERT INTO categorias (nome) VALUES (?)",
    [nome],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao criar categoria' });
      }
      res.json({ mensagem: 'Categoria criada com sucesso', id: this.lastID });
    }
  );
});

app.get('/api/admin/categorias', verificarToken, verificarAdmin, (req, res) => {
  db.all(
    "SELECT * FROM categorias ORDER BY nome",
    [],
    (err, categorias) => {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao buscar categorias' });
      }
      res.json(categorias);
    }
  );
});

app.put('/api/admin/categorias/:id/desativar', verificarToken, verificarAdmin, (req, res) => {
  db.run(
    "UPDATE categorias SET ativo = 0 WHERE id = ?",
    [req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao desativar categoria' });
      }
      res.json({ mensagem: 'Categoria desativada com sucesso' });
    }
  );
});

app.put('/api/admin/categorias/:id/ativar', verificarToken, verificarAdmin, (req, res) => {
  db.run(
    "UPDATE categorias SET ativo = 1 WHERE id = ?",
    [req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao ativar categoria' });
      }
      res.json({ mensagem: 'Categoria ativada com sucesso' });
    }
  );
});

app.get('/api/admin/usuarios', verificarToken, verificarAdmin, (req, res) => {
  db.all(
    "SELECT id, nome, email, tipo, ativo, criado_em FROM usuarios WHERE tipo != 'admin' ORDER BY nome",
    [],
    (err, usuarios) => {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao buscar usuários' });
      }
      res.json(usuarios);
    }
  );
});

app.put('/api/admin/usuarios/:id/desativar', verificarToken, verificarAdmin, (req, res) => {
  db.run(
    "UPDATE usuarios SET ativo = 0 WHERE id = ? AND tipo != 'admin'",
    [req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao desativar usuário' });
      }
      res.json({ mensagem: 'Usuário desativado com sucesso' });
    }
  );
});

app.put('/api/admin/usuarios/:id/ativar', verificarToken, verificarAdmin, (req, res) => {
  db.run(
    "UPDATE usuarios SET ativo = 1 WHERE id = ?",
    [req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao ativar usuário' });
      }
      res.json({ mensagem: 'Usuário ativado com sucesso' });
    }
  );
});

app.get('/api/admin/total-geral', verificarToken, verificarAdmin, (req, res) => {
  db.get(
    `SELECT COALESCE(SUM(d.valor), 0) as total
     FROM despesas d
     INNER JOIN usuarios u ON d.usuario_id = u.id
     WHERE u.ativo = 1`,
    [],
    (err, resultado) => {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao calcular total geral' });
      }
      res.json({ total: resultado.total });
    }
  );
});

app.get('/api/admin/usuarios-com-gastos', verificarToken, verificarAdmin, (req, res) => {
  db.all(
    `SELECT 
      u.id,
      u.nome,
      u.email,
      COALESCE(SUM(d.valor), 0) as total_gastos,
      COUNT(d.id) as total_despesas
     FROM usuarios u
     LEFT JOIN despesas d ON u.id = d.usuario_id
     WHERE u.tipo != 'admin'
     GROUP BY u.id, u.nome, u.email
     ORDER BY total_gastos DESC`,
    [],
    (err, usuarios) => {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao buscar dados' });
      }
      res.json(usuarios);
    }
  );
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
