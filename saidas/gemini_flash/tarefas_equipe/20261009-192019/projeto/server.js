const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(
  session({
    secret: 'chave-secreta-gestao-tarefas-2025',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7 dias de sessão salva
      httpOnly: true
    }
  })
);

// Middleware para verificar se está logado
function checkAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Não autorizado. Faça login.' });
  }
  next();
}

// Middleware para verificar se é gerente
function checkManager(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'gerente') {
    return res.status(403).json({ error: 'Acesso restrito para gerentes.' });
  }
  next();
}

// --- ROTAS DE AUTENTICAÇÃO ---

// Obter usuário logado atual
app.get('/api/me', (req, res) => {
  if (!req.session.user) {
    return res.json({ loggedIn: false });
  }
  res.json({ loggedIn: true, user: req.session.user });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Preencha email e senha.' });
  }

  db.get('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()], (err, user) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor.' });
    if (!user) return res.status(400).json({ error: 'E-mail ou senha incorretos.' });

    const passwordMatch = bcrypt.compareSync(password, user.password);
    if (!passwordMatch) {
      return res.status(400).json({ error: 'E-mail ou senha incorretos.' });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    res.json({ message: 'Login realizado com sucesso!', user: req.session.user });
  });
});

// Cadastro de nova conta
app.post('/api/register', (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Preencha todos os campos obrigatórios.' });
  }

  const userRole = role === 'gerente' ? 'gerente' : 'membro';

  db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email.trim()], (err, row) => {
    if (err) return res.status(500).json({ error: 'Erro no servidor.' });
    if (row) return res.status(400).json({ error: 'Este e-mail já está em uso.' });

    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name.trim(), email.trim().toLowerCase(), hashedPassword, userRole],
      function (insertErr) {
        if (insertErr) return res.status(500).json({ error: 'Erro ao cadastrar usuário.' });

        const newUser = {
          id: this.lastID,
          name: name.trim(),
          email: email.trim().toLowerCase(),
          role: userRole
        };

        req.session.user = newUser;
        res.json({ message: 'Conta criada com sucesso!', user: newUser });
      }
    );
  });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Sessão encerrada com sucesso.' });
  });
});

// Lista de membros (para seleção na criação de tarefas)
app.get('/api/users', checkAuth, (req, res) => {
  db.all('SELECT id, name, email, role FROM users ORDER BY name ASC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao listar usuários.' });
    res.json(rows);
  });
});

// --- ROTAS DE TAREFAS ---

// Listar tarefas
app.get('/api/tasks', checkAuth, (req, res) => {
  const currentUser = req.session.user;

  let query = `
    SELECT 
      t.id, 
      t.title, 
      t.description, 
      t.status, 
      t.priority, 
      t.due_date, 
      t.created_at, 
      t.assigned_to, 
      t.created_by,
      u_assignee.name AS assigned_to_name,
      u_creator.name AS created_by_name
    FROM tasks t
    LEFT JOIN users u_assignee ON t.assigned_to = u_assignee.id
    LEFT JOIN users u_creator ON t.created_by = u_creator.id
  `;

  const params = [];

  // Se for membro, vê apenas as suas tarefas atribuídas
  if (currentUser.role === 'membro') {
    query += ' WHERE t.assigned_to = ?';
    params.push(currentUser.id);
  }

  query += ' ORDER BY CASE t.status WHEN "em_andamento" THEN 1 WHEN "pendente" THEN 2 WHEN "concluida" THEN 3 END, t.due_date ASC, t.id DESC';

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erro ao carregar tarefas.' });
    res.json(rows);
  });
});

// Criar tarefa
app.post('/api/tasks', checkAuth, (req, res) => {
  const currentUser = req.session.user;
  const { title, description, priority, assigned_to, due_date } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'O título da tarefa é obrigatório.' });
  }

  let finalAssignedTo = currentUser.id;

  // Se for gerente, pode atribuir para qualquer membro. Se for membro, a tarefa é sempre para si mesmo.
  if (currentUser.role === 'gerente') {
    finalAssignedTo = assigned_to ? parseInt(assigned_to, 10) : currentUser.id;
  }

  const finalPriority = ['baixa', 'media', 'alta'].includes(priority) ? priority : 'media';

  db.run(
    `INSERT INTO tasks (title, description, priority, assigned_to, created_by, due_date)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title.trim(), description ? description.trim() : '', finalPriority, finalAssignedTo, currentUser.id, due_date || null],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao criar a tarefa.' });
      res.json({ message: 'Tarefa criada com sucesso!', taskId: this.lastID });
    }
  );
});

// Atualizar status da tarefa (Tanto gerente quanto o membro dono podem mudar)
app.patch('/api/tasks/:id/status', checkAuth, (req, res) => {
  const taskId = req.params.id;
  const { status } = req.body;
  const currentUser = req.session.user;

  if (!['pendente', 'em_andamento', 'concluida'].includes(status)) {
    return res.status(400).json({ error: 'Situação inválida.' });
  }

  db.get('SELECT * FROM tasks WHERE id = ?', [taskId], (err, task) => {
    if (err) return res.status(500).json({ error: 'Erro ao buscar tarefa.' });
    if (!task) return res.status(404).json({ error: 'Tarefa não encontrada.' });

    // Permissão: Gerente pode mudar qualquer uma; Membro só pode mudar se a tarefa for dele
    if (currentUser.role !== 'gerente' && task.assigned_to !== currentUser.id) {
      return res.status(403).json({ error: 'Você só pode alterar o status das suas próprias tarefas.' });
    }

    db.run(
      'UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, taskId],
      function (updateErr) {
        if (updateErr) return res.status(500).json({ error: 'Erro ao atualizar situação da tarefa.' });
        res.json({ message: 'Situação atualizada com sucesso!' });
      }
    );
  });
});

// Editar dados da tarefa (Apenas Gerente)
app.put('/api/tasks/:id', checkManager, (req, res) => {
  const taskId = req.params.id;
  const { title, description, status, priority, assigned_to, due_date } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'O título da tarefa é obrigatório.' });
  }

  db.run(
    `UPDATE tasks 
     SET title = ?, description = ?, status = ?, priority = ?, assigned_to = ?, due_date = ?, updated_at = CURRENT_TIMESTAMP
     WHERE id = ?`,
    [title.trim(), description || '', status, priority, assigned_to, due_date || null, taskId],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erro ao atualizar tarefa.' });
      if (this.changes === 0) return res.status(404).json({ error: 'Tarefa não encontrada.' });
      res.json({ message: 'Tarefa alterada com sucesso!' });
    }
  );
});

// Excluir tarefa (Apenas Gerente)
app.delete('/api/tasks/:id', checkManager, (req, res) => {
  const taskId = req.params.id;

  db.run('DELETE FROM tasks WHERE id = ?', [taskId], function (err) {
    if (err) return res.status(500).json({ error: 'Erro ao excluir tarefa.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Tarefa não encontrada.' });
    res.json({ message: 'Tarefa excluída com sucesso!' });
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(` Sistema de Gestão de Tarefas Rodando!`);
  console.log(` Acesso local: http://localhost:${PORT}`);
  console.log(`===============================================`);
});
