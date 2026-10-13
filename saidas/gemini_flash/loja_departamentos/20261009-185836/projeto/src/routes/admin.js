const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database');

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Apenas o dono da loja pode acessar esta área.' });
  }
  next();
}

router.use(requireAdmin);

router.get('/stats', async (req, res) => {
  try {
    const totalOrders = await get(`SELECT COUNT(*) as count FROM orders`);
    const totalRevenue = await get(`SELECT COALESCE(SUM(total), 0) as total FROM orders WHERE status != 'Cancelado'`);
    const totalProducts = await get(`SELECT COUNT(*) as count FROM products`);
    const totalCustomers = await get(`SELECT COUNT(*) as count FROM users WHERE role = 'customer'`);
    const lowStock = await get(`SELECT COUNT(*) as count FROM products WHERE stock <= 5`);

    res.json({
      totalOrders: totalOrders.count,
      totalRevenue: totalRevenue.total,
      totalProducts: totalProducts.count,
      totalCustomers: totalCustomers.count,
      lowStock: lowStock.count
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/orders', async (req, res) => {
  try {
    const orders = await all(
      `SELECT o.*, u.name as customer_name, u.email as customer_email
       FROM orders o
       JOIN users u ON o.user_id = u.id
       ORDER BY o.id DESC`
    );

    for (const order of orders) {
      order.items = await all(`SELECT * FROM order_items WHERE order_id = ?`, [order.id]);
    }

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/orders/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Pendente', 'Em Separação', 'Enviado', 'Entregue', 'Cancelado'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ error: 'Situação de pedido inválida.' });
    }

    await run(`UPDATE orders SET status = ? WHERE id = ?`, [status, req.params.id]);
    res.json({ message: 'Situação do pedido atualizada com sucesso!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/customers', async (req, res) => {
  try {
    const customers = await all(
      `SELECT id, name, email, created_at,
        (SELECT COUNT(*) FROM orders WHERE orders.user_id = users.id) as total_orders
       FROM users
       WHERE role = 'customer'
       ORDER BY id DESC`
    );
    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
