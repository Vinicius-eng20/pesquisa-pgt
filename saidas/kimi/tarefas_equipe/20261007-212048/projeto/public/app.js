// Estado global da aplicação
let currentUser = null;
let allTasks = [];
let currentFilter = 'all';
let usersList = [];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  
  // Event Listeners
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('register-form').addEventListener('submit', handleRegister);
  document.getElementById('task-form').addEventListener('submit', handleCreateTask);
  document.getElementById('edit-form').addEventListener('submit', handleEditTask);
});

// --- FUNÇÕES DE AUTENTICAÇÃO ---

async function checkAuth() {
  try {
    const response = await fetch('/api/me');
    if (response.ok) {
      const data = await response.json();
      currentUser = data.user;
      showApp();
      loadTasks();
      if (currentUser.role === 'manager') {
        loadUsers();
      }
    } else {
      showAuth();
    }
  } catch (err) {
    console.error('Erro ao verificar autenticação:', err);
    showAuth();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      currentUser = data.user;
      showApp();
      loadTasks();
      if (currentUser.role === 'manager') loadUsers();
      showError('');
    } else {
      showError(data.error);
    }
  } catch (err) {
    showError('Erro ao conectar com o servidor.');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;
  
  try {
    const response = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    
    const data = await response.json();
    
    if (response.ok) {
      currentUser = data.user;
      showApp();
      loadTasks();
      if (currentUser.role === 'manager') loadUsers();
      showError('');
    } else {
      showError(data.error);
    }
  } catch (err) {
    showError('Erro ao conectar com o servidor.');
  }
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    currentUser = null;
    location.reload();
  } catch (err) {
    console.error('Erro ao fazer logout:', err);
  }
}

function showAuth() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
}

function showApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'block';
  
  // Atualiza interface baseada no papel do usuário
  document.getElementById('user-info').textContent = 
    `${currentUser.name} (${currentUser.role === 'manager' ? 'Gerente' : 'Membro'})`;
  
  document.getElementById('tasks-title').textContent = 
    currentUser.role === 'manager' ? 'Todas as Tarefas' : 'Minhas Tarefas';
  
  // Mostra campo de atribuir apenas para gerente
  if (currentUser.role === 'manager') {
    document.getElementById('assign-section').style.display = 'block';
  }
}

function showError(msg) {
  document.getElementById('auth-error').textContent = msg;
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(form => form.classList.remove('active'));
  
  if (tab === 'login') {
    document.querySelectorAll('.tab-btn')[0].classList.add('active');
    document.getElementById('login-form').classList.add('active');
  } else {
    document.querySelectorAll('.tab-btn')[1].classList.add('active');
    document.getElementById('register-form').classList.add('active');
  }
}

// --- FUNÇÕES DE TAREFAS ---

async function loadUsers() {
  try {
    const response = await fetch('/api/users');
    if (response.ok) {
      const data = await response.json();
      usersList = data.users;
      
      // Preenche os selects de atribuição
      const assignSelect = document.getElementById('task-assign');
      const editAssignSelect = document.getElementById('edit-assign');
      
      const options = usersList.map(user => 
        `<option value="${user.id}">${user.name}</option>`
      ).join('');
      
      assignSelect.innerHTML = options;
      editAssignSelect.innerHTML = options;
    }
  } catch (err) {
    console.error('Erro ao carregar usuários:', err);
  }
}

async function loadTasks() {
  try {
    const response = await fetch('/api/tasks');
    if (response.ok) {
      const data = await response.json();
      allTasks = data.tasks;
      renderTasks();
      updateStats();
    }
  } catch (err) {
    console.error('Erro ao carregar tarefas:', err);
  }
}

async function handleCreateTask(e) {
  e.preventDefault();
  
  const title = document.getElementById('task-title').value;
  const description = document.getElementById('task-desc').value;
  const priority = document.getElementById('task-priority').value;
  const dueDate = document.getElementById('task-due-date').value;
  
  let assignedTo = null;
  if (currentUser.role === 'manager') {
    assignedTo = document.getElementById('task-assign').value;
  }
  
  try {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, priority, assignedTo, dueDate })
    });
    
    if (response.ok) {
      document.getElementById('task-form').reset();
      loadTasks();
    } else {
      const data = await response.json();
      alert(data.error);
    }
  } catch (err) {
    alert('Erro ao criar tarefa.');
  }
}

async function handleEditTask(e) {
  e.preventDefault();
  
  const id = document.getElementById('edit-id').value;
  const title = document.getElementById('edit-title').value;
  const description = document.getElementById('edit-desc').value;
  const status = document.getElementById('edit-status').value;
  const priority = document.getElementById('edit-priority').value;
  const assignedTo = document.getElementById('edit-assign').value;
  const dueDate = document.getElementById('edit-due-date').value;
  
  try {
    const response = await fetch(`/api/tasks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, status, priority, assignedTo, dueDate })
    });
    
    if (response.ok) {
      closeModal();
      loadTasks();
    } else {
      const data = await response.json();
      alert(data.error);
    }
  } catch (err) {
    alert('Erro ao editar tarefa.');
  }
}

async function updateTaskStatus(taskId, newStatus) {
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    
    if (response.ok) {
      loadTasks();
    } else {
      const data = await response.json();
      alert(data.error);
    }
  } catch (err) {
    alert('Erro ao atualizar status.');
  }
}

async function deleteTask(taskId) {
  if (!confirm('Tem certeza que deseja excluir esta tarefa?')) return;
  
  try {
    const response = await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE'
    });
    
    if (response.ok) {
      loadTasks();
    } else {
      const data = await response.json();
      alert(data.error);
    }
  } catch (err) {
    alert('Erro ao excluir tarefa.');
  }
}

// --- FUNÇÕES DE RENDERIZAÇÃO ---

function filterTasks(filter) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  renderTasks();
}

function renderTasks() {
  const container = document.getElementById('tasks-list');
  
  let filteredTasks = allTasks;
  if (currentFilter !== 'all') {
    filteredTasks = allTasks.filter(t => t.status === currentFilter);
  }
  
  if (filteredTasks.length === 0) {
    container.innerHTML = '<p class="loading">Nenhuma tarefa encontrada.</p>';
    return;
  }
  
  container.innerHTML = filteredTasks.map(task => {
    const isManager = currentUser.role === 'manager';
    const isOwner = task.assignedTo === currentUser.id;
    const canEdit = isManager; // Apenas gerente pode editar completamente
    const canDelete = isManager;
    const canChangeStatus = isManager || isOwner;
    
    const priorityText = {
      low: 'Baixa',
      medium: 'Média',
      high: 'Alta'
    };
    
    const statusText = {
      pending: 'Pendente',
      in_progress: 'Em Andamento',
      completed: 'Concluída'
    };
    
    const dueDate = task.dueDate ? new Date(task.dueDate).toLocaleDateString('pt-BR') : 'Sem prazo';
    
    return `
      <div class="task-card priority-${task.priority}">
        <div class="task-header">
          <div class="task-title">${escapeHtml(task.title)}</div>
          <div class="task-badges">
            <span class="badge badge-priority-${task.priority}">${priorityText[task.priority]}</span>
            <span class="badge badge-status-${task.status}">${statusText[task.status]}</span>
          </div>
        </div>
        
        <div class="task-desc">${escapeHtml(task.description || 'Sem descrição')}</div>
        
        <div class="task-meta">
          <span>Responsável: <span class="task-assigned">${escapeHtml(task.assignedToName)}</span></span>
          <span>Prazo: ${dueDate}</span>
          <span>Criada por: ${escapeHtml(task.createdByName)}</span>
        </div>
        
        <div class="task-actions">
          ${canChangeStatus ? `
            <select class="status-select" onchange="updateTaskStatus('${task.id}', this.value)">
              <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Pendente</option>
              <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>Em Andamento</option>
              <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Concluída</option>
            </select>
          ` : ''}
          
          ${canEdit ? `
            <button class="btn-small btn-edit" onclick="openEditModal('${task.id}')">✏️ Editar</button>
          ` : ''}
          
          ${canDelete ? `
            <button class="btn-small btn-delete" onclick="deleteTask('${task.id}')">🗑️ Excluir</button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function updateStats() {
  const pending = allTasks.filter(t => t.status === 'pending').length;
  const inProgress = allTasks.filter(t => t.status === 'in_progress').length;
  const completed = allTasks.filter(t => t.status === 'completed').length;
  
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-progress').textContent = inProgress;
  document.getElementById('stat-done').textContent = completed;
}

// --- FUNÇÕES DO MODAL ---

function openEditModal(taskId) {
  const task = allTasks.find(t => t.id === taskId);
  if (!task) return;
  
  document.getElementById('edit-id').value = task.id;
  document.getElementById('edit-title').value = task.title;
  document.getElementById('edit-desc').value = task.description;
  document.getElementById('edit-status').value = task.status;
  document.getElementById('edit-priority').value = task.priority;
  document.getElementById('edit-assign').value = task.assignedTo;
  document.getElementById('edit-due-date').value = task.dueDate || '';
  
  document.getElementById('edit-modal').style.display = 'block';
}

function closeModal() {
  document.getElementById('edit-modal').style.display = 'none';
}

// Fecha modal se clicar fora dele
window.onclick = function(event) {
  const modal = document.getElementById('edit-modal');
  if (event.target === modal) {
    closeModal();
  }
}

// --- UTILITÁRIOS ---

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
