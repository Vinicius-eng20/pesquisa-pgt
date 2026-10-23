import express from 'express';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const db = new Database('loja.db');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// Criar tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    tipo TEXT DEFAULT 'cliente',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    descricao TEXT,
    preco REAL NOT NULL,
    categoria TEXT NOT NULL,
    imagem TEXT,
    estoque INTEGER DEFAULT 0,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pedidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    total REAL NOT NULL,
    status TEXT DEFAULT 'pendente',
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );

  CREATE TABLE IF NOT EXISTS itens_pedido (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pedido_id INTEGER NOT NULL,
    produto_id INTEGER NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario REAL NOT NULL,
    FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
    FOREIGN KEY (produto_id) REFERENCES produtos(id)
  );

  CREATE TABLE IF NOT EXISTS sessoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
  );
`);

// Criar usuário admin padrão se não existir
const adminExiste = db.prepare('SELECT id FROM usuarios WHERE email = ?').get('admin@loja.com');
if (!adminExiste) {
  const senhaHash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO usuarios (nome, email, senha, tipo) VALUES (?, ?, ?, ?)').run(
    'Administrador',
    'admin@loja.com',
    senhaHash,
    'admin'
  );
  console.log('Usuário admin criado: admin@loja.com / admin123');
}

// Criar alguns produtos de exemplo se não existir nenhum
const produtosExistem = db.prepare('SELECT COUNT(*) as count FROM produtos').get();
if (produtosExistem.count === 0) {
  const produtosExemplo = [
    ['Smartphone Galaxy X', 'Smartphone de última geração com 128GB', 2499.90, 'Eletrônicos', 'https://via.placeholder.com/300x300/4A90E2/FFFFFF?text=Smartphone', 50],
    ['Notebook Pro 15', 'Notebook profissional i7, 16GB RAM, SSD 512GB', 4999.00, 'Eletrônicos', 'https://via.placeholder.com/300x300/E24A90/FFFFFF?text=Notebook', 30],
    ['Fone Bluetooth Premium', 'Fone de ouvido sem fio com cancelamento de ruído', 599.90, 'Eletrônicos', 'https://via.placeholder.com/300x300/90E24A/FFFFFF?text=Fone', 100],
    ['Camiseta Básica', 'Camiseta 100% algodão, diversos tamanhos', 49.90, 'Moda', 'https://via.placeholder.com/300x300/E2904A/FFFFFF?text=Camiseta', 200],
    ['Calça Jeans Slim', 'Calça jeans com modelagem slim fit', 129.90, 'Moda', 'https://via.placeholder.com/300x300/4AE290/FFFFFF?text=Calca', 150],
    ['Tênis Esportivo', 'Tênis confortável para corrida e caminhada', 299.90, 'Moda', 'https://via.placeholder.com/300x300/904AE2/FFFFFF?text=Tenis', 80],
    ['Smart TV 50"', 'TV 4K com sistema operacional Android', 2199.00, 'Eletrônicos', 'https://via.placeholder.com/300x300/E2E24A/FFFFFF?text=Smart+TV', 25],
    ['Micro-ondas 30L', 'Micro-ondas com 10 programas automáticos', 449.90, 'Eletrodomésticos', 'https://via.placeholder.com/300x300/4AE2E2/FFFFFF?text=Microondas', 40],
    ['Liquidificador Turbo', 'Liquidificador 1000W com 12 velocidades', 189.90, 'Eletrodomésticos', 'https://via.placeholder.com/300x300/E24A4A/FFFFFF?text=Liquidificador', 60],
    ['Cafeteira Expresso', 'Cafeteira automática 15 bar de pressão', 899.90, 'Eletrodomésticos', 'https://via.placeholder.com/300x300/4A4AE2/FFFFFF?text=Cafeteira', 35],
    ['Livro: Programação Web', 'Aprenda desenvolvimento web do zero', 79.90, 'Livros', 'https://via.placeholder.com/300x300/E290E2/FFFFFF?text=Livro+Web', 100],
    ['Livro: Design Moderno', 'Princípios de design para interfaces', 69.90, 'Livros', 'https://via.placeholder.com/300x300/90E2E2/FFFFFF?text=Livro+Design', 80]
  ];

  const stmt = db.prepare('INSERT INTO produtos (nome, descricao, preco, categoria, imagem, estoque) VALUES (?, ?, ?, ?, ?, ?)');
  produtosExemplo.forEach(produto => stmt.run(...produto));
  console.log('Produtos de exemplo criados');
}

// Middleware de autenticação
function autenticar(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }

  const sessao = db.prepare('SELECT usuario_id FROM sessoes WHERE token = ?').get(token);
  if (!sessao) {
    return res.status(401).json({ erro: 'Sessão inválida' });
  }

  const usuario = db.prepare('SELECT id, nome, email, tipo FROM usuarios WHERE id = ?').get(sessao.usuario_id);
  if (!usuario) {
    return res.status(401).json({ erro: 'Usuário não encontrado' });
  }

  req.usuario = usuario;
  next();
}

function verificarAdmin(req, res, next) {
  if (req.usuario.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso negado' });
  }
  next();
}

// Rotas de autenticação
app.post('/api/cadastro', (req, res) => {
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
    const resultado = db.prepare('INSERT INTO usuarios (nome, email, senha) VALUES (?, ?, ?)').run(nome, email, senhaHash);

    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    db.prepare('INSERT INTO sessoes (usuario_id, token) VALUES (?, ?)').run(resultado.lastInsertRowid, token);

    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ sucesso: true, usuario: { id: resultado.lastInsertRowid, nome, email, tipo: 'cliente' } });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao cadastrar usuário' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const { email, senha } = req.body;

    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email);
    if (!usuario || !bcrypt.compareSync(senha, usuario.senha)) {
      return res.status(401).json({ erro: 'Email ou senha incorretos' });
    }

    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    db.prepare('INSERT INTO sessoes (usuario_id, token) VALUES (?, ?)').run(usuario.id, token);

    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.json({ 
      sucesso: true, 
      usuario: { 
        id: usuario.id, 
        nome: usuario.nome, 
        email: usuario.email, 
        tipo: usuario.tipo 
      } 
    });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao fazer login' });
  }
});

app.post('/api/logout', autenticar, (req, res) => {
  const token = req.cookies.token;
  db.prepare('DELETE FROM sessoes WHERE token = ?').run(token);
  res.clearCookie('token');
  res.json({ sucesso: true });
});

app.get('/api/usuario', autenticar, (req, res) => {
  res.json({ usuario: req.usuario });
});

// Rotas de produtos
app.get('/api/produtos', (req, res) => {
  try {
    const { categoria } = req.query;
    let produtos;
    
    if (categoria && categoria !== 'todas') {
      produtos = db.prepare('SELECT * FROM produtos WHERE categoria = ? ORDER BY criado_em DESC').all(categoria);
    } else {
      produtos = db.prepare('SELECT * FROM produtos ORDER BY criado_em DESC').all();
    }
    
    res.json({ produtos });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar produtos' });
  }
});

app.get('/api/produtos/:id', (req, res) => {
  try {
    const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(req.params.id);
    if (!produto) {
      return res.status(404).json({ erro: 'Produto não encontrado' });
    }
    res.json({ produto });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar produto' });
  }
});

app.get('/api/categorias', (req, res) => {
  try {
    const categorias = db.prepare('SELECT DISTINCT categoria FROM produtos ORDER BY categoria').all();
    res.json({ categorias: categorias.map(c => c.categoria) });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar categorias' });
  }
});

// Rotas administrativas de produtos
app.post('/api/admin/produtos', autenticar, verificarAdmin, (req, res) => {
  try {
    const { nome, descricao, preco, categoria, imagem, estoque } = req.body;

    if (!nome || !preco || !categoria) {
      return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
    }

    const resultado = db.prepare(
      'INSERT INTO produtos (nome, descricao, preco, categoria, imagem, estoque) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(nome, descricao || '', preco, categoria, imagem || '', estoque || 0);

    res.json({ sucesso: true, id: resultado.lastInsertRowid });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao criar produto' });
  }
});

app.put('/api/admin/produtos/:id', autenticar, verificarAdmin, (req, res) => {
  try {
    const { nome, descricao, preco, categoria, imagem, estoque } = req.body;
    const { id } = req.params;

    db.prepare(
      'UPDATE produtos SET nome = ?, descricao = ?, preco = ?, categoria = ?, imagem = ?, estoque = ? WHERE id = ?'
    ).run(nome, descricao, preco, categoria, imagem, estoque, id);

    res.json({ sucesso: true });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar produto' });
  }
});

app.delete('/api/admin/produtos/:id', autenticar, verificarAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM produtos WHERE id = ?').run(req.params.id);
    res.json({ sucesso: true });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao deletar produto' });
  }
});

// Rotas de pedidos
app.post('/api/pedidos', autenticar, (req, res) => {
  try {
    const { itens } = req.body;

    if (!itens || itens.length === 0) {
      return res.status(400).json({ erro: 'Carrinho vazio' });
    }

    let total = 0;
    const itensValidados = [];

    for (const item of itens) {
      const produto = db.prepare('SELECT * FROM produtos WHERE id = ?').get(item.produtoId);
      if (!produto) {
        return res.status(400).json({ erro: `Produto ${item.produtoId} não encontrado` });
      }
      if (produto.estoque < item.quantidade) {
        return res.status(400).json({ erro: `Estoque insuficiente para ${produto.nome}` });
      }
      total += produto.preco * item.quantidade;
      itensValidados.push({
        produtoId: produto.id,
        quantidade: item.quantidade,
        precoUnitario: produto.preco
      });
    }

    const pedido = db.prepare('INSERT INTO pedidos (usuario_id, total) VALUES (?, ?)').run(req.usuario.id, total);

    const stmtItem = db.prepare('INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)');
    const stmtEstoque = db.prepare('UPDATE produtos SET estoque = estoque - ? WHERE id = ?');

    for (const item of itensValidados) {
      stmtItem.run(pedido.lastInsertRowid, item.produtoId, item.quantidade, item.precoUnitario);
      stmtEstoque.run(item.quantidade, item.produtoId);
    }

    res.json({ sucesso: true, pedidoId: pedido.lastInsertRowid });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao criar pedido' });
  }
});

app.get('/api/pedidos', autenticar, (req, res) => {
  try {
    const pedidos = db.prepare(`
      SELECT p.*, u.nome as usuario_nome, u.email as usuario_email
      FROM pedidos p
      JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.usuario_id = ?
      ORDER BY p.criado_em DESC
    `).all(req.usuario.id);

    for (const pedido of pedidos) {
      pedido.itens = db.prepare(`
        SELECT ip.*, prod.nome as produto_nome, prod.imagem as produto_imagem
        FROM itens_pedido ip
        JOIN produtos prod ON ip.produto_id = prod.id
        WHERE ip.pedido_id = ?
      `).all(pedido.id);
    }

    res.json({ pedidos });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

app.get('/api/admin/pedidos', autenticar, verificarAdmin, (req, res) => {
  try {
    const pedidos = db.prepare(`
      SELECT p.*, u.nome as usuario_nome, u.email as usuario_email
      FROM pedidos p
      JOIN usuarios u ON p.usuario_id = u.id
      ORDER BY p.criado_em DESC
    `).all();

    for (const pedido of pedidos) {
      pedido.itens = db.prepare(`
        SELECT ip.*, prod.nome as produto_nome, prod.imagem as produto_imagem
        FROM itens_pedido ip
        JOIN produtos prod ON ip.produto_id = prod.id
        WHERE ip.pedido_id = ?
      `).all(pedido.id);
    }

    res.json({ pedidos });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao buscar pedidos' });
  }
});

app.put('/api/admin/pedidos/:id/status', autenticar, verificarAdmin, (req, res) => {
  try {
    const { status } = req.body;
    db.prepare('UPDATE pedidos SET status = ? WHERE id = ?').run(status, req.params.id);
    res.json({ sucesso: true });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar status do pedido' });
  }
});

// Servir HTML
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
  console.log(`Login admin: admin@loja.com / admin123`);
});
