// ============================================================
// 🍽️ SABOR & ARTE - Sistema de Pedidos para Restaurante
// Servidor completo: contas, cardápio, pedidos e painel do gerente
// Tudo salvo em arquivo local (database.json) - sem serviços externos
// ============================================================

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// ------------------------------------------------------------
// 📦 BANCO DE DADOS EM ARQUIVO (tudo fica salvo aqui)
// ------------------------------------------------------------

function criarBancoInicial() {
  const senhaGerente = bcrypt.hashSync('admin123', 10);
  const senhaCliente = bcrypt.hashSync('123456', 10);
  return {
    usuarios: [
      { id: 1, nome: 'Gerente', email: 'gerente@restaurante.com', senha: senhaGerente, papel: 'gerente' },
      { id: 2, nome: 'João Cliente', email: 'joao@email.com', senha: senhaCliente, papel: 'cliente' }
    ],
    pratos: [
      { id: 1, nome: 'Pizza Margherita', descricao: 'Molho de tomate, muçarela de búfala, manjericão fresco e azeite', preco: 42.90, categoria: 'Pizzas', foto: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&q=80', ativo: true },
      { id: 2, nome: 'Lasanha à Bolonhesa', descricao: 'Massa fresca em camadas com molho bolonhesa e queijo gratinado', preco: 38.50, categoria: 'Massas', foto: 'https://images.unsplash.com/photo-1619895092538-128341789043?w=600&q=80', ativo: true },
      { id: 3, nome: 'Hambúrguer Artesanal', descricao: 'Blend 180g, queijo cheddar, bacon, alface, tomate e pão brioche', preco: 32.90, categoria: 'Lanches', foto: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&q=80', ativo: true },
      { id: 4, nome: 'Salmão Grelhado', descricao: 'Filé de salmão com legumes salteados e arroz de limão', preco: 54.90, categoria: 'Pratos', foto: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600&q=80', ativo: true },
      { id: 5, nome: 'Risoto de Cogumelos', descricao: 'Arroz arbóreo cremoso com mix de cogumelos e parmesão', preco: 46.00, categoria: 'Pratos', foto: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=600&q=80', ativo: true },
      { id: 6, nome: 'Salada Caesar', descricao: 'Alface romana, frango grelhado, croutons e molho caesar', preco: 28.90, categoria: 'Saladas', foto: 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=600&q=80', ativo: true },
      { id: 7, nome: 'Brownie com Sorvete', descricao: 'Brownie quente de chocolate com bola de sorvete de creme', preco: 19.90, categoria: 'Sobremesas', foto: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?w=600&q=80', ativo: true },
      { id: 8, nome: 'Suco Natural de Laranja', descricao: 'Suco de laranja fresquinho, feito na hora - 500ml', preco: 9.90, categoria: 'Bebidas', foto: 'https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=600&q=80', ativo: true },
      { id: 9, nome: 'Refrigerante Lata', descricao: 'Coca-Cola, Guaraná ou Fanta - lata 350ml gelada', preco: 6.50, categoria: 'Bebidas', foto: 'https://images.unsplash.com/photo-1581636625402-29b2a704ef13?w=600&q=80', ativo: true },
      { id: 10, nome: 'Espaguete Carbonara', descricao: 'Massa italiana com bacon, gema de ovo, parmesão e pimenta do reino', preco: 36.90, categoria: 'Massas', foto: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?w=600&q=80', ativo: true }
    ],
    pedidos: [],
    proximoIdUsuario: 3,
    proximoIdPrato: 11,
    proximoIdPedido: 1
  };
}

function carregarBanco() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const dados = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      // Garante que todas as chaves existem (proteção contra arquivo corrompido)
      const inicial = criarBancoInicial();
      return {
        usuarios: dados.usuarios || inicial.usuarios,
        pratos: dados.pratos || inicial.pratos,
        pedidos: dados.pedidos || inicial.pedidos,
        proximoIdUsuario: dados.proximoIdUsuario || inicial.proximoIdUsuario,
        proximoIdPrato: dados.proximoIdPrato || inicial.proximoIdPrato,
        proximoIdPedido: dados.proximoIdPedido || inicial.proximoIdPedido
      };
    }
  } catch (erro) {
    console.log('⚠️ Erro ao ler banco de dados, criando novo:', erro.message);
  }
  const novo = criarBancoInicial();
  salvarBanco(novo);
  return novo;
}

let dbCarregado = null;
let salvamentoPendente = false;

function db() {
  if (!dbCarregado) dbCarregado = carregarBanco();
  return dbCarregado;
}

function salvarBanco(dados) {
  if (dados) dbCarregado = dados;
  if (salvamentoPendente) return;
  salvamentoPendente = true;
  setImmediate(() => {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(dbCarregado, null, 2));
    } catch (erro) {
      console.log('⚠️ Erro ao salvar banco:', erro.message);
    }
    salvamentoPendente = false;
  });
}

// ------------------------------------------------------------
// ⚙️ CONFIGURAÇÃO DO SERVIDOR
// ------------------------------------------------------------

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'sabor-e-arte-chave-secreta-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // sessão dura 7 dias
    httpOnly: true,
    secure: false, // Render já cuida do HTTPS na entrada
    sameSite: 'lax'
  }
}));

app.use(express.static(path.join(__dirname, 'public')));

// ------------------------------------------------------------
// 🛡️ FUNÇÕES DE PROTEÇÃO
// ------------------------------------------------------------

function exigirLogin(req, res, next) {
  if (!req.session.usuarioId) {
    return res.status(401).json({ erro: 'Você precisa entrar na sua conta primeiro.' });
  }
  next();
}

function exigirGerente(req, res, next) {
  if (!req.session.usuarioId) {
    return res.status(401).json({ erro: 'Você precisa entrar na sua conta primeiro.' });
  }
  const usuario = db().usuarios.find(u => u.id === req.session.usuarioId);
  if (!usuario || usuario.papel !== 'gerente') {
    return res.status(403).json({ erro: 'Somente o gerente pode fazer isso.' });
  }
  next();
}

function usuarioAtual(req) {
  return db().usuarios.find(u => u.id === req.session.usuarioId);
}

function limparTexto(texto, tamanhoMax = 500) {
  if (typeof texto !== 'string') return '';
  return texto.trim().slice(0, tamanhoMax);
}

// ------------------------------------------------------------
// 👤 ROTAS DE CONTA (cadastro, entrar, sair)
// ------------------------------------------------------------

app.post('/api/cadastro', (req, res) => {
  const nome = limparTexto(req.body.nome, 100);
  const email = limparTexto(req.body.email, 150).toLowerCase();
  const senha = String(req.body.senha || '');

  if (!nome || nome.length < 2) {
    return res.status(400).json({ erro: 'Informe seu nome completo.' });
  }
  if (!email || !email.includes('@') || !email.includes('.')) {
    return res.status(400).json({ erro: 'Informe um e-mail válido.' });
  }
  if (senha.length < 6) {
    return res.status(400).json({ erro: 'A senha precisa ter pelo menos 6 caracteres.' });
  }
  if (db().usuarios.find(u => u.email === email)) {
    return res.status(400).json({ erro: 'Este e-mail já está cadastrado. Tente entrar.' });
  }

  const novoUsuario = {
    id: db().proximoIdUsuario++,
    nome,
    email,
    senha: bcrypt.hashSync(senha, 10),
    papel: 'cliente'
  };
  db().usuarios.push(novoUsuario);
  salvarBanco();

  req.session.usuarioId = novoUsuario.id;
  res.json({ ok: true, usuario: { id: novoUsuario.id, nome, email, papel: 'cliente' } });
});

app.post('/api/entrar', (req, res) => {
  const email = limparTexto(req.body.email, 150).toLowerCase();
  const senha = String(req.body.senha || '');

  const usuario = db().usuarios.find(u => u.email === email);
  if (!usuario || !bcrypt.compareSync(senha, usuario.senha)) {
    return res.status(401).json({ erro: 'E-mail ou senha incorretos.' });
  }

  req.session.usuarioId = usuario.id;
  res.json({ ok: true, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel } });
});

app.post('/api/sair', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/eu', (req, res) => {
  if (!req.session.usuarioId) return res.json({ usuario: null });
  const usuario = usuarioAtual(req);
  if (!usuario) return res.json({ usuario: null });
  res.json({ usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, papel: usuario.papel } });
});

// ------------------------------------------------------------
// 🍕 ROTAS DO CARDÁPIO
// ------------------------------------------------------------

app.get('/api/cardapio', (req, res) => {
  const pratos = db().pratos.filter(p => p.ativo);
  res.json({ pratos });
});

app.get('/api/cardapio/todos', exigirGerente, (req, res) => {
  res.json({ pratos: db().pratos });
});

app.post('/api/pratos', exigirGerente, (req, res) => {
  const nome = limparTexto(req.body.nome, 100);
  const descricao = limparTexto(req.body.descricao, 300);
  const preco = parseFloat(req.body.preco);
  const categoria = limparTexto(req.body.categoria, 50) || 'Geral';
  const foto = limparTexto(req.body.foto, 500);

  if (!nome) return res.status(400).json({ erro: 'Informe o nome do prato.' });
  if (isNaN(preco) || preco <= 0) return res.status(400).json({ erro: 'Informe um preço válido (maior que zero).' });

  const novoPrato = {
    id: db().proximoIdPrato++,
    nome, descricao, preco: Math.round(preco * 100) / 100,
    categoria, foto, ativo: true
  };
  db().pratos.push(novoPrato);
  salvarBanco();
  res.json({ ok: true, prato: novoPrato });
});

app.put('/api/pratos/:id', exigirGerente, (req, res) => {
  const prato = db().pratos.find(p => p.id === parseInt(req.params.id));
  if (!prato) return res.status(404).json({ erro: 'Prato não encontrado.' });

  const nome = limparTexto(req.body.nome, 100);
  const descricao = limparTexto(req.body.descricao, 300);
  const preco = parseFloat(req.body.preco);
  const categoria = limparTexto(req.body.categoria, 50);
  const foto = limparTexto(req.body.foto, 500);

  if (!nome) return res.status(400).json({ erro: 'Informe o nome do prato.' });
  if (isNaN(preco) || preco <= 0) return res.status(400).json({ erro: 'Informe um preço válido.' });

  prato.nome = nome;
  prato.descricao = descricao;
  prato.preco = Math.round(preco * 100) / 100;
  prato.categoria = categoria || 'Geral';
  prato.foto = foto;
  if (typeof req.body.ativo === 'boolean') prato.ativo = req.body.ativo;

  salvarBanco();
  res.json({ ok: true, prato });
});

app.delete('/api/pratos/:id', exigirGerente, (req, res) => {
  const indice = db().pratos.findIndex(p => p.id === parseInt(req.params.id));
  if (indice === -1) return res.status(404).json({ erro: 'Prato não encontrado.' });
  db().pratos.splice(indice, 1);
  salvarBanco();
  res.json({ ok: true });
});

// ------------------------------------------------------------
// 🧾 ROTAS DE PEDIDOS
// ------------------------------------------------------------

const SITUACOES = ['Recebido', 'Preparando', 'Pronto', 'A caminho', 'Entregue', 'Cancelado'];

app.post('/api/pedidos', exigirLogin, (req, res) => {
  const usuario = usuarioAtual(req);
  if (!usuario) return res.status(401).json({ erro: 'Faça login novamente.' });

  const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
  const endereco = limparTexto(req.body.endereco, 300);
  const observacao = limparTexto(req.body.observacao, 300);

  if (itens.length === 0) {
    return res.status(400).json({ erro: 'Seu carrinho está vazio.' });
  }
  if (!endereco) {
    return res.status(400).json({ erro: 'Informe o endereço de entrega.' });
  }
  if (itens.length > 50) {
    return res.status(400).json({ erro: 'Pedido muito grande. Divida em dois pedidos.' });
  }

  let total = 0;
  const itensValidados = [];
  for (const item of itens) {
    const prato = db().pratos.find(p => p.id === parseInt(item.pratoId) && p.ativo);
    const quantidade = parseInt(item.quantidade);
    if (!prato) {
      return res.status(400).json({ erro: 'Um dos pratos não está mais disponível no cardápio.' });
    }
    if (isNaN(quantidade) || quantidade < 1 || quantidade > 99) {
      return res.status(400).json({ erro: 'Quantidade inválida em um dos itens.' });
    }
    total += prato.preco * quantidade;
    itensValidados.push({
      pratoId: prato.id,
      nome: prato.nome,
      preco: prato.preco,
      quantidade
    });
  }

  const novoPedido = {
    id: db().proximoIdPedido++,
    clienteId: usuario.id,
    clienteNome: usuario.nome,
    clienteEmail: usuario.email,
    itens: itensValidados,
    total: Math.round(total * 100) / 100,
    endereco,
    observacao,
    situacao: 'Recebido',
    criadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString()
  };

  db().pedidos.push(novoPedido);
  salvarBanco();
  res.json({ ok: true, pedido: novoPedido });
});

app.get('/api/meus-pedidos', exigirLogin, (req, res) => {
  const meus = db().pedidos
    .filter(p => p.clienteId === req.session.usuarioId)
    .sort((a, b) => b.id - a.id);
  res.json({ pedidos: meus });
});

app.get('/api/pedidos', exigirGerente, (req, res) => {
  const todos = [...db().pedidos].sort((a, b) => b.id - a.id);
  res.json({ pedidos: todos });
});

app.put('/api/pedidos/:id/situacao', exigirGerente, (req, res) => {
  const pedido = db().pedidos.find(p => p.id === parseInt(req.params.id));
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });

  const novaSituacao = limparTexto(req.body.situacao, 30);
  if (!SITUACOES.includes(novaSituacao)) {
    return res.status(400).json({ erro: 'Situação inválida.' });
  }

  pedido.situacao = novaSituacao;
  pedido.atualizadoEm = new Date().toISOString();
  salvarBanco();
  res.json({ ok: true, pedido });
});

app.put('/api/pedidos/:id/cancelar', exigirLogin, (req, res) => {
  const pedido = db().pedidos.find(p => p.id === parseInt(req.params.id));
  if (!pedido) return res.status(404).json({ erro: 'Pedido não encontrado.' });

  const ehDono = pedido.clienteId === req.session.usuarioId;
  const usuario = usuarioAtual(req);
  const ehGerente = usuario && usuario.papel === 'gerente';

  if (!ehDono && !ehGerente) {
    return res.status(403).json({ erro: 'Você não pode cancelar este pedido.' });
  }
  if (pedido.situacao !== 'Recebido') {
    return res.status(400).json({ erro: 'Este pedido já está sendo preparado e não pode ser cancelado.' });
  }

  pedido.situacao = 'Cancelado';
  pedido.atualizadoEm = new Date().toISOString();
  salvarBanco();
  res.json({ ok: true, pedido });
});

// ------------------------------------------------------------
// 📊 ESTATÍSTICAS (só gerente)
// ------------------------------------------------------------

app.get('/api/estatisticas', exigirGerente, (req, res) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const pedidosHoje = db().pedidos.filter(p => p.criadoEm.slice(0, 10) === hoje && p.situacao !== 'Cancelado');
  const faturamentoHoje = pedidosHoje.reduce((soma, p) => soma + p.total, 0);
  const pendentes = db().pedidos.filter(p => ['Recebido', 'Preparando', 'Pronto', 'A caminho'].includes(p.situacao)).length;

  res.json({
    pedidosHoje: pedidosHoje.length,
    faturamentoHoje: Math.round(faturamentoHoje * 100) / 100,
    pendentes,
    totalPedidos: db().pedidos.length,
    totalPratos: db().pratos.filter(p => p.ativo).length
  });
});

// ------------------------------------------------------------
// ▶️ INICIAR O SERVIDOR
// ------------------------------------------------------------

db(); // carrega o banco ao iniciar

app.listen(PORT, () => {
  console.log('');
  console.log('🍽️ ================================================');
  console.log('   SABOR & ARTE - Sistema de Pedidos');
  console.log('   Servidor funcionando!');
  console.log(`   👉 Acesse: http://localhost:${PORT}`);
  console.log('🍽️ ================================================');
  console.log('');
});
