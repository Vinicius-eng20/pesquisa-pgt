const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../database');
const router = express.Router();

// Registro
router.post('/register',
  body('name').trim().isLength({ min: 2 }).escape(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = db.prepare(
        'INSERT INTO users (name, email, password) VALUES (?, ?, ?)'
      ).run(name, email, hashedPassword);

      req.session.userId = result.lastInsertRowid;
      req.session.isAdmin = false;

      res.json({ 
        success: true, 
        user: { id: result.lastInsertRowid, name, email, isAdmin: false } 
      });
    } catch (error) {
      if (error.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
      res.status(500).json({ error: 'Erro ao criar conta' });
    }
  }
);

// Login
router.post('/login',
  body('email').isEmail().normalizeEmail(),
  body('password').exists(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    if (user.is_suspended) {
      return res.status(403).json({ error: 'Conta suspensa' });
    }

    req.session.userId = user.id;
    req.session.isAdmin = user.is_admin === 1;

    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        name: user.name, 
        email: user.email, 
        isAdmin: user.is_admin === 1 
      } 
    });
  }
);

// Logout
router.post('/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Verificar sessão
router.get('/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autenticado' });
  }

  const user = db.prepare('SELECT id, name, email, is_admin FROM users WHERE id = ?')
    .get(req.session.userId);

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  res.json({ 
    user: { 
      id: user.id, 
      name: user.name, 
      email: user.email, 
      isAdmin: user.is_admin === 1 
    } 
  });
});

module.exports = router;
