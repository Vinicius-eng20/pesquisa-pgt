const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const db = new Database('restaurante.db');

// Configurações
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'restaurante-secret-key-muito-segura-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Inicializar banco de dados
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT NOT NULL DEFAULT 'cliente',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pratos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco REAL NOT NULL,
    categoria TEXT NOT NULL,
    imagem TEXT,
    disponivel INTEGER DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'Pendente',
    observacoes TEXT,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  CREATE TABLE IF NOT EXISTS itens_pedido (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    prato_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario REAL NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (prato_id) REFERENCES pratos(id)
  );
`);

// Criar usuário gerente padrão se não existir
const gerente = db.prepare('SELECT * FROM usuarios WHERE email = ?').get('gerente@restaurante.com');
if (!gerente) {
  const senhaHash = bcrypt.hashSync('gerente123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(
    'Gerente',
    'gerente@restaurante.com',
    senhaHash,
    'gerente'
  );
}

// Criar cliente de teste se não existir
const cliente = db.prepare('SELECT * FROM usuarios WHERE email = ?').get('cliente@email.com');
if (!cliente) {
  const senhaHash = bcrypt.hashSync('cliente123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(
    'Cliente Teste',
    'cliente@email.com',
    senhaHash,
    'cliente'
  );
}

// Adicionar pratos de exemplo se não existirem
const pratosExistentes = db.prepare('SELECT COUNT(*) as count FROM pratos').get();
if (pratosExistentes.count === 0) {
  const inserirPrato = db.prepare('INSERT INTO pratos (nome, descricao, preco, categoria, disponivel) VALUES (?, ?, ?, ?, ?)');
  
  inserirPrato.run('Pizza Margherita', 'Molho de tomate, mussarela e manjericão', 35.00, 'Pizza', 1);
  inserirPrato.run('Pizza Calabresa', 'Molho de tomate, mussarela e calabresa', 38.00, 'Pizza', 1);
  inserirPrato.run('Hambúrguer Artesanal', 'Pão brioche, burger 180g, queijo, alface, tomate', 28.00, 'Lanche', 1);
  inserirPrato.run('Batata Frita', 'Porção de batata frita crocante', 15.00, 'Acompanhamento', 1);
  inserirPrato.run('Refrigerante Lata', 'Refrigerante 350ml', 5.00, 'Bebida', 1);
  inserirPrato.run('Suco Natural', 'Suco natural 500ml', 8.00, 'Bebida', 1);
  inserirPrato.run('Lasanha Bolonhesa', 'Lasanha de carne com molho bolonhesa', 32.00, 'Massa', 1);
  inserirPrato.run('Salada Caesar', 'Alface, frango grelhado, croutons e molho caesar', 22.00, 'Salada', 1);
}

// Middleware de autenticação
function autenticar(req, res, next) {
  if (req.session.usuarioId) {
    next();
  } else {
    res.status(401).json({ erro: 'Não autenticado' });
  }
}

function autenticarGerente(req, res, next) {
  if (req.session.usuarioId && req.session.usuarioTipo === 'gerente') {
    next();
  } else {
    res.status(403).json({ erro: 'Acesso negado' });
  }
}

// Rotas de autenticação
app.post('/api/registro', (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    
    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Preencha todos os campos' });
    }

    const usuarioExistente = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    if (usuarioExistente) {
      return res.status(400).json({ erro: 'Email já cadastrado' });
    }

    const senhaHash = bcrypt.hashSync(senha, 10);
    const resultado = db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(
      nome,
      email,
      senhaHash,
      'cliente'
    );

    req.session.usuarioId = resultado.lastInsertRowid;
    req.session.usuarioNome = nome;
    req.session.usuarioTipo = 'cliente';

    res.json({ sucesso: true, usuario: { id: resultado.lastInsertRowid, nome, tipo: 'cliente' } });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao registrar usuário' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Preencha todos os campos' });
    }

    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    if (!usuario) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const senhaCorreta = bcrypt.compareSync(senha, usuario.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    req.session.usuarioId = usuario.id;
    req.session.usuarioNome = usuario.nome;
    req.session.usuarioTipo = usuario.tipo;

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

app.get('/api/usuario-atual', autenticar, (req, res) => {
  const usuario = db.prepare('SELECT id, nome, email, tipo FROM usuarios WHERE id = ?').get(req.session.usuarioId);
  res.json(usuario);
});

// Rotas de pratos
app.get('/api/pratos', autenticar, (req, res) => {
  const pratos = db.prepare('SELECT * FROM pratos ORDER BY categoria, nome').all();
  res.json(pratos);
});

app.get('/api/pratos/:id', autenticar, (req, res) => {
  const prato = db.prepare('SELECT * FROM pratos WHERE id = ?').get(req.params.id);
  if (!prato) {
    return res.status(404).json({ erro: 'Prato não encontrado' });
  }
  res.json(prato);
});

app.post('/api/pratos', autenticarGerente, (req, res) => {
  try {
    const { nome, descricao, preco, categoria, disponivel } = req.body;

    if (!nome || !preco || !categoria) {
      return res.status(400).json({ erro: 'Preencha os campos obrigatórios' });
    }

    const resultado = db.prepare(
      'INSERT INTO pratos (nome, descricao, preco, categoria, disponivel) VALUES (?, ?, ?, ?, ?)'
    ).run(nome, descricao || '', preco, categoria, disponivel ? 1 : 0);

    const prato = db.prepare('SELECT * FROM pratos WHERE id = ?').get(resultado.lastInsertRowid);
    res.json(prato);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao criar prato' });
  }
});

app.put('/api/pratos/:id', autenticarGerente, (req, res) => {
  try {
    const { nome, descricao, preco, categoria, disponivel } = req.body;

    if (!nome || !preco || !categoria) {
      return res.status(400).json({ erro: 'Preencha os campos obrigatórios' });
    }

    db.prepare(
      'UPDATE pratos SET nome = ?, descricao = ?, preco = ?, categoria = ?, disponivel = ? WHERE id = ?'
    ).run(nome, descricao || '', preco, categoria, disponivel ? 1 : 0, req.params.id);

    const prato = db.prepare('SELECT * FROM pratos WHERE id = ?').get(req.params.id);
    res.json(prato);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar prato' });
  }
});

app.delete('/api/pratos/:id', autenticarGerente, (req, res) => {
  try {
    db.prepare('DELETE FROM pratos WHERE id = ?').run(req.params.id);
    res.json({ sucesso: true });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao deletar prato' });
  }
});

// Rotas de pedidos
app.get('/api/pedidos', autenticar, (req, res) => {
  try {
    let pedidos;
    
    if (req.session.usuarioTipo === 'gerente') {
      // Gerente vê todos os pedidos
      pedidos = db.prepare(`
        SELECT p.*, u.nome as cliente_nome, u.email as cliente_email
        FROM pedidos p
        JOIN usuarios u ON p.usuario_id = u.id
        ORDER BY p.criado_em DESC
      `).all();
    } else {
      // Cliente vê apenas seus pedidos
      pedidos = db.prepare(`
        SELECT p.*, u.nome as cliente_nome
        FROM pedidos p
        JOIN usuarios u ON p.usuario_id = u.id
        WHERE p.usuario_id = ?
        ORDER BY p.criado_em DESC
      `).all(req.session.usuarioId);
    }

    // Buscar itens de cada pedido
    for (let pedido of pedidos) {
      pedido.itens = db.prepare(`
        SELECT ip.*, pr.nome as prato_nome
        FROM itens_pedido ip
        JOIN pratos pr ON ip.prato_id = pr.id
        WHERE ip.pedido_id = ?
      `).all(pedido.id);
    }

    res.json(pedidos);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

app.get('/api/pedidos/:id', autenticar, (req, res) => {
  try {
    const pedido = db.prepare(`
      SELECT p.*, u.nome as cliente_nome, u.email as cliente_email
      FROM pedidos p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.id = ?
    `).get(req.params.id);

    if (!pedido) {
      return res.status(404).json({ erro: 'Pedido não encontrado' });
    }

    // Verificar permissão
    if (req.session.usuarioTipo !== 'gerente' && pedido.usuario_id !== req.session.usuarioId) {
      return res.status(403).json({ erro: 'Acesso negado' });
    }

    pedido.itens = db.prepare(`
      SELECT ip.*, pr.nome as prato_nome
      FROM itens_pedido ip
      JOIN pratos pr ON ip.prato_id = pr.id
      WHERE ip.pedido_id = ?
    `).all(pedido.id);

    res.json(pedido);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar pedido' });
  }
});

app.post('/api/pedidos', autenticar, (req, res) => {
  try {
    const { itens, observacoes } = req.body;

    if (!itens || itens.length === 0) {
      return res.status(400).json({ erro: 'Pedido vazio' });
    }

    let total = 0;
    const itensValidados = [];

    // Validar itens e calcular total
    for (let item of itens) {
      const prato = db.prepare('SELECT * FROM pratos WHERE id = ? AND disponivel = 1').get(item.prato_id);
      if (!prato) {
        return res.status(400).json({ erro: `Prato ID ${item.prato_id} não disponível` });
      }

      itensValidados.push({
        prato_id: prato.id,
        quantidade: item.quantidade,
        preco_unitario: prato.preco
      });

      total += prato.preco * item.quantidade;
    }

    // Criar pedido
    const resultado = db.prepare(
      'INSERT INTO pedidos (usuario_id, total, status, observacoes) VALUES (?, ?, ?, ?)'
    ).run(req.session.usuarioId, total, 'Pendente', observacoes || '');

    const pedidoId = resultado.lastInsertRowid;

    // Adicionar itens do pedido
    const inserirItem = db.prepare(
      'INSERT INTO itens_pedido (pedido_id, prato_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)'
    );

    for (let item of itensValidados) {
      inserirItem.run(pedidoId, item.prato_id, item.quantidade, item.preco_unitario);
    }

    // Buscar pedido completo
    const pedido = db.prepare(`
      SELECT p.*, u.nome as cliente_nome
      FROM pedidos p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.id = ?
    `).get(pedidoId);

    pedido.itens = db.prepare(`
      SELECT ip.*, pr.nome as prato_nome
      FROM itens_pedido ip
      JOIN pratos pr ON ip.prato_id = pr.id
      WHERE ip.pedido_id = ?
    `).all(pedidoId);

    res.json(pedido);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao criar pedido' });
  }
});

app.put('/api/pedidos/:id/status', autenticarGerente, (req, res) => {
  try {
    const { status } = req.body;

    const statusPermitidos = ['Pendente', 'Preparando', 'Pronto', 'Entregue', 'Cancelado'];
    if (!statusPermitidos.includes(status)) {
      return res.status(400).json({ erro: 'Status inválido' });
    }

    db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(status, req.params.id);

    const pedido = db.prepare(`
      SELECT p.*, u.nome as cliente_nome, u.email as cliente_email
      FROM pedidos p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.id = ?
    `).get(req.params.id);

    pedido.itens = db.prepare(`
      SELECT ip.*, pr.nome as prato_nome
      FROM itens_pedido ip
      JOIN pratos pr ON ip.prato_id = pr.id
      WHERE ip.pedido_id = ?
    `).all(req.params.id);

    res.json(pedido);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar status' });
  }
});

// Rota para servir o HTML
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
