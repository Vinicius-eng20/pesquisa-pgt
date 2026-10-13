const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { run, get } = require('../database');

const JWT_SECRET = 'supershop_chave_secreta_local_12345';

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await get(`SELECT id FROM users WHERE email = ?`, [cleanEmail]);
    if (existing) {
      return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = await run(
      `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'customer')`,
      [name.trim(), cleanEmail, hashedPassword]
    );

    const user = {
      id: result.lastID,
      name: name.trim(),
      email: cleanEmail,
      role: 'customer'
    };

    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });

    res.json({ message: 'Conta criada com sucesso!', user, token });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao registrar usuário: ' + err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Informe e-mail e senha.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await get(`SELECT * FROM users WHERE email = ?`, [cleanEmail]);
    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const userPayload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(userPayload, JWT_SECRET, { expiresIn: '30d' });
    res.cookie('token', token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: 'lax' });

    res.json({ message: 'Login realizado com sucesso!', user: userPayload, token });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao fazer login: ' + err.message });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Sessão encerrada com sucesso.' });
});

router.get('/me', async (req, res) => {
  try {
    const token = req.cookies.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]);
    if (!token) {
      return res.json({ user: null });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await get(`SELECT id, name, email, role FROM users WHERE id = ?`, [decoded.id]);
    if (!user) {
      return res.json({ user: null });
    }

    res.json({ user });
  } catch (err) {
    res.json({ user: null });
  }
});

module.exports = {
  router,
  JWT_SECRET
};
