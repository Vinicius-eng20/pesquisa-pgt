const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-super-segura-marketplace-2025';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de Autenticação
function autenticarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ erro: 'Acesso não autorizado. Faça login.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ erro: 'Sessão inválida ou expirada. Faça login novamente.' });
    }

    const usuario = db.prepare('SELECT id, nome, email, papel, suspenso FROM usuarios WHERE id = ?').get(decoded.id);

    if (!usuario) {
      return res.status(404).json({ erro: 'Usuário não encontrado.' });
    }

    if (usuario.suspenso === 1) {
      return res.status(403).json({ erro: 'Sua conta foi suspensa pela administração da plataforma.' });
    }

    req.usuario = usuario;
    next();
  });
}

// Middleware exclusivo do Administrador
function apenasAdmin(req, res, next) {
  if (req.usuario.papel !== 'admin') {
    return res.status(403).json({ erro: 'Apenas administradores podem realizar esta ação.' });
  }
  next();
}

/* ==========================================================
   ROTAS DE AUTENTICAÇÃO E PERFIL
========================================================== */

// Cadastro de novos usuários
app.post('/api/auth/cadastro', (req, res) => {
  const { nome, email, senha, telefone, bio } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: 'Nome, e-mail e senha são obrigatórios.' });
  }

  try {
    const usuarioExistente = db.prepare('SELECT id FROM usuarios WHERE email = ?').get(email.trim().toLowerCase());
    if (usuarioExistente) {
      return res.status(400).json({ erro: 'Já existe uma conta cadastrada com este e-mail.' });
    }

    const senhaHash = bcrypt.hashSync(senha, 10);
    const stmt = db.prepare(`
      INSERT INTO usuarios (nome, email, senha, telefone, bio, papel, suspenso)
      VALUES (?, ?, ?, ?, ?, 'usuario', 0)
    `);

    const resultado = stmt.run(nome.trim(), email.trim().toLowerCase(), senhaHash, telefone || '', bio || '');

    const novoUsuario = {
      id: resultado.lastInsertRowid,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      papel: 'usuario'
    };

    const token = jwt.sign(novoUsuario, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      mensagem: 'Cadastro realizado com sucesso!',
      token,
      usuario: novoUsuario
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao cadastrar usuário. ' + error.message });
  }
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: 'E-mail e senha são obrigatórios.' });
  }

  try {
    const usuario = db.prepare('SELECT * FROM usuarios WHERE email = ?').get(email.trim().toLowerCase());

    if (!usuario) {
      return res.status(400).json({ erro: 'E-mail ou senha incorretos.' });
    }

    if (usuario.suspenso === 1) {
      return res.status(403).json({ erro: 'Esta conta está suspensa pelo administrador.' });
    }

    const senhaValida = bcrypt.compareSync(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(400).json({ erro: 'E-mail ou senha incorretos.' });
    }

    const dadosToken = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      papel: usuario.papel
    };

    const token = jwt.sign(dadosToken, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      mensagem: 'Login realizado com sucesso!',
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        telefone: usuario.telefone,
        bio: usuario.bio,
        papel: usuario.papel
      }
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro no servidor: ' + error.message });
  }
});

// Checar sessão e dados atuais do usuário logado
app.get('/api/auth/me', autenticarToken, (req, res) => {
  const usuario = db.prepare('SELECT id, nome, email, telefone, bio, papel, criado_em FROM usuarios WHERE id = ?').get(req.usuario.id);
  res.json({ usuario });
});

/* ==========================================================
   ROTAS DE SERVIÇOS
========================================================== */

// Listar serviços públicos (apenas aprovados e de usuários ativos)
app.get('/api/servicos', (req, res) => {
  const { categoria, busca } = req.query;
  let query = `
    SELECT s.*, u.nome as prestador_nome, u.email as prestador_email, u.telefone as prestador_telefone
    FROM servicos s
    JOIN usuarios u ON s.usuario_id = u.id
    WHERE s.status = 'aprovado' AND u.suspenso = 0
  `;
  const params = [];

  if (categoria && categoria !== 'todas') {
    query += ` AND s.categoria = ?`;
    params.push(categoria);
  }

  if (busca && busca.trim() !== '') {
    query += ` AND (s.titulo LIKE ? OR s.descricao LIKE ?)`;
    params.push(`%${busca.trim()}%`, `%${busca.trim()}%`);
  }

  query += ` ORDER BY s.id DESC`;

  const servicos = db.prepare(query).all(...params);
  res.json(servicos);
});

// Obter detalhes de um serviço específico
app.get('/api/servicos/:id', (req, res) => {
  const servico = db.prepare(`
    SELECT s.*, u.nome as prestador_nome, u.email as prestador_email, u.telefone as prestador_telefone, u.bio as prestador_bio
    FROM servicos s
    JOIN usuarios u ON s.usuario_id = u.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!servico) {
    return res.status(404).json({ erro: 'Serviço não encontrado.' });
  }

  res.json(servico);
});

// Criar novo serviço ofertado
app.post('/api/servicos', autenticarToken, (req, res) => {
  const { titulo, categoria, preco, prazo_dias, descricao } = req.body;

  if (!titulo || !categoria || !preco || !prazo_dias || !descricao) {
    return res.status(400).json({ erro: 'Preencha todos os campos do serviço.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO servicos (usuario_id, titulo, categoria, preco, prazo_dias, descricao, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pendente')
    `);

    const resDb = stmt.run(
      req.usuario.id,
      titulo.trim(),
      categoria.trim(),
      parseFloat(preco),
      parseInt(prazo_dias, 10),
      descricao.trim()
    );

    res.status(201).json({
      mensagem: 'Serviço enviado com sucesso! Ele ficará disponível após aprovação do administrador.',
      id: resDb.lastInsertRowid
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar serviço: ' + error.message });
  }
});

// Meus serviços publicados
app.get('/api/meus-servicos', autenticarToken, (req, res) => {
  const servicos = db.prepare(`
    SELECT * FROM servicos
    WHERE usuario_id = ?
    ORDER BY id DESC
  `).all(req.usuario.id);

  res.json(servicos);
});

// Excluir serviço próprio
app.delete('/api/meus-servicos/:id', autenticarToken, (req, res) => {
  const servico = db.prepare('SELECT id FROM servicos WHERE id = ? AND usuario_id = ?').get(req.params.id, req.usuario.id);

  if (!servico) {
    return res.status(404).json({ erro: 'Serviço não encontrado ou você não tem permissão para excluí-lo.' });
  }

  db.prepare('DELETE FROM servicos WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Serviço removido com sucesso!' });
});

/* ==========================================================
   ROTAS DE CONTRATOS (CONTRATAR E ACOMPANHAR)
========================================================== */

// Contratar um serviço
app.post('/api/contratos', autenticarToken, (req, res) => {
  const { servico_id, detalhes_pedido } = req.body;

  if (!servico_id) {
    return res.status(400).json({ erro: 'Serviço não informado.' });
  }

  const servico = db.prepare(`
    SELECT s.*, u.suspenso as prestador_suspenso
    FROM servicos s
    JOIN usuarios u ON s.usuario_id = u.id
    WHERE s.id = ?
  `).get(servico_id);

  if (!servico) {
    return res.status(404).json({ erro: 'Serviço não encontrado.' });
  }

  if (servico.status !== 'aprovado' || servico.prestador_suspenso === 1) {
    return res.status(400).json({ erro: 'Este serviço não está disponível para contratação no momento.' });
  }

  if (servico.usuario_id === req.usuario.id) {
    return res.status(400).json({ erro: 'Você não pode contratar o seu próprio serviço.' });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO contratos (servico_id, cliente_id, prestador_id, valor, detalhes_pedido, status)
      VALUES (?, ?, ?, ?, ?, 'em_andamento')
    `);

    const resDb = stmt.run(
      servico.id,
      req.usuario.id,
      servico.usuario_id,
      servico.preco,
      detalhes_pedido || 'Contratação padrão.'
    );

    res.status(201).json({
      mensagem: 'Contrato firmado com sucesso! O prestador já foi notificado.',
      contrato_id: resDb.lastInsertRowid
    });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao contratar serviço: ' + error.message });
  }
});

// Listar todos os contratos do usuário (tanto como cliente quanto como prestador)
app.get('/api/meus-contratos', autenticarToken, (req, res) => {
  const comoCliente = db.prepare(`
    SELECT c.*, s.titulo as servico_titulo, s.categoria as servico_categoria,
           u.nome as outro_nome, u.email as outro_email, u.telefone as outro_telefone
    FROM contratos c
    JOIN servicos s ON c.servico_id = s.id
    JOIN usuarios u ON c.prestador_id = u.id
    WHERE c.cliente_id = ?
    ORDER BY c.id DESC
  `).all(req.usuario.id);

  const comoPrestador = db.prepare(`
    SELECT c.*, s.titulo as servico_titulo, s.categoria as servico_categoria,
           u.nome as outro_nome, u.email as outro_email, u.telefone as outro_telefone
    FROM contratos c
    JOIN servicos s ON c.servico_id = s.id
    JOIN usuarios u ON c.cliente_id = u.id
    WHERE c.prestador_id = ?
    ORDER BY c.id DESC
  `).all(req.usuario.id);

  res.json({
    contratadosPorMim: comoCliente,
    meusTrabalhos: comoPrestador
  });
});

// Atualizar status do contrato (concluir ou cancelar)
app.patch('/api/contratos/:id/status', autenticarToken, (req, res) => {
  const { status } = req.body;
  const contratoId = req.params.id;

  if (!['concluido', 'cancelado'].includes(status)) {
    return res.status(400).json({ erro: 'Status inválido. Escolha "concluido" ou "cancelado".' });
  }

  const contrato = db.prepare('SELECT * FROM contratos WHERE id = ?').get(contratoId);

  if (!contrato) {
    return res.status(404).json({ erro: 'Contrato não encontrado.' });
  }

  // Apenas cliente, prestador ou admin podem alterar o status
  if (contrato.cliente_id !== req.usuario.id && contrato.prestador_id !== req.usuario.id && req.usuario.papel !== 'admin') {
    return res.status(403).json({ erro: 'Você não tem permissão para alterar este contrato.' });
  }

  db.prepare(`
    UPDATE contratos 
    SET status = ?, atualizado_em = CURRENT_TIMESTAMP 
    WHERE id = ?
  `).run(status, contratoId);

  res.json({ mensagem: `Status do contrato atualizado para: ${status}!` });
});

/* ==========================================================
   PAINEL DO ADMINISTRADOR (EXCLUSIVO)
========================================================== */

// Estatísticas gerais para o Admin
app.get('/api/admin/estatisticas', autenticarToken, apenasAdmin, (req, res) => {
  const totalUsuarios = db.prepare('SELECT COUNT(*) as count FROM usuarios').get().count;
  const totalServicos = db.prepare('SELECT COUNT(*) as count FROM servicos').get().count;
  const pendentes = db.prepare("SELECT COUNT(*) as count FROM servicos WHERE status = 'pendente'").get().count;
  const totalContratos = db.prepare('SELECT COUNT(*) as count FROM contratos').get().count;
  const volumeTotal = db.prepare("SELECT COALESCE(SUM(valor), 0) as total FROM contratos WHERE status != 'cancelado'").get().total;

  res.json({
    totalUsuarios,
    totalServicos,
    pendentes,
    totalContratos,
    volumeTotal
  });
});

// Listar todos os serviços no sistema
app.get('/api/admin/servicos', autenticarToken, apenasAdmin, (req, res) => {
  const servicos = db.prepare(`
    SELECT s.*, u.nome as prestador_nome, u.email as prestador_email, u.suspenso as prestador_suspenso
    FROM servicos s
    JOIN usuarios u ON s.usuario_id = u.id
    ORDER BY 
      CASE WHEN s.status = 'pendente' THEN 1 ELSE 2 END,
      s.id DESC
  `).all();

  res.json(servicos);
});

// Aprovar ou reprovar serviço
app.patch('/api/admin/servicos/:id/status', autenticarToken, apenasAdmin, (req, res) => {
  const { status } = req.body;
  if (!['aprovado', 'rejeitado', 'pendente'].includes(status)) {
    return res.status(400).json({ erro: 'Status inválido.' });
  }

  db.prepare('UPDATE servicos SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ mensagem: `Serviço marcado como ${status} com sucesso!` });
});

// Remover serviço como admin
app.delete('/api/admin/servicos/:id', autenticarToken, apenasAdmin, (req, res) => {
  db.prepare('DELETE FROM servicos WHERE id = ?').run(req.params.id);
  res.json({ mensagem: 'Serviço excluído permanentemente da plataforma.' });
});

// Listar todos os usuários
app.get('/api/admin/usuarios', autenticarToken, apenasAdmin, (req, res) => {
  const usuarios = db.prepare(`
    SELECT id, nome, email, telefone, bio, papel, suspenso, criado_em,
      (SELECT COUNT(*) FROM servicos WHERE usuario_id = usuarios.id) as total_servicos,
      (SELECT COUNT(*) FROM contratos WHERE prestador_id = usuarios.id OR cliente_id = usuarios.id) as total_contratos
    FROM usuarios
    ORDER BY id DESC
  `).all();

  res.json(usuarios);
});

// Suspender ou reativar usuário
app.patch('/api/admin/usuarios/:id/suspensao', autenticarToken, apenasAdmin, (req, res) => {
  const usuario = db.prepare('SELECT id, papel, suspenso FROM usuarios WHERE id = ?').get(req.params.id);

  if (!usuario) {
    return res.status(404).json({ erro: 'Usuário não encontrado.' });
  }

  if (usuario.papel === 'admin') {
    return res.status(400).json({ erro: 'Não é possível suspender o administrador da plataforma.' });
  }

  const novoStatus = usuario.suspenso === 1 ? 0 : 1;
  db.prepare('UPDATE usuarios SET suspenso = ? WHERE id = ?').run(novoStatus, usuario.id);

  res.json({
    mensagem: novoStatus === 1 ? 'Conta de usuário suspensa com sucesso.' : 'Conta de usuário reativada com sucesso.',
    suspenso: novoStatus
  });
});

// Listar todos os contratos da plataforma
app.get('/api/admin/contratos', autenticarToken, apenasAdmin, (req, res) => {
  const contratos = db.prepare(`
    SELECT c.*, 
           s.titulo as servico_titulo,
           cli.nome as cliente_nome, cli.email as cliente_email,
           pre.nome as prestador_nome, pre.email as prestador_email
    FROM contratos c
    JOIN servicos s ON c.servico_id = s.id
    JOIN usuarios cli ON c.cliente_id = cli.id
    JOIN usuarios pre ON c.prestador_id = pre.id
    ORDER BY c.id DESC
  `).all();

  res.json(contratos);
});

// Fallback para a SPA (Single Page Application)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicialização do servidor
app.listen(PORT, () => {
  console.log('==================================================');
  console.log(`🚀 Plataforma Freelance rodando em http://localhost:${PORT}`);
  console.log(`🔐 Conta Admin padrão: admin@plataforma.com`);
  console.log(`🔑 Senha padrão: admin123`);
  console.log('==================================================');
});
