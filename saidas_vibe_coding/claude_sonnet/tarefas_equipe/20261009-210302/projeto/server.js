const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'sistema-tarefas-secreto-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// Inicializar banco de dados
function initDatabase() {
  if (!fs.existsSync(DB_FILE)) {
    const initialData = {
      users: [
        { id: 1, username: 'gerente', password: 'gerente123', name: 'Gerente', role: 'manager' },
        { id: 2, username: 'joao', password: 'joao123', name: 'João Silva', role: 'member' },
        { id: 3, username: 'maria', password: 'maria123', name: 'Maria Santos', role: 'member' },
        { id: 4, username: 'pedro', password: 'pedro123', name: 'Pedro Costa', role: 'member' }
      ],
      tasks: [
        { id: 1, title: 'Revisar relatório mensal', description: 'Revisar e aprovar o relatório de vendas', assignedTo: 2, status: 'pending', createdBy: 1, createdAt: new Date().toISOString() },
        { id: 2, title: 'Atualizar planilha', description: 'Atualizar planilha de controle de estoque', assignedTo: 3, status: 'in-progress', createdBy: 1, createdAt: new Date().toISOString() },
        { id: 3, title: 'Preparar apresentação', description: 'Criar slides para reunião com cliente', assignedTo: 4, status: 'pending', createdBy: 1, createdAt: new Date().toISOString() }
      ],
      nextUserId: 5,
      nextTaskId: 4
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
  }
}

// Funções de leitura e escrita do banco de dados
function readDatabase() {
  const data = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(data);
}

function writeDatabase(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// Middleware de autenticação
function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Não autorizado' });
  }
  next();
}

function requireManager(req, res, next) {
  const db = readDatabase();
  const user = db.users.find(u => u.id === req.session.userId);
  if (!user || user.role !== 'manager') {
    return res.status(403).json({ error: 'Acesso negado. Apenas gerentes podem realizar esta ação.' });
  }
  next();
}

// Rotas de autenticação
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const db = readDatabase();
  
  const user = db.users.find(u => u.username === username && u.password === password);
  
  if (user) {
    req.session.userId = user.id;
    res.json({ 
      success: true, 
      user: { 
        id: user.id, 
        name: user.name, 
        username: user.username, 
        role: user.role 
      } 
    });
  } else {
    res.status(401).json({ error: 'Usuário ou senha incorretos' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

app.get('/api/me', requireAuth, (req, res) => {
  const db = readDatabase();
  const user = db.users.find(u => u.id === req.session.userId);
  
  if (user) {
    res.json({ 
      id: user.id, 
      name: user.name, 
      username: user.username, 
      role: user.role 
    });
  } else {
    res.status(404).json({ error: 'Usuário não encontrado' });
  }
});

// Rotas de usuários
app.get('/api/users', requireAuth, (req, res) => {
  const db = readDatabase();
  const users = db.users.map(u => ({ 
    id: u.id, 
    name: u.name, 
    username: u.username, 
    role: u.role 
  }));
  res.json(users);
});

app.post('/api/users', requireAuth, requireManager, (req, res) => {
  const { username, password, name } = req.body;
  
  if (!username || !password || !name) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios' });
  }
  
  const db = readDatabase();
  
  if (db.users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'Nome de usuário já existe' });
  }
  
  const newUser = {
    id: db.nextUserId,
    username,
    password,
    name,
    role: 'member'
  };
  
  db.users.push(newUser);
  db.nextUserId++;
  writeDatabase(db);
  
  res.json({ 
    id: newUser.id, 
    name: newUser.name, 
    username: newUser.username, 
    role: newUser.role 
  });
});

// Rotas de tarefas
app.get('/api/tasks', requireAuth, (req, res) => {
  const db = readDatabase();
  const currentUser = db.users.find(u => u.id === req.session.userId);
  
  let tasks = db.tasks;
  
  // Membros só veem suas próprias tarefas
  if (currentUser.role === 'member') {
    tasks = tasks.filter(t => t.assignedTo === currentUser.id);
  }
  
  // Adicionar informações do usuário atribuído
  tasks = tasks.map(task => {
    const assignedUser = db.users.find(u => u.id === task.assignedTo);
    return {
      ...task,
      assignedToName: assignedUser ? assignedUser.name : 'Não atribuído'
    };
  });
  
  res.json(tasks);
});

app.post('/api/tasks', requireAuth, (req, res) => {
  const { title, description, assignedTo } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: 'Título é obrigatório' });
  }
  
  const db = readDatabase();
  const currentUser = db.users.find(u => u.id === req.session.userId);
  
  // Membros só podem criar tarefas para si mesmos
  let finalAssignedTo = assignedTo;
  if (currentUser.role === 'member') {
    finalAssignedTo = currentUser.id;
  }
  
  const newTask = {
    id: db.nextTaskId,
    title,
    description: description || '',
    assignedTo: finalAssignedTo || currentUser.id,
    status: 'pending',
    createdBy: currentUser.id,
    createdAt: new Date().toISOString()
  };
  
  db.tasks.push(newTask);
  db.nextTaskId++;
  writeDatabase(db);
  
  const assignedUser = db.users.find(u => u.id === newTask.assignedTo);
  res.json({
    ...newTask,
    assignedToName: assignedUser ? assignedUser.name : 'Não atribuído'
  });
});

app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const taskId = parseInt(req.params.id);
  const { title, description, assignedTo, status } = req.body;
  
  const db = readDatabase();
  const currentUser = db.users.find(u => u.id === req.session.userId);
  const taskIndex = db.tasks.findIndex(t => t.id === taskId);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Tarefa não encontrada' });
  }
  
  const task = db.tasks[taskIndex];
  
  // Membros só podem editar suas próprias tarefas e apenas o status
  if (currentUser.role === 'member') {
    if (task.assignedTo !== currentUser.id) {
      return res.status(403).json({ error: 'Você só pode editar suas próprias tarefas' });
    }
    // Membros só podem alterar o status
    if (status) {
      task.status = status;
    }
  } else {
    // Gerentes podem editar tudo
    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (assignedTo) task.assignedTo = assignedTo;
    if (status) task.status = status;
  }
  
  db.tasks[taskIndex] = task;
  writeDatabase(db);
  
  const assignedUser = db.users.find(u => u.id === task.assignedTo);
  res.json({
    ...task,
    assignedToName: assignedUser ? assignedUser.name : 'Não atribuído'
  });
});

app.delete('/api/tasks/:id', requireAuth, requireManager, (req, res) => {
  const taskId = parseInt(req.params.id);
  
  const db = readDatabase();
  const taskIndex = db.tasks.findIndex(t => t.id === taskId);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Tarefa não encontrada' });
  }
  
  db.tasks.splice(taskIndex, 1);
  writeDatabase(db);
  
  res.json({ success: true });
});

// Inicializar e iniciar servidor
initDatabase();

app.listen(PORT, () => {
  console.log(`\n🚀 Servidor rodando em http://localhost:${PORT}`);
  console.log(`\n📋 Sistema de Gestão de Tarefas de Equipe`);
  console.log(`\n✅ Acesse o navegador e faça login com:`);
  console.log(`   Gerente: gerente / gerente123`);
  console.log(`   Membro: joao / joao123\n`);
});
