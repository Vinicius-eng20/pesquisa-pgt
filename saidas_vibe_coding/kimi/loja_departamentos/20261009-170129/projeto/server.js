const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const db = new sqlite3.Database('database.db');

// Configurações
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  store: new SQLiteStore({ db: 'sessions.db' }),
  secret: 'sua-chave-secreta-mude-isso-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 dias
}));

// Criar tabelas
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT DEFAULT 'cliente',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco REAL NOT NULL,
    categoria TEXT,
    estoque INTEGER DEFAULT 0,
    imagem TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pendente',
    endereco TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS itens_pedido (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    preco REAL NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  )`);
});

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (!req.session.usuarioId) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.usuarioId || req.session.tipo !== 'admin') {
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

  try {
    const senhaHash = await bcrypt.hash(senha, 10);
    db.run(
      'INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)',
      [nome, email, senhaHash],
      function(err) {
        if (err) {
          return res.status(400).json({ erro: 'Email já cadastrado' });
        }
        res.json({ sucesso: true, id: this.lastID });
      }
    );
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao criar conta' });
  }
});

app.post('/api/registro-admin', async (req, res) => {
  const { nome, email, senha } = req.body;
  
  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Preencha todos os campos' });
  }

  // Verifica se já existe algum admin
  db.get('SELECT COUNT(*) as count FROM usuarios WHERE tipo = "admin"', async (err, row) => {
    if (row.count > 0) {
      return res.status(403).json({ erro: 'Já existe um administrador cadastrado' });
    }

    try {
      const senhaHash = await bcrypt.hash(senha, 10);
      db.run(
        'INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, "admin")',
        [nome, email, senhaHash],
        function(err) {
          if (err) {
            return res.status(400).json({ erro: 'Email já cadastrado' });
          }
          res.json({ sucesso: true, id: this.lastID });
        }
      );
    } catch (erro) {
      res.status(500).json({ erro: 'Erro ao criar conta' });
    }
  });
});

app.post('/api/login', (req, res) => {
  const { email, senha } = req.body;

  db.get('SELECT * FROM usuarios WHERE email = ?', [email], async (err, usuario) => {
    if (!usuario) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const senhaCorreta = await bcrypt.compare(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    req.session.usuarioId = usuario.id;
    req.session.nome = usuario.nome;
    req.session.tipo = usuario.tipo;

    res.json({ 
      sucesso: true, 
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
  res.json({ sucesso: true });
});

app.get('/api/usuario-atual', (req, res) => {
  if (!req.session.usuarioId) {
    return res.json({ usuario: null });
  }
  res.json({ 
    usuario: { 
      id: req.session.usuarioId, 
      nome: req.session.nome,
      tipo: req.session.tipo
    } 
  });
});

// ========== ROTAS DE PRODUTOS ==========

app.get('/api/produtos', (req, res) => {
  const { categoria, busca } = req.query;
  let sql = 'SELECT * FROM produtos WHERE 1=1';
  const params = [];

  if (categoria) {
    sql += ' AND categoria = ?';
    params.push(categoria);
  }

  if (busca) {
    sql += ' AND (nome LIKE ? OR descricao LIKE ?)';
    params.push(`%${busca}%`, `%${busca}%`);
  }

  sql += ' ORDER BY criado_em DESC';

  db.all(sql, params, (err, produtos) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao buscar produtos' });
    }
    res.json(produtos);
  });
});

app.get('/api/produtos/:id', (req, res) => {
  db.get('SELECT * FROM produtos WHERE id = ?', [req.params.id], (err, produto) => {
    if (err || !produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    res.json(produto);
  });
});

app.post('/api/produtos', requireAdmin, (req, res) => {
  const { nome, descricao, preco, categoria, estoque, imagem } = req.body;

  if (!nome || !preco) {
    return res.status(400).json({ erro: 'Nome e preço são obrigatórios' });
  }

  db.run(
    'INSERT INTO produtos (nome, descricao, preco, categoria, estoque, imagem) VALUES (?, ?, ?, ?, ?, ?)',
    [nome, descricao, preco, categoria, estoque || 0, imagem],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao criar produto' });
      }
      res.json({ sucesso: true, id: this.lastID });
    }
  );
});

app.put('/api/produtos/:id', requireAdmin, (req, res) => {
  const { nome, descricao, preco, categoria, estoque, imagem } = req.body;

  db.run(
    'UPDATE produtos SET nome = ?, descricao = ?, preco = ?, categoria = ?, estoque = ?, imagem = ? WHERE id = ?',
    [nome, descricao, preco, categoria, estoque, imagem, req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao atualizar produto' });
      }
      res.json({ sucesso: true });
    }
  );
});

app.delete('/api/produtos/:id', requireAdmin, (req, res) => {
  db.run('DELETE FROM produtos WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao deletar produto' });
    }
    res.json({ sucesso: true });
  });
});

// ========== ROTAS DE PEDIDOS ==========

app.post('/api/pedidos', requireAuth, (req, res) => {
  const { itens, endereco } = req.body;

  if (!itens || itens.length === 0) {
    return res.status(400).json({ erro: 'Carrinho vazio' });
  }

  // Calcular total
  let total = 0;
  const produtoIds = itens.map(i => i.produto_id);
  
  db.all(
    `SELECT id, preco, estoque FROM produtos WHERE id IN (${produtoIds.join(',')})`,
    (err, produtos) => {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao processar pedido' });
      }

      // Verificar estoque e calcular total
      for (let item of itens) {
        const produto = produtos.find(p => p.id === item.produto_id);
        if (!produto) {
          return res.status(400).json({ erro: 'Produto não encontrado' });
        }
        if (produto.estoque < item.quantidade) {
          return res.status(400).json({ erro: `Estoque insuficiente para o produto ID ${item.produto_id}` });
        }
        total += produto.preco * item.quantidade;
      }

      // Criar pedido
      db.run(
        'INSERT INTO pedidos (usuario_id, total, endereco) VALUES (?, ?, ?)',
        [req.session.usuarioId, total, endereco],
        function(err) {
          if (err) {
            return res.status(500).json({ erro: 'Erro ao criar pedido' });
          }

          const pedidoId = this.lastID;

          // Inserir itens e atualizar estoque
          const stmt = db.prepare('INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco) VALUES (?, ?, ?, ?)');
          const updateEstoque = db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ?');

          itens.forEach(item => {
            const produto = produtos.find(p => p.id === item.produto_id);
            stmt.run(pedidoId, item.produto_id, item.quantidade, produto.preco);
            updateEstoque.run(item.quantidade, item.produto_id);
          });

          stmt.finalize();
          updateEstoque.finalize();

          res.json({ sucesso: true, pedido_id: pedidoId });
        }
      );
    }
  );
});

app.get('/api/meus-pedidos', requireAuth, (req, res) => {
  db.all(
    `SELECT p.*, u.nome as cliente_nome 
     FROM pedidos p 
     JOIN usuarios u ON p.usuario_id = u.id 
     WHERE p.usuario_id = ? 
     ORDER BY p.criado_em DESC`,
    [req.session.usuarioId],
    (err, pedidos) => {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao buscar pedidos' });
      }
      res.json(pedidos);
    }
  );
});

app.get('/api/pedidos/:id', requireAuth, (req, res) => {
  db.get(
    'SELECT * FROM pedidos WHERE id = ? AND (usuario_id = ? OR ? = "admin")',
    [req.params.id, req.session.usuarioId, req.session.tipo],
    (err, pedido) => {
      if (err || !pedido) {
        return res.status(404).json({ erro: 'Pedido não encontrado' });
      }

      db.all(
        `SELECT ip.*, p.nome, p.imagem 
         FROM itens_pedido ip 
         JOIN produtos p ON ip.produto_id = p.id 
         WHERE ip.pedido_id = ?`,
        [req.params.id],
        (err, itens) => {
          if (err) {
            return res.status(500).json({ erro: 'Erro ao buscar itens' });
          }
          res.json({ ...pedido, itens });
        }
      );
    }
  );
});

app.get('/api/todos-pedidos', requireAdmin, (req, res) => {
  db.all(
    `SELECT p.*, u.nome as cliente_nome, u.email as cliente_email 
     FROM pedidos p 
     JOIN usuarios u ON p.usuario_id = u.id 
     ORDER BY p.criado_em DESC`,
    (err, pedidos) => {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao buscar pedidos' });
      }
      res.json(pedidos);
    }
  );
});

app.put('/api/pedidos/:id/status', requireAdmin, (req, res) => {
  const { status } = req.body;
  
  const statusValidos = ['pendente', 'processando', 'enviado', 'entregue', 'cancelado'];
  if (!statusValidos.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido' });
  }

  db.run(
    'UPDATE pedidos SET status = ? WHERE id = ?',
    [status, req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ erro: 'Erro ao atualizar status' });
      }
      res.json({ sucesso: true });
    }
  );
});

// ========== ROTAS DE CATEGORIAS ==========

app.get('/api/categorias', (req, res) => {
  db.all('SELECT DISTINCT categoria FROM produtos WHERE categoria IS NOT NULL', (err, rows) => {
    if (err) {
      return res.status(500).json({ erro: 'Erro ao buscar categorias' });
    }
    res.json(rows.map(r => r.categoria));
  });
});

// Servir páginas HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/admin-setup', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-setup.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
