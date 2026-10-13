const express = require('express');
const { body, validationResult } = require('express-validator');
const { db } = require('../database');
const { authenticateToken, requireManager, requireGuest } = require('../middleware/auth');

const router = express.Router();

// Criar reserva (hóspede)
router.post('/', authenticateToken, requireGuest, [
  body('room_id').isInt(),
  body('check_in').isDate(),
  body('check_out').isDate(),
  body('notes').optional().trim()
], (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { room_id, check_in, check_out, notes } = req.body;
    const user_id = req.user.id;

    // Validar datas
    if (new Date(check_in) >= new Date(check_out)) {
      return res.status(400).json({ error: 'Data de check-out deve ser posterior ao check-in' });
    }

    if (new Date(check_in) < new Date()) {
      return res.status(400).json({ error: 'Data de check-in não pode ser no passado' });
    }

    // Verificar disponibilidade
    const conflicting = db.prepare(`
      SELECT COUNT(*) as count FROM reservations
      WHERE room_id = ? AND status IN ('pending', 'confirmed')
      AND (
        (check_in <= ? AND check_out > ?)
        OR (check_in < ? AND check_out >= ?)
        OR (check_in >= ? AND check_out <= ?)
      )
    `).get(room_id, check_in, check_in, check_out, check_out, check_in, check_out);

    if (conflicting.count > 0) {
      return res.status(400).json({ error: 'Quarto não disponível nas datas selecionadas' });
    }

    // Calcular preço total
    const room = db.prepare('SELECT price_per_night FROM rooms WHERE id = ?').get(room_id);
    if (!room) {
      return res.status(404).json({ error: 'Quarto não encontrado' });
    }

    const nights = Math.ceil((new Date(check_out) - new Date(check_in)) / (1000 * 60 * 60 * 24));
    const total_price = room.price_per_night * nights;

    // Criar reserva
    const stmt = db.prepare(`
      INSERT INTO reservations (user_id, room_id, check_in, check_out, total_price, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(user_id, room_id, check_in, check_out, total_price, notes);

    res.status(201).json({
      message: 'Reserva criada com sucesso. Aguardando confirmação do gerente.',
      reservationId: result.lastInsertRowid,
      total_price
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao criar reserva' });
  }
});

// Listar reservas do usuário (hóspede)
router.get('/my-reservations', authenticateToken, requireGuest, (req, res) => {
  try {
    const reservations = db.prepare(`
      SELECT r.*, rooms.name as room_name, rooms.image_url, users.name as guest_name
      FROM reservations r
      JOIN rooms ON r.room_id = rooms.id
      JOIN users ON r.user_id = users.id
      WHERE r.user_id = ?
      ORDER BY r.check_in DESC
    `).all(req.user.id);

    res.json(reservations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar reservas' });
  }
});

// Listar todas as reservas (gerente)
router.get('/all', authenticateToken, requireManager, (req, res) => {
  try {
    const { status } = req.query;
    
    let query = `
      SELECT r.*, rooms.name as room_name, users.name as guest_name, users.email as guest_email
      FROM reservations r
      JOIN rooms ON r.room_id = rooms.id
      JOIN users ON r.user_id = users.id
    `;
    let params = [];

    if (status) {
      query += ' WHERE r.status = ?';
      params.push(status);
    }

    query += ' ORDER BY r.created_at DESC';

    const reservations = db.prepare(query).all(...params);
    res.json(reservations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao buscar reservas' });
  }
});

// Cancelar reserva (hóspede)
router.put('/:id/cancel', authenticateToken, requireGuest, (req, res) => {
  try {
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    if (reservation.status === 'cancelled') {
      return res.status(400).json({ error: 'Reserva já está cancelada' });
    }

    const stmt = db.prepare('UPDATE reservations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run('cancelled', req.params.id);

    res.json({ message: 'Reserva cancelada com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao cancelar reserva' });
  }
});

// Confirmar reserva (gerente)
router.put('/:id/confirm', authenticateToken, requireManager, (req, res) => {
  try {
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    if (reservation.status !== 'pending') {
      return res.status(400).json({ error: 'Apenas reservas pendentes podem ser confirmadas' });
    }

    const stmt = db.prepare('UPDATE reservations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run('confirmed', req.params.id);

    res.json({ message: 'Reserva confirmada com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao confirmar reserva' });
  }
});

// Recusar reserva (gerente)
router.put('/:id/reject', authenticateToken, requireManager, (req, res) => {
  try {
    const reservation = db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reserva não encontrada' });
    }

    if (reservation.status !== 'pending') {
      return res.status(400).json({ error: 'Apenas reservas pendentes podem ser recusadas' });
    }

    const stmt = db.prepare('UPDATE reservations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run('rejected', req.params.id);

    res.json({ message: 'Reserva recusada' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao recusar reserva' });
  }
});

module.exports = router;
