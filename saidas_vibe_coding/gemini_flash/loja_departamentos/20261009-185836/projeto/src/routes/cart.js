const express = require('express');
const router = express.Router();
const { run, get, all } = require('../database');

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Você precisa estar logado para acessar seu carrinho.' });
  }
  next();
}

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const items = await all(
      `SELECT c.id as cart_id, c.quantity, p.id as product_id, p.name, p.price, p.stock, p.image,
              (c.quantity * p.price) as subtotal
       FROM cart_items c
       JOIN products p ON c.product_id = p.id
       WHERE c.user_id = ?`,
      [req.user.id]
    );

    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    res.json({ items, total });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/add', async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    const qty = parseInt(quantity) || 1;

    const product = await get(`SELECT * FROM products WHERE id = ?`, [product_id]);
    if (!product) {
      return res.status(404).json({ error: 'Produto não encontrado.' });
    }

    if (product.stock < qty) {
      return res.status(400).json({ error: 'Estoque insuficiente para a quantidade solicitada.' });
    }

    const existing = await get(
      `SELECT * FROM cart_items WHERE user_id = ? AND product_id = ?`,
      [req.user.id, product_id]
    );

    if (existing) {
      const newQty = existing.quantity + qty;
      if (product.stock < newQty) {
        return res.status(400).json({ error: `Você já tem ${existing.quantity} no carrinho. Estoque máximo disponível: ${product.stock}.` });
      }
      await run(`UPDATE cart_items SET quantity = ? WHERE id = ?`, [newQty, existing.id]);
    } else {
      await run(
        `INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)`,
        [req.user.id, product_id, qty]
      );
    }

    res.json({ message: 'Produto adicionado ao seu carrinho!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/update', async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    const qty = parseInt(quantity);

    if (qty <= 0) {
      await run(`DELETE FROM cart_items WHERE user_id = ? AND product_id = ?`, [req.user.id, product_id]);
      return res.json({ message: 'Item removido do carrinho.' });
    }

    const product = await get(`SELECT stock FROM products WHERE id = ?`, [product_id]);
    if (!product || product.stock < qty) {
      return res.status(400).json({ error: 'Quantidade maior que o estoque disponível.' });
    }

    await run(
      `UPDATE cart_items SET quantity = ? WHERE user_id = ? AND product_id = ?`,
      [qty, req.user.id, product_id]
    );

    res.json({ message: 'Carrinho atualizado.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/remove/:productId', async (req, res) => {
  try {
    await run(
      `DELETE FROM cart_items WHERE user_id = ? AND product_id = ?`,
      [req.user.id, req.params.productId]
    );
    res.json({ message: 'Item removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/clear', async (req, res) => {
  try {
    await run(`DELETE FROM cart_items WHERE user_id = ?`, [req.user.id]);
    res.json({ message: 'Carrinho esvaziado.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
