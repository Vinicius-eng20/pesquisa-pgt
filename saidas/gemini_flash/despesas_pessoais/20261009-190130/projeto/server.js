const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'chave-secreta-despesas-2025-segura';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware de Autenticação
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acesso não autorizado. Faça login novamente.' });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }

    // Verificar se o usuário ainda está ativo no banco
    db.get('SELECT id, name, email, role, status FROM users WHERE id = ?', [decoded.id], (dbErr, user) => {
      if (dbErr || !user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
      }
      if (user.status !== 'active') {
        return res.status(403).json({ error: 'Sua conta foi desativada pelo administrador.' });
      }
      req.user = user;
      next();
    });
  });
}

// Middleware para verificar se é Administrador
function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito para administradores.' });
  }
  next();
}

// --- ROTAS DE AUTENTICAÇÃO ---

// Cadastro de novos usuários
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const hashedPassword = bcrypt.hashSync(password, 10);

  db.run(
    'INSERT INTO users (name, email, password, role, status) VALUES (?, ?, ?, ?, ?)',
    [name.trim(), normalizedEmail, hashedPassword, 'user', 'active'],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Este e-mail já está cadastrado.' });
        }
        return res.status(500).json({ error: 'Erro ao cadastrar usuário.' });
      }

      const token = jwt.sign({ id: this.lastID, role: 'user' }, JWT_SECRET, { expiresIn: '30d' });
      res.status(201).json({
        message: 'Conta criada com sucesso!',
        token,
        user: { id: this.lastID, name: name.trim(), email: normalizedEmail, role: 'user', status: 'active' }
      });
    }
  );
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  db.get('SELECT * FROM users WHERE email = ?', [normalizedEmail], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erro no servidor.' });
    }
    if (!user) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Esta conta foi desativada pelo administrador do sistema.' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
    res.json({
      message: 'Login realizado com sucesso!',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status
      }
    });
  });
});

// Obter dados do usuário logado
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// --- ROTAS DE CATEGORIAS ---

// Listar categorias disponíveis para todos os usuários logados
app.get('/api/categories', authenticateToken, (req, res) => {
  db.all('SELECT * FROM categories ORDER BY name ASC', [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao buscar categorias.' });
    }
    res.json(rows);
  });
});

// Criar nova categoria (Apenas Administrador)
app.post('/api/categories', authenticateToken, requireAdmin, (req, res) => {
  const { name, color } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'O nome da categoria é obrigatório.' });
  }

  const categoryColor = color || '#3B82F6';

  db.run(
    'INSERT INTO categories (name, color) VALUES (?, ?)',
    [name.trim(), categoryColor],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Já existe uma categoria com este nome.' });
        }
        return res.status(500).json({ error: 'Erro ao cadastrar categoria.' });
      }
      res.status(201).json({ id: this.lastID, name: name.trim(), color: categoryColor });
    }
  );
});

// Deletar categoria (Apenas Administrador)
app.delete('/api/categories/:id', authenticateToken, requireAdmin, (req, res) => {
  const categoryId = req.params.id;

  // Verificar se existem despesas usando esta categoria
  db.get('SELECT COUNT(*) as count FROM expenses WHERE category_id = ?', [categoryId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao verificar vínculos da categoria.' });
    }
    if (row && row.count > 0) {
      return res.status(400).json({
        error: `Não é possível excluir esta categoria porque existem ${row.count} despesa(s) vinculada(s) a ela.`
      });
    }

    db.run('DELETE FROM categories WHERE id = ?', [categoryId], function (delErr) {
      if (delErr) {
        return res.status(500).json({ error: 'Erro ao excluir categoria.' });
      }
      res.json({ message: 'Categoria excluída com sucesso.' });
    });
  });
});

// --- ROTAS DE GASTOS / DESPESAS (USUÁRIO) ---

// Listar gastos do próprio usuário com filtros de mês e categoria
app.get('/api/expenses', authenticateToken, (req, res) => {
  const { month, categoryId } = req.query;
  const userId = req.user.id;

  let query = `
    SELECT e.id, e.description, e.amount, e.date, e.created_at,
           c.id as category_id, c.name as category_name, c.color as category_color
    FROM expenses e
    JOIN categories c ON e.category_id = c.id
    WHERE e.user_id = ?
  `;
  const params = [userId];

  if (month) {
    // month no formato YYYY-MM
    query += ` AND strftime('%Y-%m', e.date) = ?`;
    params.push(month);
  }

  if (categoryId) {
    query += ` AND e.category_id = ?`;
    params.push(categoryId);
  }

  query += ` ORDER BY e.date DESC, e.id DESC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao carregar despesas.' });
    }
    res.json(rows);
  });
});

// Resumo do mês para o usuário logado (Total e Divisão por Categoria)
app.get('/api/expenses/summary', authenticateToken, (req, res) => {
  const { month } = req.query;
  const userId = req.user.id;

  const currentMonth = month || new Date().toISOString().slice(0, 7);

  // Total do mês
  const totalQuery = `
    SELECT COALESCE(SUM(amount), 0) as total
    FROM expenses
    WHERE user_id = ? AND strftime('%Y-%m', date) = ?
  `;

  // Total por categoria no mês
  const byCategoryQuery = `
    SELECT c.id, c.name, c.color, COALESCE(SUM(e.amount), 0) as total, COUNT(e.id) as count
    FROM categories c
    JOIN expenses e ON e.category_id = c.id
    WHERE e.user_id = ? AND strftime('%Y-%m', e.date) = ?
    GROUP BY c.id
    ORDER BY total DESC
  `;

  db.get(totalQuery, [userId, currentMonth], (err, totalRow) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao calcular total.' });
    }

    db.all(byCategoryQuery, [userId, currentMonth], (catErr, categoryRows) => {
      if (catErr) {
        return res.status(500).json({ error: 'Erro ao calcular categorias.' });
      }

      res.json({
        month: currentMonth,
        totalMonthly: totalRow.total,
        byCategory: categoryRows
      });
    });
  });
});

// Cadastrar novo gasto
app.post('/api/expenses', authenticateToken, (req, res) => {
  const { description, amount, category_id, date } = req.body;

  if (!description || !amount || !category_id || !date) {
    return res.status(400).json({ error: 'Preencha todos os campos do gasto.' });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'O valor deve ser um número maior que zero.' });
  }

  db.run(
    'INSERT INTO expenses (user_id, category_id, description, amount, date) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, category_id, description.trim(), parsedAmount, date],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao cadastrar gasto.' });
      }
      res.status(201).json({
        message: 'Gasto registrado com sucesso!',
        id: this.lastID
      });
    }
  );
});

// Excluir um gasto
app.delete('/api/expenses/:id', authenticateToken, (req, res) => {
  const expenseId = req.params.id;

  db.run(
    'DELETE FROM expenses WHERE id = ? AND user_id = ?',
    [expenseId, req.user.id],
    function (err) {
      if (err) {
        return res.status(500).json({ error: 'Erro ao excluir gasto.' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Gasto não encontrado ou permissão negada.' });
      }
      res.json({ message: 'Gasto excluído com sucesso.' });
    }
  );
});

// --- ROTAS DO ADMINISTRADOR ---

// Estatísticas globais do sistema
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  const totalExpensesQuery = `SELECT COALESCE(SUM(amount), 0) as totalGlobal, COUNT(id) as totalTransactions FROM expenses`;
  const totalUsersQuery = `SELECT COUNT(id) as totalUsers, SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as activeUsers FROM users WHERE role != 'admin'`;
  const topCategoriesQuery = `
    SELECT c.name, c.color, COALESCE(SUM(e.amount), 0) as total
    FROM categories c
    LEFT JOIN expenses e ON e.category_id = c.id
    GROUP BY c.id
    HAVING total > 0
    ORDER BY total DESC
  `;

  db.get(totalExpensesQuery, [], (err, expRow) => {
    if (err) return res.status(500).json({ error: 'Erro nas estatísticas globais.' });

    db.get(totalUsersQuery, [], (userErr, uRow) => {
      if (userErr) return res.status(500).json({ error: 'Erro nas estatísticas de usuários.' });

      db.all(topCategoriesQuery, [], (catErr, catRows) => {
        if (catErr) return res.status(500).json({ error: 'Erro nas estatísticas de categoria.' });

        res.json({
          totalGlobal: expRow.totalGlobal,
          totalTransactions: expRow.totalTransactions,
          totalUsers: uRow.totalUsers || 0,
          activeUsers: uRow.activeUsers || 0,
          categories: catRows
        });
      });
    });
  });
});

// Listar todos os usuários com o total de gastos de cada um
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  const query = `
    SELECT u.id, u.name, u.email, u.role, u.status, u.created_at,
           COALESCE(SUM(e.amount), 0) as total_spent,
           COUNT(e.id) as expense_count
    FROM users u
    LEFT JOIN expenses e ON e.user_id = u.id
    WHERE u.role != 'admin'
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Erro ao carregar usuários.' });
    }
    res.json(rows);
  });
});

// Ativar ou desativar conta de usuário
app.patch('/api/admin/users/:id/status', authenticateToken, requireAdmin, (req, res) => {
  const userId = req.params.id;
  const { status } = req.body;

  if (!['active', 'disabled'].includes(status)) {
    return res.status(400).json({ error: 'Status inválido. Escolha "active" ou "disabled".' });
  }

  // Não permitir desativar a si próprio se for admin
  if (parseInt(userId, 10) === req.user.id) {
    return res.status(400).json({ error: 'Você não pode desativar seu próprio acesso de administrador.' });
  }

  db.run('UPDATE users SET status = ? WHERE id = ?', [status, userId], function (err) {
    if (err) {
      return res.status(500).json({ error: 'Erro ao atualizar status do usuário.' });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }
    res.json({ message: `Conta ${status === 'active' ? 'ativada' : 'desativada'} com sucesso.` });
  });
});

// Redireciona qualquer outra rota para o index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia o Servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  SISTEMA DE CONTROLE DE DESPESAS FUNCIONANDO!`);
  console.log(`  Acesse localmente em: http://localhost:${PORT}`);
  console.log(`  Conta Admin: admin@admin.com / admin123`);
  console.log(`====================================================`);
});
