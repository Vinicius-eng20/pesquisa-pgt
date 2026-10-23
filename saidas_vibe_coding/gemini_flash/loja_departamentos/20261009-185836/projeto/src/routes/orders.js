const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database');

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Você precisa estar logado para continuar.' });
  }
  next();
}

router.use(requireAuth);

router.post('/checkout', async (req, res) => {
  try {
    const { shipping_address, payment_method } = req.body;

    if (!shipping_address || !shipping_address.trim()) {
      return res.status(400).json({ error: 'Informe o endereço completo para entrega.' });
    }

    const cartItems = await all(
      `SELECT c.quantity, p.id as product_id, p.name, p.price, p.stock
       FROM cart_items c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [req.user.id]
    );

    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Seu carrinho está vazio.' });
    }

    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        return res.status(400).json({
          error: `O produto "${item.name}" só possui ${item.stock} unidades em estoque.`
        });
      }
    }

    const total = cartItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    const orderRes = await run(
      `INSERT INTO orders (user_id, total, status, shipping_address, payment_method) VALUES (?, ?, 'Pendente', ?, ?)`,
      [req.user.id, total, shipping_address.trim(), payment_method || 'Cartão de Crédito']
    );

    const orderId = orderRes.lastID;

    for (const item of cartItems) {
      await run(
        `INSERT INTO order_items (order_id, product_id, product_name, price, quantity) VALUES (?, ?, ?, ?, ?)`,
        [orderId, item.product_id, item.name, item.price, item.quantity]
      );

      await run(
        `UPDATE products SET stock = stock - ? WHERE id = ?`,
        [item.quantity, item.product_id]
      );
    }

    await run(`DELETE FROM cart_items WHERE user_id = ?`, [req.user.id]);

    res.status(201).json({
      message: 'Pedido realizado com sucesso!',
      orderId,
      total
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/my-orders', async (req, res) => {
  try {
    const orders = await all(
      `SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC`,
      [req.user.id]
    );

    for (const order of orders) {
      order.items = await all(
        `SELECT * FROM order_items WHERE order_id = ?`,
        [order.id]
      );
    }

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
