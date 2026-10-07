const express = require('express');
const db = require('../database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Meus contratos (como cliente ou fornecedor)
router.get('/my', requireAuth, (req, res) => {
  const contracts = db.prepare(`
    SELECT 
      c.*,
      s.title as service_title,
      s.price,
      s.category,
      client.name as client_name,
      provider.name as provider_name
    FROM contracts c
    JOIN services s ON c.service_id = s.id
    JOIN users client ON c.client_id = client.id
    JOIN users provider ON c.provider_id = provider.id
    WHERE c.client_id = ? OR c.provider_id = ?
    ORDER BY c.created_at DESC
  `).all(req.session.userId, req.session.userId);

  res.json(contracts);
});

// Atualizar status do contrato
router.patch('/:id', requireAuth, (req, res) => {
  const { status } = req.body;
  const contractId = req.params.id;

  if (!['active', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido' });
  }

  const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(contractId);

  if (!contract) {
    return res.status(404).json({ error: 'Contrato não encontrado' });
  }

  if (contract.client_id !== req.session.userId && contract.provider_id !== req.session.userId) {
    return res.status(403).json({ error: 'Sem permissão' });
  }

  db.prepare('UPDATE contracts SET status = ? WHERE id = ?').run(status, contractId);
  res.json({ success: true });
});

module.exports = router;
