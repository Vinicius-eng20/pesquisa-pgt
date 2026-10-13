const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'sua_chave_secreta_super_segura_2024';

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Middleware de autenticação
function autenticar(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ erro: 'Token não fornecido' });
    }

    try {
        const decoded = jwt.verify(token, SECRET_KEY);
        req.usuarioId = decoded.id;
        req.isAdmin = decoded.isAdmin;
        next();
    } catch (erro) {
        return res.status(401).json({ erro: 'Token inválido' });
    }
}

// Middleware de administrador
function autenticarAdmin(req, res, next) {
    if (!req.isAdmin) {
        return res.status(403).json({ erro: 'Acesso negado' });
    }
    next();
}

// ===== ROTAS DE AUTENTICAÇÃO =====

// Registrar usuário
app.post('/api/registrar', async (req, res) => {
    const { nome, email, senha, isAdmin } = req.body;

    if (!nome || !email || !senha) {
        return res.status(400).json({ erro: 'Preencha todos os campos' });
    }

    try {
        const senhaHash = await bcrypt.hash(senha, 10);
        
        db.run(
            'INSERT INTO usuarios (nome, email, senha, isAdmin, ativo) VALUES (?, ?, ?, ?, 1)',
            [nome, email, senhaHash, isAdmin ? 1 : 0],
            function(erro) {
                if (erro) {
                    return res.status(400).json({ erro: 'Email já cadastrado' });
                }
                res.json({ mensagem: 'Usuário registrado com sucesso', id: this.lastID });
            }
        );
    } catch (erro) {
        res.status(500).json({ erro: 'Erro ao registrar usuário' });
    }
});

// Login
app.post('/api/login', (req, res) => {
    const { email, senha } = req.body;

    db.get('SELECT * FROM usuarios WHERE email = ?', [email], async (erro, usuario) => {
        if (erro || !usuario) {
            return res.status(401).json({ erro: 'Email ou senha incorretos' });
        }

        if (!usuario.ativo) {
            return res.status(403).json({ erro: 'Conta desativada' });
        }

        const senhaValida = await bcrypt.compare(senha, usuario.senha);
        if (!senhaValida) {
            return res.status(401).json({ erro: 'Email ou senha incorretos' });
        }

        const token = jwt.sign(
            { id: usuario.id, isAdmin: usuario.isAdmin },
            SECRET_KEY,
            { expiresIn: '30d' }
        );

        res.json({
            token,
            usuario: {
                id: usuario.id,
                nome: usuario.nome,
                email: usuario.email,
                isAdmin: usuario.isAdmin
            }
        });
    });
});

// ===== ROTAS DE DESPESAS =====

// Listar despesas do usuário
app.get('/api/despesas', autenticar, (req, res) => {
    const { mes, ano } = req.query;
    
    let sql = `
        SELECT d.*, c.nome as categoria_nome, c.cor as categoria_cor
        FROM despesas d
        JOIN categorias c ON d.categoria_id = c.id
        WHERE d.usuario_id = ?
    `;
    const params = [req.usuarioId];

    if (mes && ano) {
        sql += ` AND strftime('%m', d.data) = ? AND strftime('%Y', d.data) = ?`;
        params.push(mes.padStart(2, '0'), ano);
    }

    sql += ' ORDER BY d.data DESC';

    db.all(sql, params, (erro, despesas) => {
        if (erro) {
            return res.status(500).json({ erro: 'Erro ao buscar despesas' });
        }
        res.json(despesas);
    });
});

// Criar despesa
app.post('/api/despesas', autenticar, (req, res) => {
    const { descricao, valor, categoria_id, data } = req.body;

    if (!descricao || !valor || !categoria_id || !data) {
        return res.status(400).json({ erro: 'Preencha todos os campos' });
    }

    db.run(
        'INSERT INTO despesas (usuario_id, categoria_id, descricao, valor, data) VALUES (?, ?, ?, ?, ?)',
        [req.usuarioId, categoria_id, descricao, valor, data],
        function(erro) {
            if (erro) {
                return res.status(500).json({ erro: 'Erro ao criar despesa' });
            }
            res.json({ id: this.lastID, mensagem: 'Despesa registrada com sucesso' });
        }
    );
});

// Atualizar despesa
app.put('/api/despesas/:id', autenticar, (req, res) => {
    const { descricao, valor, categoria_id, data } = req.body;
    const { id } = req.params;

    db.run(
        'UPDATE despesas SET descricao = ?, valor = ?, categoria_id = ?, data = ? WHERE id = ? AND usuario_id = ?',
        [descricao, valor, categoria_id, data, id, req.usuarioId],
        function(erro) {
            if (erro || this.changes === 0) {
                return res.status(500).json({ erro: 'Erro ao atualizar despesa' });
            }
            res.json({ mensagem: 'Despesa atualizada com sucesso' });
        }
    );
});

// Deletar despesa
app.delete('/api/despesas/:id', autenticar, (req, res) => {
    db.run(
        'DELETE FROM despesas WHERE id = ? AND usuario_id = ?',
        [req.params.id, req.usuarioId],
        function(erro) {
            if (erro || this.changes === 0) {
                return res.status(500).json({ erro: 'Erro ao deletar despesa' });
            }
            res.json({ mensagem: 'Despesa deletada com sucesso' });
        }
    );
});

// ===== ROTAS DE CATEGORIAS =====

// Listar categorias
app.get('/api/categorias', autenticar, (req, res) => {
    db.all('SELECT * FROM categorias ORDER BY nome', (erro, categorias) => {
        if (erro) {
            return res.status(500).json({ erro: 'Erro ao buscar categorias' });
        }
        res.json(categorias);
    });
});

// Criar categoria (apenas admin)
app.post('/api/categorias', autenticar, autenticarAdmin, (req, res) => {
    const { nome, cor } = req.body;

    if (!nome) {
        return res.status(400).json({ erro: 'Nome é obrigatório' });
    }

    db.run(
        'INSERT INTO categorias (nome, cor) VALUES (?, ?)',
        [nome, cor || '#007bff'],
        function(erro) {
            if (erro) {
                return res.status(400).json({ erro: 'Categoria já existe' });
            }
            res.json({ id: this.lastID, mensagem: 'Categoria criada com sucesso' });
        }
    );
});

// ===== ROTAS ADMINISTRATIVAS =====

// Listar usuários (apenas admin)
app.get('/api/admin/usuarios', autenticar, autenticarAdmin, (req, res) => {
    db.all(
        'SELECT id, nome, email, isAdmin, ativo, created_at FROM usuarios ORDER BY nome',
        (erro, usuarios) => {
            if (erro) {
                return res.status(500).json({ erro: 'Erro ao buscar usuários' });
            }
            res.json(usuarios);
        }
    );
});

// Ativar/desativar usuário (apenas admin)
app.put('/api/admin/usuarios/:id/toggle', autenticar, autenticarAdmin, (req, res) => {
    db.run(
        'UPDATE usuarios SET ativo = NOT ativo WHERE id = ?',
        [req.params.id],
        function(erro) {
            if (erro || this.changes === 0) {
                return res.status(500).json({ erro: 'Erro ao atualizar usuário' });
            }
            res.json({ mensagem: 'Status do usuário atualizado' });
        }
    );
});

// Total de gastos de todos os usuários (apenas admin)
app.get('/api/admin/estatisticas', autenticar, autenticarAdmin, (req, res) => {
    const { mes, ano } = req.query;
    
    let sql = `
        SELECT 
            u.id,
            u.nome,
            u.email,
            COUNT(d.id) as total_despesas,
            COALESCE(SUM(d.valor), 0) as total_gasto
        FROM usuarios u
        LEFT JOIN despesas d ON u.id = d.usuario_id
    `;
    
    const params = [];
    if (mes && ano) {
        sql += ` AND strftime('%m', d.data) = ? AND strftime('%Y', d.data) = ?`;
        params.push(mes.padStart(2, '0'), ano);
    }
    
    sql += ' WHERE u.isAdmin = 0 GROUP BY u.id ORDER BY total_gasto DESC';

    db.all(sql, params, (erro, estatisticas) => {
        if (erro) {
            return res.status(500).json({ erro: 'Erro ao buscar estatísticas' });
        }
        res.json(estatisticas);
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
```

```javascript
