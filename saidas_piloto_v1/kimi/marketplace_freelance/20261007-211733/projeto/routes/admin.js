const express = require('express');
const db = require('../database');
const { requireAdmin } = require('../middleware/auth');
const router = express.Router();

// Todos os serviços
router.get('/services', requireAdmin, (req, res) => {
  const services = db.prepare(`
    SELECT s.*, u.name as provider_name, u.email as provider_email
    FROM services s
    JOIN users u ON s.user_id = u.id
    ORDER BY s.created_at DESC
  `).all();
  res.json(services);
});

// Aprovar serviço
router.patch('/services/:id/approve', requireAdmin, (req, res) => {
  db.prepare('UPDATE services SET status = ? WHERE id = ?').run('approved', req.params.id);
  res.json({ success: true });
});

// Rejeitar serviço
router.patch('/services/:id/reject', requireAdmin, (req, res) => {
  db.prepare('UPDATE services SET status = ? WHERE id = ?').run('rejected', req.params.id);
  res.json({ success: true });
});

// Deletar serviço
router.delete('/services/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Todos os usuários
router.get('/users', requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, is_admin, is_suspended, created_at
    FROM users
    ORDER BY created_at DESC
  `).all();
  res.json(users);
});

// Suspender/reativar usuário
router.patch('/users/:id/toggle-suspend', requireAdmin, (req, res) => {
  const user = db.prepare('SELECT is_suspended FROM users WHERE id = ?').get(req.params.id);
  
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' });
  }

  const newStatus = user.is_suspended === 1 ? 0 : 1;
  db.prepare('UPDATE users SET is_suspended = ? WHERE id = ?').run(newStatus, req.params.id);
  
  res.json({ success: true, suspended: newStatus === 1 });
});

// Todos os contratos
router.get('/contracts', requireAdmin, (req, res) => {
  const contracts = db.prepare(`
    SELECT 
      c.*,
      s.title as service_title,
      s.price,
      client.name as client_name,
      client.email as client_email,
      provider.name as provider_name,
      provider.email as provider_email
    FROM contracts c
    JOIN services s ON c.service_id = s.id
    JOIN users client ON c.client_id = client.id
    JOIN users provider ON c.provider_id = provider.id
    ORDER BY c.created_at DESC
  `).all();
  res.json(contracts);
});

module.exports = router;
