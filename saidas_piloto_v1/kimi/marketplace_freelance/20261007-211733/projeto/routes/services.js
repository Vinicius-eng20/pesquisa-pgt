const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

// Listar serviços aprovados (público)
router.get('/', (req, res) => {
  const services = db.prepare(`
    SELECT s.*, u.name as provider_name 
    FROM services s
    JOIN users u ON s.user_id = u.id
    WHERE s.status = 'approved'
    ORDER BY s.created_at DESC
  `).all();
  res.json(services);
});

// Meus serviços
router.get('/my', requireAuth, (req, res) => {
  const services = db.prepare(`
    SELECT s.*, u.name as provider_name 
    FROM services s
    JOIN users u ON s.user_id = u.id
    WHERE s.user_id = ?
    ORDER BY s.created_at DESC
  `).all(req.session.userId);
  res.json(services);
});

// Criar serviço
router.post('/', requireAuth,
  body('title').trim().isLength({ min: 5 }).escape(),
  body('description').trim().isLength({ min: 20 }).escape(),
  body('price').isFloat({ min: 0 }),
  body('category').trim().notEmpty().escape(),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, price, category } = req.body;

    try {
      const result = db.prepare(`
        INSERT INTO services (user_id, title, description, price, category)
        VALUES (?, ?, ?, ?, ?)
      `).run(req.session.userId, title, description, price, category);

      res.json({ success: true, id: result.lastInsertRowid });
    } catch (error) {
      res.status(500).json({ error: 'Erro ao criar serviço' });
    }
  }
);

// Contratar serviço
router.post('/:id/hire', requireAuth, (req, res) => {
  const serviceId = req.params.id;

  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);

  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado' });
  }

  if (service.status !== 'approved') {
    return res.status(400).json({ error: 'Serviço não disponível' });
  }

  if (service.user_id === req.session.userId) {
    return res.status(400).json({ error: 'Você não pode contratar seu próprio serviço' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO contracts (service_id, client_id, provider_id)
      VALUES (?, ?, ?)
    `).run(serviceId, req.session.userId, service.user_id);

    res.json({ success: true, id: result.lastInsertRowid });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao contratar serviço' });
  }
});

// Deletar serviço (apenas dono)
router.delete('/:id', requireAuth, (req, res) => {
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);

  if (!service) {
    return res.status(404).json({ error: 'Serviço não encontrado' });
  }

  if (service.user_id !== req.session.userId) {
    return res.status(403).json({ error: 'Sem permissão' });
  }

  db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
