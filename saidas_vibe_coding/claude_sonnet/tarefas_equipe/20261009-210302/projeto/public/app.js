// Estado da aplicação
let currentUser = null;
let allTasks = [];
let allUsers = [];

// Elementos do DOM
const loginScreen = document.getElementById('login-screen');
const mainScreen = document.getElementById('main-screen');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const userNameSpan = document.getElementById('user-name');
const newTaskBtn = document.getElementById('new-task-btn');
const newUserBtn = document.getElementById('new-user-btn');
const tasksContainer = document.getElementById('tasks-container');
const emptyState = document.getElementById('empty-state');
const statusFilter = document.getElementById('status-filter');
const taskModal = document.getElementById('task-modal');
const taskModalTitle = document.getElementById('task-modal-title');
const taskForm = document.getElementById('task-form');
const userModal = document.getElementById('user-modal');
const userForm = document.getElementById('user-form');
const userError = document.getElementById('user-error');

// Inicializar aplicação
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  setupEventListeners();
});

// Verificar autenticação
async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (response.ok) {
      currentUser = await response.json();
      showMainScreen();
    } else {
      showLoginScreen();
    }
  } catch (error) {
    showLoginScreen();
  }
}

// Configurar event listeners
function setupEventListeners() {
  // Login
  loginForm.addEventListener('submit', handleLogin);
  
  // Logout
  logoutBtn.addEventListener('click', handleLogout);
  
  // Nova tarefa
  newTaskBtn.addEventListener('click', () => openTaskModal());
  
  // Novo usuário
  newUserBtn.addEventListener('click', () => openUserModal());
  
  // Filtro de status
  statusFilter.addEventListener('change', renderTasks);
  
  // Formulário de tarefa
  taskForm.addEventListener('submit', handleTaskSubmit);
  
  // Formulário de usuário
  userForm.addEventListener('submit', handleUserSubmit);
  
  // Fechar modais
  document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', closeModals);
  });
  
  // Fechar modal clicando fora
  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
      closeModals();
    }
  });
}

// Login
async function handleLogin(e) {
  e.preventDefault();
  
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      currentUser = data.user;
      showMainScreen();
    } else {
      showError(loginError, data.error);
    }
  } catch (error) {
    showError(loginError, 'Erro ao fazer login. Tente novamente.');
  }
}

// Logout
async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    currentUser = null;
    showLoginScreen();
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
  }
}

// Mostrar tela de login
function showLoginScreen() {
  loginScreen.classList.add('active');
  mainScreen.classList.remove('active');
  loginForm.reset();
  loginError.classList.remove('show');
}

// Mostrar tela principal
function showMainScreen() {
  loginScreen.classList.remove('active');
  mainScreen.classList.add('active');
  userNameSpan.textContent = currentUser.name;
  
  // Mostrar botão de novo usuário apenas para gerentes
  if (currentUser.role === 'manager') {
    newUserBtn.style.display = 'block';
  } else {
    newUserBtn.style.display = 'none';
  }
  
  loadData();
}

// Carregar dados
async function loadData() {
  await Promise.all([loadTasks(), loadUsers()]);
  renderTasks();
}

// Carregar tarefas
async function loadTasks() {
  try {
    const response = await fetch('/api/tasks');
    if (response.ok) {
      allTasks = await response.json();
    }
  } catch (error) {
    console.error('Erro ao carregar tarefas:', error);
  }
}

// Carregar usuários
async function loadUsers() {
  try {
    const response = await fetch('/api/users');
    if (response.ok) {
      allUsers = await response.json();
      updateUserSelects();
    }
  } catch (error) {
    console.error('Erro ao carregar usuários:', error);
  }
}

// Atualizar selects de usuários
function updateUserSelects() {
  const taskAssignedSelect = document.getElementById('task-assigned');
  taskAssignedSelect.innerHTML = '<option value="">Selecione um membro</option>';
  
  const members = allUsers.filter(u => u.role === 'member');
  members.forEach(user => {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.name;
    taskAssignedSelect.appendChild(option);
  });
}

// Renderizar tarefas
function renderTasks() {
  const filter = statusFilter.value;
  let filteredTasks = allTasks;
  
  if (filter !== 'all') {
    filteredTasks = allTasks.filter(task => task.status === filter);
  }
  
  if (filteredTasks.length === 0) {
    tasksContainer.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }
  
  tasksContainer.style.display = 'grid';
  emptyState.style.display = 'none';
  
  tasksContainer.innerHTML = '';
  
  filteredTasks.forEach(task => {
    const taskCard = createTaskCard(task);
    tasksContainer.appendChild(taskCard);
  });
}

// Criar card de tarefa
function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = 'task-card';
  
  const statusText = {
    'pending': 'Pendente',
    'in-progress': 'Em Progresso',
    'completed': 'Concluída'
  };
  
  let actionsHTML = '';
  
  if (currentUser.role === 'manager') {
    actionsHTML = `
      <button class="btn btn-primary btn-sm" onclick="openTaskModal(${task.id})">Editar</button>
      <button class="btn btn-danger btn-sm" onclick="deleteTask(${task.id})">Excluir</button>
    `;
  } else if (task.assignedTo === currentUser.id) {
    actionsHTML = `
      <button class="btn btn-primary btn-sm" onclick="openTaskModal(${task.id})">Alterar Status</button>
    `;
  }
  
  card.innerHTML = `
    <div class="task-header">
      <h3 class="task-title">${escapeHtml(task.title)}</h3>
      <div class="task-actions">
        ${actionsHTML}
      </div>
    </div>
    ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
    <div class="task-meta">
      <div class="task-assigned">
        <strong>👤 ${escapeHtml(task.assignedToName)}</strong>
      </div>
      <span class="task-status ${task.status}">${statusText[task.status]}</span>
    </div>
  `;
  
  return card;
}

// Abrir modal de tarefa
function openTaskModal(taskId = null) {
  const taskIdInput = document.getElementById('task-id');
  const taskTitle = document.getElementById('task-title');
  const taskDescription = document.getElementById('task-description');
  const taskAssigned = document.getElementById('task-assigned');
  const taskStatus = document.getElementById('task-status');
  const assignGroup = document.getElementById('assign-group');
  const statusGroup = document.getElementById('status-group');
  
  if (taskId) {
    const task = allTasks.find(t => t.id === taskId);
    if (!task) return;
    
    taskModalTitle.textContent = currentUser.role === 'manager' ? 'Editar Tarefa' : 'Alterar Status da Tarefa';
    taskIdInput.value = task.id;
    taskTitle.value = task.title;
    taskDescription.value = task.description;
    taskAssigned.value = task.assignedTo;
    taskStatus.value = task.status;
    
    if (currentUser.role === 'manager') {
      taskTitle.disabled = false;
      taskDescription.disabled = false;
      taskAssigned.disabled = false;
      assignGroup.style.display = 'block';
      statusGroup.style.display = 'block';
    } else {
      taskTitle.disabled = true;
      taskDescription.disabled = true;
      taskAssigned.disabled = true;
      assignGroup.style.display = 'none';
      statusGroup.style.display = 'block';
    }
  } else {
    taskModalTitle.textContent = 'Nova Tarefa';
    taskForm.reset();
    taskIdInput.value = '';
    taskTitle.disabled = false;
    taskDescription.disabled = false;
    
    if (currentUser.role === 'manager') {
      taskAssigned.disabled = false;
      assignGroup.style.display = 'block';
    } else {
      taskAssigned.disabled = true;
      assignGroup.style.display = 'none';
    }
    statusGroup.style.display = 'none';
  }
  
  taskModal.classList.add('active');
}

// Enviar formulário de tarefa
async function handleTaskSubmit(e) {
  e.preventDefault();
  
  const taskId = document.getElementById('task-id').value;
  const title = document.getElementById('task-title').value;
  const description = document.getElementById('task-description').value;
  const assignedTo = document.getElementById('task-assigned').value;
  const status = document.getElementById('task-status').value;
  
  const data = { title, description, assignedTo: parseInt(assignedTo) || undefined, status };
  
  try {
    let response;
    if (taskId) {
      response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } else {
      response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    }
    
    if (response.ok) {
      closeModals();
      await loadTasks();
      renderTasks();
    } else {
      const error = await response.json();
      alert(error.error || 'Erro ao salvar tarefa');
    }
  } catch (error) {
    alert('Erro ao salvar tarefa. Tente novamente.');
  }
}

// Excluir tarefa
async function deleteTask(taskId) {
  if (!confirm('Tem certeza que deseja excluir esta tarefa?')) {
    return;
  }
  
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      await loadTasks();
      renderTasks();
    } else {
      const error = await response.json();
      alert(error.error || 'Erro ao excluir tarefa');
    }
  } catch (error) {
    alert('Erro ao excluir tarefa. Tente novamente.');
  }
}

// Abrir modal de usuário
function openUserModal() {
  userForm.reset();
  userError.classList.remove('show');
  userModal.classList.add('active');
}

// Enviar formulário de usuário
async function handleUserSubmit(e) {
  e.preventDefault();
  
  const name = document.getElementById('user-name').value;
  const username = document.getElementById('user-username').value;
  const password = document.getElementById('user-password').value;
  
  try {
    const response = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, username, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      closeModals();
      await loadUsers();
      alert(`Membro ${data.name} criado com sucesso!`);
    } else {
      showError(userError, data.error);
    }
  } catch (error) {
    showError(userError, 'Erro ao criar membro. Tente novamente.');
  }
}

// Fechar modais
function closeModals() {
  taskModal.classList.remove('active');
  userModal.classList.remove('active');
}

// Mostrar erro
function showError(element, message) {
  element.textContent = message;
  element.classList.add('show');
  setTimeout(() => {
    element.classList.remove('show');
  }, 5000);
}

// Escapar HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
