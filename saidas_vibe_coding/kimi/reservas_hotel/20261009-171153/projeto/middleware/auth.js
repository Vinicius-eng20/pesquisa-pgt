const jwt = require('jsonwebtoken');
const { db } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'seu-segredo-super-secreto-mude-em-producao';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido ou expirado' });
    }
    req.user = user;
    next();
  });
}

function requireManager(req, res, next) {
  if (req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Acesso restrito ao gerente' });
  }
  next();
}

function requireGuest(req, res, next) {
  if (req.user.role !== 'guest') {
    return res.status(403).json({ error: 'Acesso restrito a hóspedes' });
  }
  next();
}

module.exports = { authenticateToken, requireManager, requireGuest, JWT_SECRET };
