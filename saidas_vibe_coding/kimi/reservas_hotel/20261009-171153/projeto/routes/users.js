const express = require('express');
const { db } = require('../database');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();

// Listar todos os usuários (apenas gerente)
router.get('/', authenticateToken, requireManager, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, email, name, role, created_at
      FROM users
      ORDER BY created_at DESC
    `).all();
    
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar usuários' });
  }
});

module.exports = router;
