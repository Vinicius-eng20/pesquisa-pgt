const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Banco de Dados (SQLite)
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Erro ao conectar no banco de dados:', err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
        inicializarBanco();
    }
});

// Criação das tabelas e usuário admin padrão
function inicializarBanco() {
    db.serialize(() => {
        // Tabela de Usuários
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            senha TEXT,
            tipo TEXT -- 'admin' ou 'aluno'
        )`);

        // Tabela de Cursos
        db.run(`CREATE TABLE IF NOT EXISTS cursos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT,
            descricao TEXT,
            instrutor TEXT
        )`);

        // Tabela de Matrículas
        db.run(`CREATE TABLE IF NOT EXISTS matriculas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aluno_id INTEGER,
            curso_id INTEGER,
            data_matricula DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(aluno_id) REFERENCES usuarios(id),
            FOREIGN KEY(curso_id) REFERENCES cursos(id)
        )`);

        // Cria o usuário admin padrão se não existir
        db.get(`SELECT * FROM usuarios WHERE username = 'admin'`, (err, row) => {
            if (!row) {
                const senhaHash = bcrypt.hashSync('admin123', 10);
                db.run(`INSERT INTO usuarios (username, senha, tipo) VALUES (?, ?, ?)`, 
                    ['admin', senhaHash, 'admin']);
                console.log('Usuário admin criado com sucesso. Usuário: admin | Senha: admin123');
            }
        });
    });
}

// Middlewares
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
    secret: 'segredo-super-secreto-plataforma-cursos',
    resave: false,
    saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de Autenticação
function autenticar(req, res, next) {
    if (req.session.usuarioId) {
        next();
    } else {
        res.status(401).json({ erro: 'Não autorizado' });
    }
}

function apenasAdmin(req, res, next) {
    if (req.session.usuarioTipo === 'admin') {
        next();
    } else {
        res.status(403).json({ erro: 'Acesso negado' });
    }
}

// --- ROTAS DE AUTENTICAÇÃO ---

// Registrar novo usuário (sempre será aluno)
app.post('/api/registrar', (req, res) => {
    const { username, senha } = req.body;
    if (!username || !senha) return res.status(400).json({ erro: 'Usuário e senha são obrigatórios.' });

    const senhaHash = bcrypt.hashSync(senha, 10);
    db.run(`INSERT INTO usuarios (username, senha, tipo) VALUES (?, ?, 'aluno')`, 
        [username, senhaHash], 
        function(err) {
            if (err) {
                return res.status(400).json({ erro: 'Usuário já existe.' });
            }
            res.json({ sucesso: true, mensagem: 'Cadastro realizado com sucesso!' });
        }
    );
});

// Login
app.post('/api/login', (req, res) => {
    const { username, senha } = req.body;
    db.get(`SELECT * FROM usuarios WHERE username = ?`, [username], (err, user) => {
        if (err || !user) {
            return res.status(400).json({ erro: 'Usuário não encontrado.' });
        }
        if (!bcrypt.compareSync(senha, user.senha)) {
            return res.status(400).json({ erro: 'Senha incorreta.' });
        }

        req.session.usuarioId = user.id;
        req.session.usuarioTipo = user.tipo;
        req.session.username = user.username;

        res.json({ sucesso: true, tipo: user.tipo, username: user.username });
    });
});

// Logout
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ sucesso: true });
});

// Verificar usuário logado (para o frontend saber quem está logado)
app.get('/api/perfil', autenticar, (req, res) => {
    res.json({ 
        id: req.session.usuarioId, 
        username: req.session.username, 
        tipo: req.session.usuarioTipo 
    });
});

// --- ROTAS DE CURSOS (PÚBLICAS E ADMIN) ---

// Listar todos os cursos (tanto para aluno quanto admin)
app.get('/api/cursos', autenticar, (req, res) => {
    db.all(`SELECT * FROM cursos`, [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
    });
});

// Cadastrar curso (Admin)
app.post('/api/admin/cursos', autenticar, apenasAdmin, (req, res) => {
    const { titulo, descricao, instrutor } = req.body;
    db.run(`INSERT INTO cursos (titulo, descricao, instrutor) VALUES (?, ?, ?)`,
        [titulo, descricao, instrutor],
        function(err) {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ sucesso: true, id: this.lastID });
        }
    );
});

// Editar curso (Admin)
app.put('/api/admin/cursos/:id', autenticar, apenasAdmin, (req, res) => {
    const { titulo, descricao, instrutor } = req.body;
    db.run(`UPDATE cursos SET titulo = ?, descricao = ?, instrutor = ? WHERE id = ?`,
        [titulo, descricao, instrutor, req.params.id],
        function(err) {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ sucesso: true });
        }
    );
});

// Remover curso (Admin) - também remove matrículas atreladas a ele
app.delete('/api/admin/cursos/:id', autenticar, apenasAdmin, (req, res) => {
    const cursoId = req.params.id;
    db.serialize(() => {
        db.run(`DELETE FROM matriculas WHERE curso_id = ?`, [cursoId]);
        db.run(`DELETE FROM cursos WHERE id = ?`, [cursoId], function(err) {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ sucesso: true });
        });
    });
});

// --- ROTAS DE MATRÍCULAS ---

// Aluno se matricular
app.post('/api/matriculas', autenticar, (req, res) => {
    const { curso_id } = req.body;
    const aluno_id = req.session.usuarioId;

    // Verificar se já está matriculado
    db.get(`SELECT * FROM matriculas WHERE aluno_id = ? AND curso_id = ?`, [aluno_id, curso_id], (err, row) => {
        if (row) return res.status(400).json({ erro: 'Você já está matriculado neste curso.' });

        db.run(`INSERT INTO matriculas (aluno_id, curso_id) VALUES (?, ?)`, [aluno_id, curso_id], function(err) {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ sucesso: true });
        });
    });
});

// Aluno cancelar sua própria matrícula
app.delete('/api/matriculas/:curso_id', autenticar, (req, res) => {
    db.run(`DELETE FROM matriculas WHERE aluno_id = ? AND curso_id = ?`, 
        [req.session.usuarioId, req.params.curso_id], function(err) {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ sucesso: true });
        }
    );
});

// Aluno vê seus próprios cursos
app.get('/api/meus-cursos', autenticar, (req, res) => {
    db.all(`
        SELECT c.id, c.titulo, c.descricao, c.instrutor, m.data_matricula 
        FROM matriculas m
        JOIN cursos c ON m.curso_id = c.id
        WHERE m.aluno_id = ?
    `, [req.session.usuarioId], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
    });
});

// Admin vê todas as matrículas de todos os alunos
app.get('/api/admin/matriculas', autenticar, apenasAdmin, (req, res) => {
    db.all(`
        SELECT m.id as matricula_id, u.username as aluno, c.titulo as curso, m.data_matricula
        FROM matriculas m
        JOIN usuarios u ON m.aluno_id = u.id
        JOIN cursos c ON m.curso_id = c.id
        ORDER BY m.data_matricula DESC
    `, [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows);
    });
});

// Admin cancela qualquer matrícula
app.delete('/api/admin/matriculas/:id', autenticar, apenasAdmin, (req, res) => {
    db.run(`DELETE FROM matriculas WHERE id = ?`, [req.params.id], function(err) {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ sucesso: true });
    });
});

// Iniciar Servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
