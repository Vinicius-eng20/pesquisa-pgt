const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');

// Obter usuário logado atual
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const users = db.getUsers();
  const user = users.find(u => u.id === req.session.userId);

  if (!user) {
    req.session.destroy();
    return res.status(401).json({ error: 'Usuário não encontrado' });
  }

  const { senhaHash, ...userSemSenha } = user;
  res.json({ user: userSemSenha });
});

// Cadastro de novos usuários
router.post('/register', (req, res) => {
  const { nome, email, senha, tipo } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  const emailFormatado = email.trim().toLowerCase();
  const users = db.getUsers();

  const usuarioExistente = users.find(u => u.email.toLowerCase() === emailFormatado);
  if (usuarioExistente) {
    return res.status(400).json({ error: 'Já existe uma conta com este e-mail.' });
  }

  const tipoFinal = tipo === 'organizador' ? 'organizador' : 'participante';
  const salt = bcrypt.genSaltSync(10);
  const senhaHash = bcrypt.hashSync(senha, salt);

  const novoUsuario = {
    id: 'user_' + uuidv4(),
    nome: nome.trim(),
    email: emailFormatado,
    senhaHash,
    tipo: tipoFinal,
    criadoEm: new Date().toISOString()
  };

  users.push(novoUsuario);
  db.saveUsers(users);

  // Iniciar sessão automaticamente
  req.session.userId = novoUsuario.id;

  const { senhaHash: _, ...userSemSenha } = novoUsuario;
  res.status(201).json({ mensagem: 'Conta criada com sucesso!', user: userSemSenha });
});

// Login
router.post('/login', (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const emailFormatado = email.trim().toLowerCase();
  const users = db.getUsers();
  const user = users.find(u => u.email.toLowerCase() === emailFormatado);

  if (!user) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  const senhaValida = bcrypt.compareSync(senha, user.senhaHash);
  if (!senhaValida) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }

  req.session.userId = user.id;

  const { senhaHash, ...userSemSenha } = user;
  res.json({ mensagem: 'Login realizado com sucesso!', user: userSemSenha });
});

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao sair' });
    }
    res.clearCookie('connect.sid');
    res.json({ mensagem: 'Desconectado com sucesso' });
  });
});

module.exports = router;
