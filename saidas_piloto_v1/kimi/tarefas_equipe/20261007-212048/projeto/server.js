const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'banco-de-dados.json');

// Configuração do servidor
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Configuração da sessão (mantém o usuário logado)
app.use(session({
  secret: 'chave-secreta-muito-segura-mude-isso-em-producao',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 24 * 60 * 60 * 1000 } // 24 horas
}));

// --- FUNÇÕES DO BANCO DE DADOS (Arquivo JSON) ---

// Inicializa o banco de dados se não existir
function initDatabase() {
  if (!fs.existsSync(DATA_FILE)) {
    const initialData = {
      users: [],
      tasks: []
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2));
    console.log('Banco de dados criado: ' + DATA_FILE);
  }
}

// Lê os dados do arquivo
function readDatabase() {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Erro ao ler banco de dados:', err);
    return { users: [], tasks: [] };
  }
}

// Salva os dados no arquivo
function writeDatabase(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Erro ao salvar banco de dados:', err);
  }
}

// Inicializa o banco na inicialização do servidor
initDatabase();

// --- MIDDLEWARE DE AUTENTICAÇÃO ---

// Verifica se o usuário está logado
function requireAuth(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.status(401).json({ error: 'Não autorizado. Faça login.' });
  }
}

// Verifica se o usuário é gerente
function requireManager(req, res, next) {
  const db = readDatabase();
  const user = db.users.find(u => u.id === req.session.userId);
  
  if (user && user.role === 'manager') {
    next();
  } else {
    res.status(403).json({ error: 'Acesso negado. Apenas gerentes.' });
  }
}

// --- ROTAS DE AUTENTICAÇÃO ---

// Registro de novo usuário
app.post('/api/register', async (req, res) => {
  const { name, email, password, role } = req.body;
  
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
  }
  
  const db = readDatabase();
  
  // Verifica se o email já existe
  if (db.users.some(u => u.email === email)) {
    return res.status(400).json({ error: 'Este email já está cadastrado.' });
  }
  
  // Criptografa a senha
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const newUser = {
    id: uuidv4(),
    name,
    email,
    password: hashedPassword,
    role: role === 'manager' ? 'manager' : 'member', // 'manager' ou 'member'
    createdAt: new Date().toISOString()
  };
  
  db.users.push(newUser);
  writeDatabase(db);
  
  // Faz login automático
  req.session.userId = newUser.id;
  
  res.json({ 
    message: 'Conta criada com sucesso!', 
    user: { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } 
  });
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  
  const db = readDatabase();
  const user = db.users.find(u => u.email === email);
  
  if (!user) {
    return res.status(400).json({ error: 'Email ou senha incorretos.' });
  }
  
  const validPassword = await bcrypt.compare(password, user.password);
  
  if (!validPassword) {
    return res.status(400).json({ error: 'Email ou senha incorretos.' });
  }
  
  req.session.userId = user.id;
  
  res.json({ 
    message: 'Login realizado com sucesso!', 
    user: { id: user.id, name: user.name, email: user.email, role: user.role } 
  });
});

// Logout
app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ message: 'Logout realizado com sucesso!' });
});

// Verifica quem está logado
app.get('/api/me', requireAuth, (req, res) => {
  const db = readDatabase();
  const user = db.users.find(u => u.id === req.session.userId);
  
  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado.' });
  }
  
  res.json({ 
    user: { id: user.id, name: user.name, email: user.email, role: user.role } 
  });
});

// Lista todos os usuários (apenas gerente)
app.get('/api/users', requireAuth, requireManager, (req, res) => {
  const db = readDatabase();
  // Remove as senhas antes de enviar
  const safeUsers = db.users.map(u => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role
  }));
  res.json({ users: safeUsers });
});

// --- ROTAS DE TAREFAS ---

// Lista tarefas (membros veem as suas, gerente vê todas)
app.get('/api/tasks', requireAuth, (req, res) => {
  const db = readDatabase();
  const user = db.users.find(u => u.id === req.session.userId);
  
  let tasks;
  
  if (user.role === 'manager') {
    // Gerente vê todas as tarefas
    tasks = db.tasks;
  } else {
    // Membro vê apenas as tarefas atribuídas a ele
    tasks = db.tasks.filter(t => t.assignedTo === user.id);
  }
  
  // Adiciona informações do responsável em cada tarefa
  const tasksWithUsers = tasks.map(task => {
    const assignedUser = db.users.find(u => u.id === task.assignedTo);
    return {
      ...task,
      assignedToName: assignedUser ? assignedUser.name : 'Desconhecido'
    };
  });
  
  res.json({ tasks: tasksWithUsers });
});

// Cria uma nova tarefa
app.post('/api/tasks', requireAuth, (req, res) => {
  const { title, description, assignedTo, priority, dueDate } = req.body;
  const db = readDatabase();
  const currentUser = db.users.find(u => u.id === req.session.userId);
  
  if (!title) {
    return res.status(400).json({ error: 'O título é obrigatório.' });
  }
  
  // Se for membro, só pode criar tarefa para si mesmo
  let finalAssignedTo = assignedTo;
  if (currentUser.role === 'member') {
    finalAssignedTo = currentUser.id;
  }
  
  // Se for gerente, pode atribuir a qualquer um (ou a si mesmo)
  if (!finalAssignedTo) {
    finalAssignedTo = currentUser.id;
  }
  
  // Verifica se o usuário atribuído existe
  const assignedUser = db.users.find(u => u.id === finalAssignedTo);
  if (!assignedUser) {
    return res.status(400).json({ error: 'Usuário atribuído não encontrado.' });
  }
  
  const newTask = {
    id: uuidv4(),
    title,
    description: description || '',
    status: 'pending', // pending, in_progress, completed
    priority: priority || 'medium', // low, medium, high
    assignedTo: finalAssignedTo,
    createdBy: currentUser.id,
    createdByName: currentUser.name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dueDate: dueDate || null
  };
  
  db.tasks.push(newTask);
  writeDatabase(db);
  
  res.json({ message: 'Tarefa criada com sucesso!', task: newTask });
});

// Atualiza uma tarefa (status ou edição completa)
app.put('/api/tasks/:id', requireAuth, (req, res) => {
  const { id } = req.params;
  const { title, description, status, priority, assignedTo, dueDate } = req.body;
  
  const db = readDatabase();
  const currentUser = db.users.find(u => u.id === req.session.userId);
  const taskIndex = db.tasks.findIndex(t => t.id === id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Tarefa não encontrada.' });
  }
  
  const task = db.tasks[taskIndex];
  
  // Verifica permissões
  const isManager = currentUser.role === 'manager';
  const isOwner = task.assignedTo === currentUser.id;
  
  if (!isManager && !isOwner) {
    return res.status(403).json({ error: 'Você não tem permissão para editar esta tarefa.' });
  }
  
  // Membros só podem mudar o status
  if (!isManager) {
    if (status) task.status = status;
  } else {
    // Gerente pode mudar tudo
    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (status) task.status = status;
    if (priority) task.priority = priority;
    if (assignedTo) {
      // Verifica se o novo usuário existe
      const newUser = db.users.find(u => u.id === assignedTo);
      if (newUser) task.assignedTo = assignedTo;
    }
    if (dueDate !== undefined) task.dueDate = dueDate;
  }
  
  task.updatedAt = new Date().toISOString();
  
  db.tasks[taskIndex] = task;
  writeDatabase(db);
  
  res.json({ message: 'Tarefa atualizada com sucesso!', task });
});

// Remove uma tarefa (apenas gerente)
app.delete('/api/tasks/:id', requireAuth, requireManager, (req, res) => {
  const { id } = req.params;
  
  const db = readDatabase();
  const taskIndex = db.tasks.findIndex(t => t.id === id);
  
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Tarefa não encontrada.' });
  }
  
  db.tasks.splice(taskIndex, 1);
  writeDatabase(db);
  
  res.json({ message: 'Tarefa removida com sucesso!' });
});

// --- SERVIR ARQUIVOS ESTÁTICOS ---

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia o servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse: http://localhost:${PORT}`);
});
