const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'chave_super_secreta_da_loja';

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Configuração do Banco de Dados
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error(err.message);
    else console.log('Banco de dados conectado.');
});

// Criação das Tabelas e Dados Iniciais
db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'client'
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        price REAL NOT NULL,
        department TEXT NOT NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        items TEXT NOT NULL,
        total REAL NOT NULL,
        status TEXT DEFAULT 'Pendente',
        date TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    // Cria o usuário Administrador padrão, se não existir
    const adminEmail = 'admin@loja.com';
    db.get(`SELECT * FROM users WHERE email = ?`, [adminEmail], (err, row) => {
        if (!row) {
            const hash = bcrypt.hashSync('admin123', 8);
            db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`, 
                ['Dono da Loja', adminEmail, hash, 'admin']);
            console.log('Conta do dono da loja criada.');
        }
    });
});

// Middleware de Autenticação
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

// Middleware para Admin
function isAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({error: 'Acesso negado'});
    next();
}

// Rotas de Autenticação
app.post('/api/register', (req, res) => {
    const { name, email, password } = req.body;
    const hash = bcrypt.hashSync(password, 8);
    db.run(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, 'client')`,
        [name, email, hash], function(err) {
            if (err) return res.status(400).json({error: 'E-mail já cadastrado.'});
            res.json({message: 'Cadastro realizado com sucesso!'});
        });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, user) => {
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({error: 'E-mail ou senha incorretos.'});
        }
        const token = jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
    });
});

// Rotas de Produtos
app.get('/api/products', (req, res) => {
    db.all(`SELECT * FROM products`, [], (err, rows) => {
        if (err) return res.status(500).json({error: err.message});
        res.json(rows);
    });
});

app.post('/api/products', authenticateToken, isAdmin, (req, res) => {
    const { name, description, price, department } = req.body;
    db.run(`INSERT INTO products (name, description, price, department) VALUES (?, ?, ?, ?)`,
        [name, description, price, department], function(err) {
            if (err) return res.status(500).json({error: err.message});
            res.json({ id: this.lastID, message: 'Produto adicionado!' });
        });
});

app.put('/api/products/:id', authenticateToken, isAdmin, (req, res) => {
    const { name, description, price, department } = req.body;
    db.run(`UPDATE products SET name = ?, description = ?, price = ?, department = ? WHERE id = ?`,
        [name, description, price, department, req.params.id], function(err) {
            if (err) return res.status(500).json({error: err.message});
            res.json({ message: 'Produto atualizado!' });
        });
});

app.delete('/api/products/:id', authenticateToken, isAdmin, (req, res) => {
    db.run(`DELETE FROM products WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(500).json({error: err.message});
        res.json({ message: 'Produto removido!' });
    });
});

// Rotas de Pedidos
app.post('/api/orders', authenticateToken, (req, res) => {
    const { items, total } = req.body;
    const itemsStr = JSON.stringify(items);
    db.run(`INSERT INTO orders (user_id, items, total) VALUES (?, ?, ?)`,
        [req.user.id, itemsStr, total], function(err) {
            if (err) return res.status(500).json({error: err.message});
            res.json({ id: this.lastID, message: 'Pedido realizado com sucesso!' });
        });
});

app.get('/api/orders', authenticateToken, (req, res) => {
    let query = `SELECT orders.*, users.name as client_name FROM orders JOIN users ON orders.user_id = users.id`;
    let params = [];
    
    if (req.user.role !== 'admin') {
        query += ` WHERE user_id = ?`;
        params.push(req.user.id);
    }
    query += ` ORDER BY date DESC`;

    db.all(query, params, (err, rows) => {
        if (err) return res.status(500).json({error: err.message});
        // Converter string de volta para JSON
        const formattedRows = rows.map(r => ({...r, items: JSON.parse(r.items)}));
        res.json(formattedRows);
    });
});

app.put('/api/orders/:id/status', authenticateToken, isAdmin, (req, res) => {
    const { status } = req.body;
    db.run(`UPDATE orders SET status = ? WHERE id = ?`, [status, req.params.id], function(err) {
        if (err) return res.status(500).json({error: err.message});
        res.json({ message: 'Status atualizado!' });
    });
});

// Rota principal (envia o site)
app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
