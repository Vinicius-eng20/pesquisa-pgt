const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'sua-chave-secreta-muito-segura-mude-isso-em-producao';
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const TASKS_FILE = path.join(DATA_DIR, 'tasks.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Garantir que o diretório de dados existe
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Inicializar arquivos de dados se não existirem
function initializeData() {
    if (!fs.existsSync(USERS_FILE)) {
        const adminPassword = bcrypt.hashSync('admin123', 10);
        const defaultUsers = [
            {
                id: uuidv4(),
                username: 'admin',
                password: adminPassword,
                name: 'Gerente Principal',
                role: 'manager',
                createdAt: new Date().toISOString()
            }
        ];
        fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
        console.log('✅ Usuário admin criado: usuário="admin", senha="admin123"');
    }

    if (!fs.existsSync(TASKS_FILE)) {
        fs.writeFileSync(TASKS_FILE, JSON.stringify([], null, 2));
    }
}

initializeData();

// Helpers para ler/escrever dados
function readUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

function writeUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function readTasks() {
    try {
        const data = fs.readFileSync(TASKS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

function writeTasks(tasks) {
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2));
}

// Middleware de autenticação
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Acesso negado. Token não fornecido.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Token inválido ou expirado.' });
        }
        req.user = user;
        next();
    });
}

// Middleware para verificar se é gerente
function requireManager(req, res, next) {
    if (req.user.role !== 'manager') {
        return res.status(403).json({ error: 'Acesso restrito a gerentes.' });
    }
    next();
}

// Rotas de Autenticação

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
    }

    const users = readUsers();
    const user = users.find(u => u.username === username);

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role, name: user.name },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({
        token,
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role
        }
    });
});

// Verificar token (para manter sessão)
app.get('/api/me', authenticateToken, (req, res) => {
    const users = readUsers();
    const user = users.find(u => u.id === req.user.id);
    
    if (!user) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json({
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
    });
});

// Rotas de Usuários (Gerenciamento)

// Listar todos os usuários (apenas gerente)
app.get('/api/users', authenticateToken, requireManager, (req, res) => {
    const users = readUsers();
    const safeUsers = users.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        createdAt: u.createdAt
    }));
    res.json(safeUsers);
});

// Criar novo usuário (apenas gerente)
app.post('/api/users', authenticateToken, requireManager, (req, res) => {
    const { username, password, name, role } = req.body;

    if (!username || !password || !name) {
        return res.status(400).json({ error: 'Todos os campos são obrigatórios.' });
    }

    if (role !== 'manager' && role !== 'member') {
        return res.status(400).json({ error: 'Função inválida. Use "manager" ou "member".' });
    }

    const users = readUsers();
    
    if (users.find(u => u.username === username)) {
        return res.status(400).json({ error: 'Nome de usuário já existe.' });
    }

    const newUser = {
        id: uuidv4(),
        username,
        password: bcrypt.hashSync(password, 10),
        name,
        role,
        createdAt: new Date().toISOString()
    };

    users.push(newUser);
    writeUsers(users);

    res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        name: newUser.name,
        role: newUser.role
    });
});

// Atualizar usuário (apenas gerente)
app.put('/api/users/:id', authenticateToken, requireManager, (req, res) => {
    const { id } = req.params;
    const { name, role, password } = req.body;

    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Não permitir remover o próprio usuário admin se for o último gerente
    if (users[userIndex].username === 'admin' && role !== 'manager') {
        const managers = users.filter(u => u.role === 'manager');
        if (managers.length === 1) {
            return res.status(400).json({ error: 'Não é possível remover a função de gerente do último administrador.' });
        }
    }

    users[userIndex].name = name || users[userIndex].name;
    users[userIndex].role = role || users[userIndex].role;
    
    if (password) {
        users[userIndex].password = bcrypt.hashSync(password, 10);
    }

    writeUsers(users);

    res.json({
        id: users[userIndex].id,
        username: users[userIndex].username,
        name: users[userIndex].name,
        role: users[userIndex].role
    });
});

// Deletar usuário (apenas gerente)
app.delete('/api/users/:id', authenticateToken, requireManager, (req, res) => {
    const { id } = req.params;

    const users = readUsers();
    const userIndex = users.findIndex(u => u.id === id);

    if (userIndex === -1) {
        return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Não permitir deletar o próprio usuário se for o último gerente
    if (users[userIndex].username === 'admin') {
        const managers = users.filter(u => u.role === 'manager');
        if (managers.length === 1) {
            return res.status(400).json({ error: 'Não é possível deletar o último administrador do sistema.' });
        }
    }

    // Remover tarefas atribuídas a este usuário
    const tasks = readTasks();
    const updatedTasks = tasks.filter(t => t.assignedTo !== id);
    writeTasks(updatedTasks);

    users.splice(userIndex, 1);
    writeUsers(users);

    res.json({ message: 'Usuário removido com sucesso.' });
});

// Rotas de Tarefas

// Listar tarefas (todos podem ver, mas filtradas)
// Se for membro, vê apenas as suas. Se for gerente, vê todas.
app.get('/api/tasks', authenticateToken, (req, res) => {
    const tasks = readTasks();
    const users = readUsers();
    
    // Adicionar nome do responsável às tarefas
    const tasksWithNames = tasks.map(task => {
        const assignedUser = users.find(u => u.id === task.assignedTo);
        const creatorUser = users.find(u => u.id === task.createdBy);
        return {
            ...task,
            assignedToName: assignedUser ? assignedUser.name : 'Usuário removido',
            createdByName: creatorUser ? creatorUser.name : 'Sistema'
        };
    });

    if (req.user.role === 'manager') {
        res.json(tasksWithNames);
    } else {
        // Membros veem apenas tarefas atribuídas a eles ou criadas por eles
        const myTasks = tasksWithNames.filter(t => 
            t.assignedTo === req.user.id || t.createdBy === req.user.id
        );
        res.json(myTasks);
    }
});

// Criar tarefa
app.post('/api/tasks', authenticateToken, (req, res) => {
    const { title, description, priority, assignedTo, dueDate } = req.body;

    if (!title) {
        return res.status(400).json({ error: 'Título é obrigatório.' });
    }

    // Se não especificar assignedTo, atribui a si mesmo
    const finalAssignedTo = assignedTo || req.user.id;

    // Membros só podem criar tarefas para si mesmos
    if (req.user.role !== 'manager' && finalAssignedTo !== req.user.id) {
        return res.status(403).json({ error: 'Membros só podem criar tarefas para si mesmos.' });
    }

    // Verificar se o usuário atribuído existe
    const users = readUsers();
    if (!users.find(u => u.id === finalAssignedTo)) {
        return res.status(400).json({ error: 'Usuário atribuído não encontrado.' });
    }

    const newTask = {
        id: uuidv4(),
        title,
        description: description || '',
        priority: priority || 'medium', // low, medium, high
        status: 'pending', // pending, in_progress, completed
        assignedTo: finalAssignedTo,
        createdBy: req.user.id,
        dueDate: dueDate || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    const tasks = readTasks();
    tasks.push(newTask);
    writeTasks(tasks);

    // Retornar com nomes
    const assignedUser = users.find(u => u.id === finalAssignedTo);
    res.status(201).json({
        ...newTask,
        assignedToName: assignedUser ? assignedUser.name : 'Desconhecido',
        createdByName: req.user.name
    });
});

// Atualizar tarefa (status, edição completa para gerente)
app.put('/api/tasks/:id', authenticateToken, (req, res) => {
    const { id } = req.params;
    const { title, description, priority, status, assignedTo, dueDate } = req.body;

    const tasks = readTasks();
    const taskIndex = tasks.findIndex(t => t.id === id);

    if (taskIndex === -1) {
        return res.status(404).json({ error: 'Tarefa não encontrada.' });
    }

    const task = tasks[taskIndex];

    // Verificar permissões
    const isManager = req.user.role === 'manager';
    const isOwner = task.createdBy === req.user.id;
    const isAssigned = task.assignedTo === req.user.id;

    if (!isManager && !isOwner && !isAssigned) {
        return res.status(403).json({ error: 'Você não tem permissão para editar esta tarefa.' });
    }

    // Membros só podem alterar o status, não podem reatribuir ou editar detalhes de tarefas de outros
    if (!isManager && !isOwner) {
        // Se for apenas o assigned (não criador), só pode mudar status
        if (title || description || assignedTo) {
            return res.status(403).json({ error: 'Você só pode alterar o status desta tarefa.' });
        }
    }

    // Atualizar campos
    if (title !== undefined) tasks[taskIndex].title = title;
    if (description !== undefined) tasks[taskIndex].description = description;
    if (priority !== undefined) tasks[taskIndex].priority = priority;
    if (status !== undefined) tasks[taskIndex].status = status;
    if (dueDate !== undefined) tasks[taskIndex].dueDate = dueDate;
    
    // Apenas gerente pode reatribuir
    if (assignedTo !== undefined && isManager) {
        const users = readUsers();
        if (!users.find(u => u.id === assignedTo)) {
            return res.status(400).json({ error: 'Usuário atribuído não encontrado.' });
        }
        tasks[taskIndex].assignedTo = assignedTo;
    }

    tasks[taskIndex].updatedAt = new Date().toISOString();

    writeTasks(tasks);

    // Retornar com nomes
    const users = readUsers();
    const assignedUser = users.find(u => u.id === tasks[taskIndex].assignedTo);
    const creatorUser = users.find(u => u.id === tasks[taskIndex].createdBy);

    res.json({
        ...tasks[taskIndex],
        assignedToName: assignedUser ? assignedUser.name : 'Desconhecido',
        createdByName: creatorUser ? creatorUser.name : 'Sistema'
    });
});

// Deletar tarefa
app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
    const { id } = req.params;

    const tasks = readTasks();
    const taskIndex = tasks.findIndex(t => t.id === id);

    if (taskIndex === -1) {
        return res.status(404).json({ error: 'Tarefa não encontrada.' });
    }

    const task = tasks[taskIndex];

    // Apenas gerente ou criador pode deletar
    if (req.user.role !== 'manager' && task.createdBy !== req.user.id) {
        return res.status(403).json({ error: 'Você não tem permissão para excluir esta tarefa.' });
    }

    tasks.splice(taskIndex, 1);
    writeTasks(tasks);

    res.json({ message: 'Tarefa removida com sucesso.' });
});

// Rota para servir o frontend (SPA fallback)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando na porta ${PORT}`);
    console.log(`📱 Acesse localmente: http://localhost:${PORT}`);
    console.log(`🌐 Para acesso externo, use o IP desta máquina na porta ${PORT}`);
});
