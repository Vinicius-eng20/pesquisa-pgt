const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database');
const { authenticateToken, requireManager } = require('../middleware/auth');

const router = express.Router();

// Listar todos os quartos (público)
router.get('/', (req, res) => {
  try {
    const { checkIn, checkOut } = req.query;
    
    let query = 'SELECT * FROM rooms WHERE active = 1';
    let params = [];

    // Se datas fornecidas, verificar disponibilidade
    if (checkIn && checkOut) {
      query = `
        SELECT r.* FROM rooms r
        WHERE r.active = 1
        AND r.id NOT IN (
          SELECT room_id FROM reservations
          WHERE status IN ('pending', 'confirmed')
          AND (
            (check_in <= ? AND check_out > ?)
            OR (check_in < ? AND check_out >= ?)
            OR (check_in >= ? AND check_out <= ?)
          )
        )
      `;
      params = [checkIn, checkIn, checkOut, checkOut, checkIn, checkOut];
    }

    const rooms = db.prepare(query).all(...params);
    res.json(rooms);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar quartos' });
  }
});

// Obter quarto específico
router.get('/:id', (req, res) => {
  try {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ? AND active = 1').get(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Quarto não encontrado' });
    }
    res.json(room);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar quarto' });
  }
});

// Criar quarto (apenas gerente)
router.post('/', authenticateToken, requireManager, [
  body('name').trim().isLength({ min: 2 }),
  body('price_per_night').isFloat({ min: 0 }),
  body('capacity').isInt({ min: 1 })
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, price_per_night, capacity, amenities, image_url } = req.body;

    const stmt = db.prepare(`
      INSERT INTO rooms (name, description, price_per_night, capacity, amenities, image_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(name, description, price_per_night, capacity, amenities, image_url);

    res.status(201).json({
      message: 'Quarto cadastrado com sucesso',
      roomId: result.lastInsertRowid
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cadastrar quarto' });
  }
});

// Atualizar quarto (apenas gerente)
router.put('/:id', authenticateToken, requireManager, [
  body('name').trim().isLength({ min: 2 }),
  body('price_per_night').isFloat({ min: 0 }),
  body('capacity').isInt({ min: 1 })
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, price_per_night, capacity, amenities, image_url, active } = req.body;

    const stmt = db.prepare(`
      UPDATE rooms
      SET name = ?, description = ?, price_per_night = ?, capacity = ?, amenities = ?, image_url = ?, active = ?
      WHERE id = ?
    `);
    
    const result = stmt.run(name, description, price_per_night, capacity, amenities, image_url, active ? 1 : 0, req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Quarto não encontrado' });
    }

    res.json({ message: 'Quarto atualizado com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar quarto' });
  }
});

// Deletar quarto (apenas gerente)
router.delete('/:id', authenticateToken, requireManager, (req, res) => {
  try {
    // Verificar se há reservas ativas
    const activeReservations = db.prepare(`
      SELECT COUNT(*) as count FROM reservations
      WHERE room_id = ? AND status IN ('pending', 'confirmed')
    `).get(req.params.id);

    if (activeReservations.count > 0) {
      return res.status(400).json({ error: 'Não é possível excluir quarto com reservas ativas' });
    }

    // Soft delete
    const stmt = db.prepare('UPDATE rooms SET active = 0 WHERE id = ?');
    const result = stmt.run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Quarto não encontrado' });
    }

    res.json({ message: 'Quarto removido com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao remover quarto' });
  }
});

module.exports = router;
