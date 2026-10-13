const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { run, get, all } = require('../database');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', '..', 'public', 'uploads'));
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, 'produto-' + unique + ext);
  }
});
const upload = multer({ storage });

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito apenas ao dono da loja.' });
  }
  next();
}

router.get('/categories', async (req, res) => {
  try {
    const categories = await all(`SELECT * FROM categories ORDER BY name ASC`);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { category, search, sort } = req.query;
    let query = `
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (category && category !== 'todos') {
      query += ` AND (c.slug = ? OR c.id = ?)`;
      params.push(category, category);
    }

    if (search && search.trim() !== '') {
      query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      params.push(`%${search.trim()}%`, `%${search.trim()}%`);
    }

    if (sort === 'price_asc') {
      query += ` ORDER BY p.price ASC`;
    } else if (sort === 'price_desc') {
      query += ` ORDER BY p.price DESC`;
    } else if (sort === 'name') {
      query += ` ORDER BY p.name ASC`;
    } else {
      query += ` ORDER BY p.id DESC`;
    }

    const products = await all(query, params);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await get(
      `SELECT p.*, c.name as category_name FROM products p JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
      [req.params.id]
    );
    if (!product) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAdmin, upload.single('image_file'), async (req, res) => {
  try {
    const { name, category_id, price, stock, description, image_url } = req.body;

    if (!name || !category_id || !price) {
      return res.status(400).json({ error: 'Nome, departamento e preço são obrigatórios.' });
    }

    let finalImage = image_url || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=700&q=80';
    if (req.file) {
      finalImage = '/uploads/' + req.file.filename;
    }

    const result = await run(
      `INSERT INTO products (name, category_id, price, stock, description, image) VALUES (?, ?, ?, ?, ?, ?)`,
      [name.trim(), category_id, parseFloat(price), parseInt(stock) || 0, description || '', finalImage]
    );

    const newProduct = await get(`SELECT * FROM products WHERE id = ?`, [result.lastID]);
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', requireAdmin, upload.single('image_file'), async (req, res) => {
  try {
    const { name, category_id, price, stock, description, image_url } = req.body;
    const existing = await get(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Produto não encontrado.' });

    let finalImage = existing.image;
    if (req.file) {
      finalImage = '/uploads/' + req.file.filename;
    } else if (image_url && image_url.trim() !== '') {
      finalImage = image_url.trim();
    }

    await run(
      `UPDATE products SET name = ?, category_id = ?, price = ?, stock = ?, description = ?, image = ? WHERE id = ?`,
      [
        name ? name.trim() : existing.name,
        category_id || existing.category_id,
        price !== undefined ? parseFloat(price) : existing.price,
        stock !== undefined ? parseInt(stock) : existing.stock,
        description !== undefined ? description : existing.description,
        finalImage,
        req.params.id
      ]
    );

    const updated = await get(`SELECT * FROM products WHERE id = ?`, [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    await run(`DELETE FROM products WHERE id = ?`, [req.params.id]);
    res.json({ message: 'Produto removido com sucesso.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
