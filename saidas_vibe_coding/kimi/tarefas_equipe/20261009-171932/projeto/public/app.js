// Estado global da aplicação
let currentUser = null;
let token = localStorage.getItem('token');
let allTasks = [];
let allUsers = [];
let currentDeleteId = null;
let currentDeleteType = null; // 'task' ou 'user'

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        validateToken();
    } else {
        showLoginScreen();
    }

    // Event Listeners
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
    document.getElementById('task-form').addEventListener('submit', handleTaskSubmit);
    document.getElementById('user-form').addEventListener('submit', handleUserSubmit);
    document.getElementById('confirm-delete-btn').addEventListener('click', confirmDelete);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tab = e.target.dataset.tab;
            switchTab(tab);
        });
    });

    // Fechar modal ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('active');
        }
    });
});

// Autenticação
async function validateToken() {
    try {
        const response = await fetch('/api/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            currentUser = await response.json();
            showDashboard();
            loadInitialData();
        } else {
            localStorage.removeItem('token');
            token = null;
            showLoginScreen();
        }
    } catch (error) {
        console.error('Erro ao validar token:', error);
        showLoginScreen();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            token = data.token;
            currentUser = data.user;
            localStorage.setItem('token', token);
            errorDiv.classList.add('hidden');
            showDashboard();
            loadInitialData();
        } else {
            errorDiv.textContent = data.error || 'Erro ao fazer login';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        errorDiv.textContent = 'Erro de conexão. Tente novamente.';
        errorDiv.classList.remove('hidden');
    }
}

function handleLogout() {
    localStorage.removeItem('token');
    token = null;
    currentUser = null;
    showLoginScreen();
    document.getElementById('login-form').reset();
}

// Navegação
function showLoginScreen() {
    document.getElementById('login-screen').classList.add('active');
    document.getElementById('dashboard-screen').classList.remove('active');
}

function showDashboard() {
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('dashboard-screen').classList.add('active');
    
    // Atualizar UI com dados do usuário
    document.getElementById('user-name-display').textContent = currentUser.name;
    const roleBadge = document.getElementById('user-role-badge');
    roleBadge.textContent = currentUser.role === 'manager' ? 'Gerente' : 'Membro';
    roleBadge.className = `badge ${currentUser.role}`;

    // Mostrar/ocultar tabs baseado na role
    const isManager = currentUser.role === 'manager';
    document.getElementById('tab-all-tasks').style.display = isManager ? 'block' : 'none';
    document.getElementById('tab-team').style.display = isManager ? 'block' : 'none';
}

function switchTab(tabName) {
    // Atualizar botões
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Atualizar conteúdo
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    // Carregar dados específicos
    if (tabName === 'tasks') loadTasks();
    if (tabName === 'all-tasks') loadAllTasks();
    if (tabName === 'team') loadUsers();
}

// Carregamento de Dados
async function loadInitialData() {
    await loadTasks();
    if (currentUser.role === 'manager') {
        await loadUsers(); // Necessário para o select de atribuição
        populateUserSelects();
    }
}

async function loadTasks() {
    try {
        const response = await fetch('/api/tasks', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            allTasks = await response.json();
            renderTasks('tasks-list', allTasks);
        }
    } catch (error) {
        console.error('Erro ao carregar tarefas:', error);
        showToast('Erro ao carregar tarefas', 'error');
    }
}

async function loadAllTasks() {
    try {
        const response = await fetch('/api/tasks', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            allTasks = await response.json();
            renderTasks('all-tasks-list', allTasks);
        }
    } catch (error) {
        console.error('Erro ao carregar todas as tarefas:', error);
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/users', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            allUsers = await response.json();
            renderUsersTable();
            populateUserSelects();
        }
    } catch (error) {
        console.error('Erro ao carregar usuários:', error);
    }
}

// Renderização
function renderTasks(containerId, tasks) {
    const container = document.getElementById(containerId);
    const statusFilter = document.getElementById(containerId === 'tasks-list' ? 'filter-status' : 'filter-status-all').value;
    const priorityFilter = document.getElementById('filter-priority')?.value || '';
    const userFilter = document.getElementById('filter-user')?.value || '';

    let filtered = tasks;

    if (statusFilter) {
        filtered = filtered.filter(t => t.status === statusFilter);
    }
    if (priorityFilter && containerId === 'tasks-list') {
        filtered = filtered.filter(t => t.priority === priorityFilter);
    }
    if (userFilter && containerId === 'all-tasks-list') {
        filtered = filtered.filter(t => t.assignedTo === userFilter);
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div class="loading">Nenhuma tarefa encontrada.</div>';
        return;
    }

    container.innerHTML = filtered.map(task => `
        <div class="task-card priority-${task.priority} status-${task.status}">
            <div class="task-header">
                <div>
                    <div class="task-title">${escapeHtml(task.title)}</div>
                    <div class="task-meta">
                        <span class="task-badge status-${task.status}">${getStatusLabel(task.status)}</span>
                        <span class="task-badge priority-${task.priority}">${getPriorityLabel(task.priority)}</span>
                    </div>
                </div>
                <div class="task-actions">
                    ${canEditTask(task) ? `<button class="btn-icon" onclick="openTaskModal('${task.id}')" title="Editar">✏️</button>` : ''}
                    ${canDeleteTask(task) ? `<button class="btn-icon" onclick="openConfirmModal('${task.id}', 'task')" title="Excluir">🗑️</button>` : ''}
                </div>
            </div>
            
            ${task.description ? `<div class="task-description">${escapeHtml(task.description)}</div>` : ''}
            
            <div class="task-footer">
                <div class="task-assignee">
                    <span>👤 ${escapeHtml(task.assignedToName)}</span>
                </div>
                ${task.dueDate ? `<div class="task-date ${isOverdue(task.dueDate) ? 'overdue' : ''}">📅 ${formatDate(task.dueDate)}</div>` : ''}
            </div>
            
            ${task.status !== 'completed' && canChangeStatus(task) ? `
                <div style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--border-color);">
                    <select onchange="updateTaskStatus('${task.id}', this.value)" style="width: 100%; padding: 0.375rem; border-radius: 0.25rem; border: 1px solid var(--border-color);">
                        <option value="">Alterar status...</option>
                        <option value="pending" ${task.status === 'pending' ? 'selected' : ''}>Pendente</option>
                        <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>Em Andamento</option>
                        <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Concluída</option>
                    </select>
                </div>
            ` : ''}
        </div>
    `).join('');
}

function renderUsersTable() {
    const tbody = document.getElementById('users-table-body');
    
    if (allUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="loading">Nenhum usuário encontrado.</td></tr>';
        return;
    }

    tbody.innerHTML = allUsers.map(user => `
        <tr>
            <td>${escapeHtml(user.name)}</td>
            <td>${escapeHtml(user.username)}</td>
            <td><span class="badge ${user.role}">${user.role === 'manager' ? 'Gerente' : 'Membro'}</span></td>
            <td>${formatDate(user.createdAt)}</td>
            <td>
                <button class="btn-icon" onclick="openUserModal('${user.id}')" title="Editar">✏️</button>
                ${user.username !== 'admin' ? `<button class="btn-icon" onclick="openConfirmModal('${user.id}', 'user')" title="Excluir">🗑️</button>` : ''}
            </td>
        </tr>
    `).join('');
}

function populateUserSelects() {
    const selects = [
        document.getElementById('task-assigned-to'),
        document.getElementById('filter-user')
    ];

    selects.forEach(select => {
        if (!select) return;
        
        const currentValue = select.value;
        const isFilter = select.id === 'filter-user';
        
        // Manter a primeira opção se for filtro
        const firstOption = isFilter ? select.options[0] : null;
        
        select.innerHTML = '';
        
        if (isFilter) {
            select.appendChild(firstOption);
        } else {
            // No modal de tarefa, adicionar opção "Eu mesmo"
            const selfOption = document.createElement('option');
            selfOption.value = currentUser.id;
            selfOption.textContent = `Eu mesmo (${currentUser.name})`;
            select.appendChild(selfOption);
        }

        allUsers.forEach(user => {
            if (isFilter || user.id !== currentUser.id) {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = user.name;
                select.appendChild(option);
            }
        });

        if (currentValue) select.value = currentValue;
    });
}

// Modais - Tarefa
function openTaskModal(taskId = null) {
    const modal = document.getElementById('task-modal');
    const form = document.getElementById('task-form');
    const title = document.getElementById('task-modal-title');
    const statusGroup = document.getElementById('task-status-group');
    const assigneeGroup = document.getElementById('task-assignee-group');
    
    form.reset();
    document.getElementById('task-id').value = '';
    
    // Configurar visibilidade baseada na role
    const isManager = currentUser.role === 'manager';
    assigneeGroup.style.display = isManager ? 'block' : 'none';
    
    if (taskId) {
        const task = allTasks.find(t => t.id === taskId);
        if (task) {
            title.textContent = 'Editar Tarefa';
            document.getElementById('task-id').value = task.id;
            document.getElementById('task-title').value = task.title;
            document.getElementById('task-description').value = task.description || '';
            document.getElementById('task-priority').value = task.priority;
            document.getElementById('task-due-date').value = task.dueDate || '';
            document.getElementById('task-status').value = task.status;
            
            if (isManager) {
                document.getElementById('task-assigned-to').value = task.assignedTo;
            }
            
            statusGroup.style.display = 'block';
        }
    } else {
        title.textContent = 'Nova Tarefa';
        statusGroup.style.display = 'none';
        
        if (isManager) {
            populateUserSelects(); // Recarregar para garantir
        }
    }
    
    modal.classList.add('active');
}

function closeTaskModal() {
    document.getElementById('task-modal').classList.remove('active');
}

async function handleTaskSubmit(e) {
    e.preventDefault();
    
    const taskId = document.getElementById('task-id').value;
    const isManager = currentUser.role === 'manager';
    
    const taskData = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-description').value,
        priority: document.getElementById('task-priority').value,
        dueDate: document.getElementById('task-due-date').value || null
    };

    if (isManager) {
        taskData.assignedTo = document.getElementById('task-assigned-to').value;
    } else {
        taskData.assignedTo = currentUser.id;
    }

    if (taskId) {
        taskData.status = document.getElementById('task-status').value;
    }

    try {
        const url = taskId ? `/api/tasks/${taskId}` : '/api/tasks';
        const method = taskId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(taskData)
        });

        if (response.ok) {
            showToast(taskId ? 'Tarefa atualizada!' : 'Tarefa criada!', 'success');
            closeTaskModal();
            loadTasks();
            if (document.getElementById('tab-all-tasks').classList.contains('active')) {
                loadAllTasks();
            }
        } else {
            const data = await response.json();
            showToast(data.error || 'Erro ao salvar tarefa', 'error');
        }
    } catch (error) {
        showToast('Erro de conexão', 'error');
    }
}

async function updateTaskStatus(taskId, newStatus) {
    if (!newStatus) return;
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });

        if (response.ok) {
            showToast('Status atualizado!', 'success');
            loadTasks();
            if (document.getElementById('tab-all-tasks').classList.contains('active')) {
                loadAllTasks();
            }
        } else {
            showToast('Erro ao atualizar status', 'error');
            loadTasks(); // Recarregar para reverter o select
        }
    } catch (error) {
        showToast('Erro de conexão', 'error');
    }
}

// Modais - Usuário
function openUserModal(userId = null) {
    const modal = document.getElementById('user-modal');
    const form = document.getElementById('user-form');
    const title = document.getElementById('user-modal-title');
    const passwordHint = document.getElementById('password-hint');
    
    form.reset();
    document.getElementById('user-id').value = '';
    
    if (userId) {
        const user = allUsers.find(u => u.id === userId);
        if (user) {
            title.textContent = 'Editar Membro';
            document.getElementById('user-id').value = user.id;
            document.getElementById('user-name').value = user.name;
            document.getElementById('user-username').value = user.username;
            document.getElementById('user-username').disabled = true; // Não permitir mudar username
            document.getElementById('user-role').value = user.role;
            document.getElementById('user-password').required = false;
            passwordHint.textContent = '(deixe em branco para manter)';
        }
    } else {
        title.textContent = 'Novo Membro';
        document.getElementById('user-username').disabled = false;
        document.getElementById('user-password').required = true;
        passwordHint.textContent = '*';
    }
    
    modal.classList.add('active');
}

function closeUserModal() {
    document.getElementById('user-modal').classList.remove('active');
}

async function handleUserSubmit(e) {
    e.preventDefault();
    
    const userId = document.getElementById('user-id').value;
    const password = document.getElementById('user-password').value;
    
    const userData = {
        name: document.getElementById('user-name').value,
        role: document.getElementById('user-role').value
    };

    if (!userId) {
        userData.username = document.getElementById('user-username').value;
        userData.password = password;
    } else if (password) {
        userData.password = password;
    }

    try {
        const url = userId ? `/api/users/${userId}` : '/api/users';
        const method = userId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            showToast(userId ? 'Usuário atualizado!' : 'Usuário criado!', 'success');
            closeUserModal();
            loadUsers();
        } else {
            const data = await response.json();
            showToast(data.error || 'Erro ao salvar usuário', 'error');
        }
    } catch (error) {
        showToast('Erro de conexão', 'error');
    }
}

// Modal de Confirmação
function openConfirmModal(id, type) {
    currentDeleteId = id;
    currentDeleteType = type;
    
    const message = type === 'task' 
        ? 'Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.'
        : 'Tem certeza que deseja excluir este usuário? Todas as tarefas atribuídas a ele serão removidas.';
    
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-modal').classList.add('active');
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
    currentDeleteId = null;
    currentDeleteType = null;
}

async function confirmDelete() {
    if (!currentDeleteId || !currentDeleteType) return;

    try {
        const url = currentDeleteType === 'task' 
            ? `/api/tasks/${currentDeleteId}`
            : `/api/users/${currentDeleteId}`;
        
        const response = await fetch(url, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            showToast('Item excluído com sucesso!', 'success');
            closeConfirmModal();
            
            if (currentDeleteType === 'task') {
                loadTasks();
                if (document.getElementById('tab-all-tasks').classList.contains('active')) {
                    loadAllTasks();
                }
            } else {
                loadUsers();
            }
        } else {
            const data = await response.json();
            showToast(data.error || 'Erro ao excluir', 'error');
        }
    } catch (error) {
        showToast('Erro de conexão', 'error');
    }
}

// Permissões
function canEditTask(task) {
    if (currentUser.role === 'manager') return true;
    if (task.createdBy === currentUser.id) return true;
    if (task.assignedTo === currentUser.id) return true; // Pode editar apenas status, mas o botão abre o modal
    return false;
}

function canDeleteTask(task) {
    if (currentUser.role === 'manager') return true;
    if (task.createdBy === currentUser.id) return true;
    return false;
}

function canChangeStatus(task) {
    if (currentUser.role === 'manager') return true;
    if (task.assignedTo === currentUser.id) return true;
    if (task.createdBy === currentUser.id) return true;
    return false;
}

// Utilitários
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

function isOverdue(dateString) {
    if (!dateString) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(dateString);
    return due < today;
}

function getStatusLabel(status) {
    const labels = {
        'pending': 'Pendente',
        'in_progress': 'Em Andamento',
        'completed': 'Concluída'
    };
    return labels[status] || status;
}

function getPriorityLabel(priority) {
    const labels = {
        'low': 'Baixa',
        'medium': 'Média',
        'high': 'Alta'
    };
    return labels[priority] || priority;
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    
    toast.innerHTML = `
        <span>${icon}</span>
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Tornar funções globais para uso em onclick
window.openTaskModal = openTaskModal;
window.closeTaskModal = closeTaskModal;
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.openConfirmModal = openConfirmModal;
window.closeConfirmModal = closeConfirmModal;
window.updateTaskStatus = updateTaskStatus;
window.loadTasks = loadTasks;
window.loadAllTasks = loadAllTasks;
