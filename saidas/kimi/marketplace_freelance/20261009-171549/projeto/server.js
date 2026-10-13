const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const { body, validationResult } = require('express-validator');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sua_chave_secreta_muito_segura_aqui_2024';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Inicializar banco de dados
const db = new Database('marketplace.db');
db.pragma('journal_mode = WAL');

// Criar tabelas
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('user', 'admin')),
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'suspended')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    category TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'removed')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    status TEXT DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (client_id) REFERENCES users(id),
    FOREIGN KEY (provider_id) REFERENCES users(id)
  );
`);

// Criar admin padrão se não existir
const adminEmail = 'admin@marketplace.com';
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
if (!adminExists) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)')
    .run('Administrador', adminEmail, hashedPassword, 'admin');
  console.log('Admin criado: admin@marketplace.com / admin123');
}

// Middleware de autenticação
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token não fornecido' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido' });
    
    // Verificar se usuário está suspenso
    const dbUser = db.prepare('SELECT status FROM users WHERE id = ?').get(user.id);
    if (dbUser.status === 'suspended') {
      return res.status(403).json({ error: 'Conta suspensa' });
    }
    
    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso negado. Requer administrador.' });
  }
  next();
};

// Rotas de Autenticação
app.post('/api/register', [
  body('name').trim().isLength({ min: 2 }).withMessage('Nome deve ter pelo menos 2 caracteres'),
  body('email').isEmail().withMessage('Email inválido'),
  body('password').isLength({ min: 6 }).withMessage('Senha deve ter pelo menos 6 caracteres')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { name, email, password } = req.body;
  
  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
    const result = stmt.run(name, email, hashedPassword);
    
    const token = jwt.sign({ id: result.lastInsertRowid, email, role: 'user' }, JWT_SECRET);
    res.json({ token, user: { id: result.lastInsertRowid, name, email, role: 'user' } });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      res.status(400).json({ error: 'Email já cadastrado' });
    } else {
      res.status(500).json({ error: 'Erro ao criar conta' });
    }
  }
});

app.post('/api/login', [
  body('email').isEmail(),
  body('password').exists()
], (req, res) => {
  const { email, password } = req.body;
  
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(400).json({ error: 'Email ou senha incorretos' });
  
  if (user.status === 'suspended') {
    return res.status(403).json({ error: 'Esta conta está suspensa' });
  }

  const validPassword = bcrypt.compareSync(password, user.password);
  if (!validPassword) return res.status(400).json({ error: 'Email ou senha incorretos' });

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

// Rotas de Serviços (Usuários)
app.get('/api/services', (req, res) => {
  const { category, search } = req.query;
  let query = `
    SELECT s.*, u.name as provider_name 
    FROM services s 
    JOIN users u ON s.user_id = u.id 
    WHERE s.status = 'approved'
  `;
  const params = [];

  if (category) {
    query += ' AND s.category = ?';
    params.push(category);
  }
  if (search) {
    query += ' AND (s.title LIKE ? OR s.description LIKE ?)';
    params.push(`%${search}%`, `%${search}%`);
  }

  query += ' ORDER BY s.created_at DESC';
  
  const services = db.prepare(query).all(...params);
  res.json(services);
});

app.get('/api/my-services', authenticateToken, (req, res) => {
  const services = db.prepare(`
    SELECT * FROM services 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `).all(req.user.id);
  res.json(services);
});

app.post('/api/services', authenticateToken, [
  body('title').trim().isLength({ min: 3 }),
  body('description').trim().isLength({ min: 10 }),
  body('price').isFloat({ min: 0 }),
  body('category').trim().notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, description, price, category } = req.body;
  
  const result = db.prepare(`
    INSERT INTO services (user_id, title, description, price, category, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(req.user.id, title, description, price, category);

  res.json({ id: result.lastInsertRowid, message: 'Serviço criado e aguardando aprovação' });
});

app.put('/api/services/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { title, description, price, category } = req.body;
  
  // Verificar se o serviço pertence ao usuário
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
  if (service.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });

  db.prepare(`
    UPDATE services 
    SET title = ?, description = ?, price = ?, category = ?, status = 'pending', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, description, price, category, id);

  res.json({ message: 'Serviço atualizado e enviado para reaprovação' });
});

app.delete('/api/services/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
  if (service.user_id !== req.user.id) return res.status(403).json({ error: 'Acesso negado' });

  // Verificar se há contratos ativos
  const activeContracts = db.prepare(`
    SELECT COUNT(*) as count FROM contracts 
    WHERE service_id = ? AND status = 'active'
  `).get(id);

  if (activeContracts.count > 0) {
    return res.status(400).json({ error: 'Não é possível excluir serviço com contratos ativos' });
  }

  db.prepare('DELETE FROM services WHERE id = ?').run(id);
  res.json({ message: 'Serviço excluído' });
});

// Rotas de Contratos
app.post('/api/contracts', authenticateToken, [
  body('service_id').isInt()
], (req, res) => {
  const { service_id } = req.body;
  
  const service = db.prepare('SELECT * FROM services WHERE id = ?').get(service_id);
  if (!service) return res.status(404).json({ error: 'Serviço não encontrado' });
  if (service.status !== 'approved') return res.status(400).json({ error: 'Serviço não disponível' });
  if (service.user_id === req.user.id) return res.status(400).json({ error: 'Não pode contratar próprio serviço' });

  // Verificar se já existe contrato ativo para este serviço e cliente
  const existing = db.prepare(`
    SELECT id FROM contracts 
    WHERE service_id = ? AND client_id = ? AND status = 'active'
  `).get(service_id, req.user.id);

  if (existing) return res.status(400).json({ error: 'Você já possui um contrato ativo para este serviço' });

  const result = db.prepare(`
    INSERT INTO contracts (service_id, client_id, provider_id)
    VALUES (?, ?, ?)
  `).run(service_id, req.user.id, service.user_id);

  res.json({ id: result.lastInsertRowid, message: 'Contrato criado com sucesso' });
});

app.get('/api/my-contracts', authenticateToken, (req, res) => {
  const contracts = db.prepare(`
    SELECT c.*, 
           s.title as service_title, s.price,
           client.name as client_name,
           provider.name as provider_name
    FROM contracts c
    JOIN services s ON c.service_id = s.id
    JOIN users client ON c.client_id = client.id
    JOIN users provider ON c.provider_id = provider.id
    WHERE c.client_id = ? OR c.provider_id = ?
    ORDER BY c.created_at DESC
  `).all(req.user.id, req.user.id);
  
  res.json(contracts);
});

app.put('/api/contracts/:id/status', authenticateToken, [
  body('status').isIn(['completed', 'cancelled'])
], (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  const contract = db.prepare('SELECT * FROM contracts WHERE id = ?').get(id);
  if (!contract) return res.status(404).json({ error: 'Contrato não encontrado' });
  
  // Apenas cliente ou provedor podem atualizar
  if (contract.client_id !== req.user.id && contract.provider_id !== req.user.id) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  db.prepare('UPDATE contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, id);
  
  res.json({ message: 'Status atualizado' });
});

// Rotas Administrativas
app.get('/api/admin/services', authenticateToken, requireAdmin, (req, res) => {
  const { status } = req.query;
  let query = `
    SELECT s.*, u.name as provider_name, u.email as provider_email
    FROM services s
    JOIN users u ON s.user_id = u.id
  `;
  const params = [];

  if (status) {
    query += ' WHERE s.status = ?';
    params.push(status);
  }

  query += ' ORDER BY s.created_at DESC';
  
  const services = db.prepare(query).all(...params);
  res.json(services);
});

app.put('/api/admin/services/:id/status', authenticateToken, requireAdmin, [
  body('status').isIn(['approved', 'rejected', 'removed'])
], (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  db.prepare('UPDATE services SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(status, id);
  
  res.json({ message: 'Status do serviço atualizado' });
});

app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.prepare(`
    SELECT id, name, email, role, status, created_at,
           (SELECT COUNT(*) FROM services WHERE user_id = users.id) as services_count,
           (SELECT COUNT(*) FROM contracts WHERE client_id = users.id OR provider_id = users.id) as contracts_count
    FROM users
    ORDER BY created_at DESC
  `).all();
  res.json(users);
});

app.put('/api/admin/users/:id/status', authenticateToken, requireAdmin, [
  body('status').isIn(['active', 'suspended'])
], (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  
  // Não permitir suspender a si mesmo
  if (parseInt(id) === req.user.id) {
    return res.status(400).json({ error: 'Não pode suspender sua própria conta' });
  }
  
  db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, id);
  res.json({ message: 'Status do usuário atualizado' });
});

app.get('/api/admin/contracts', authenticateToken, requireAdmin, (req, res) => {
  const contracts = db.prepare(`
    SELECT c.*, 
           s.title as service_title,
           client.name as client_name,
           provider.name as provider_name
    FROM contracts c
    JOIN services s ON c.service_id = s.id
    JOIN users client ON c.client_id = client.id
    JOIN users provider ON c.provider_id = provider.id
    ORDER BY c.created_at DESC
  `).all();
  res.json(contracts);
});

// Servir frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
