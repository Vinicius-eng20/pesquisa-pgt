// Estado da Aplicação
let currentUser = null;
let teamMembers = [];
let allTasks = [];
let isEditing = false;

// Elementos da UI
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const authError = document.getElementById('auth-error');
const authErrorMsg = document.getElementById('auth-error-msg');

const formLogin = document.getElementById('form-login');
const formRegister = document.getElementById('form-register');
const tabBtnLogin = document.getElementById('tab-btn-login');
const tabBtnRegister = document.getElementById('tab-btn-register');

const btnLogout = document.getElementById('btn-logout');
const userDisplayName = document.getElementById('user-display-name');
const userDisplayEmail = document.getElementById('user-display-email');
const roleBadge = document.getElementById('role-badge');
const welcomeMessage = document.getElementById('welcome-message');
const welcomeSubmessage = document.getElementById('welcome-submessage');

const tasksContainer = document.getElementById('tasks-container');
const emptyState = document.getElementById('empty-state');

// Filtros
const filterSearch = document.getElementById('filter-search');
const filterStatus = document.getElementById('filter-status');
const filterPriority = document.getElementById('filter-priority');
const filterMember = document.getElementById('filter-member');

// Modal
const taskModal = document.getElementById('task-modal');
const taskForm = document.getElementById('task-form');
const modalTitle = document.getElementById('modal-title');
const btnOpenCreateModal = document.getElementById('btn-open-create-modal');
const btnCreateTaskLabel = document.getElementById('btn-create-task-label');
const taskIdInput = document.getElementById('task-id');
const taskTitleInput = document.getElementById('task-title-input');
const taskDescInput = document.getElementById('task-desc-input');
const taskPriorityInput = document.getElementById('task-priority-input');
const taskDueDateInput = document.getElementById('task-due-date-input');
const taskAssigneeInput = document.getElementById('task-assignee-input');
const assigneeContainer = document.getElementById('assignee-container');
const statusEditContainer = document.getElementById('status-edit-container');
const taskStatusInput = document.getElementById('task-status-input');

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
  verificarSessao();
  configurarEventos();
});

// Preenchimento rápido para demonstração
function preencherLogin(email, senha) {
  document.getElementById('login-email').value = email;
  document.getElementById('login-password').value = senha;
}

// Configurar ouvintes de eventos
function configurarEventos() {
  // Troca de abas Login / Cadastro
  tabBtnLogin.addEventListener('click', () => alternarAba('login'));
  tabBtnRegister.addEventListener('click', () => alternarAba('register'));

  // Formulários de Auth
  formLogin.addEventListener('submit', tratarLogin);
  formRegister.addEventListener('submit', tratarRegistro);
  btnLogout.addEventListener('click', tratarLogout);

  // Botão Criar Tarefa
  btnOpenCreateModal.addEventListener('click', abrirModalCriacao);

  // Formulário de Tarefa (Criar/Editar)
  taskForm.addEventListener('submit', salvarTarefa);

  // Filtros em tempo real
  filterSearch.addEventListener('input', renderizarTarefas);
  filterStatus.addEventListener('change', renderizarTarefas);
  filterPriority.addEventListener('change', renderizarTarefas);
  filterMember.addEventListener('change', renderizarTarefas);
}

// Alternar entre Login e Cadastro
function alternarAba(aba) {
  authError.classList.add('hidden');
  if (aba === 'login') {
    tabBtnLogin.className = 'flex-1 py-3 text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600 bg-white transition';
    tabBtnRegister.className = 'flex-1 py-3 text-sm font-semibold text-slate-500 hover:text-slate-800 bg-slate-50 transition';
    formLogin.classList.remove('hidden');
    formRegister.classList.add('hidden');
  } else {
    tabBtnRegister.className = 'flex-1 py-3 text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600 bg-white transition';
    tabBtnLogin.className = 'flex-1 py-3 text-sm font-semibold text-slate-500 hover:text-slate-800 bg-slate-50 transition';
    formRegister.classList.remove('hidden');
    formLogin.classList.add('hidden');
  }
}

// Mensagens de erro de login
function mostrarErroAuth(msg) {
  authErrorMsg.textContent = msg;
  authError.classList.remove('hidden');
}

// --- REQUISIÇÕES DE AUTENTICAÇÃO ---

async function verificarSessao() {
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (data.loggedIn && data.user) {
      currentUser = data.user;
      iniciarAplicacao();
    } else {
      mostrarTelaAuth();
    }
  } catch (err) {
    mostrarTelaAuth();
  }
}

async function tratarLogin(e) {
  e.preventDefault();
  authError.classList.add('hidden');

  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      mostrarErroAuth(data.error || 'Erro ao realizar login.');
      return;
    }

    currentUser = data.user;
    iniciarAplicacao();
  } catch (err) {
    mostrarErroAuth('Não foi possível conectar ao servidor.');
  }
}

async function tratarRegistro(e) {
  e.preventDefault();
  authError.classList.add('hidden');

  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const password = document.getElementById('reg-password').value;
  const role = document.getElementById('reg-role').value;

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });
    const data = await res.json();

    if (!res.ok) {
      mostrarErroAuth(data.error || 'Erro ao criar conta.');
      return;
    }

    currentUser = data.user;
    iniciarAplicacao();
  } catch (err) {
    mostrarErroAuth('Erro ao conectar ao servidor.');
  }
}

async function tratarLogout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } finally {
    currentUser = null;
    mostrarTelaAuth();
  }
}

function mostrarTelaAuth() {
  authContainer.classList.remove('hidden');
  appContainer.classList.add('hidden');
  formLogin.reset();
  formRegister.reset();
}

// --- CARREGAMENTO DO PAINEL ---

async function iniciarAplicacao() {
  authContainer.classList.add('hidden');
  appContainer.classList.remove('hidden');

  // Atualiza cabeçalho
  userDisplayName.textContent = currentUser.name;
  userDisplayEmail.textContent = currentUser.email;

  const isManager = currentUser.role === 'gerente';

  if (isManager) {
    roleBadge.textContent = '👑 Gerente da Equipe';
    roleBadge.className = 'inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200';
    welcomeMessage.textContent = 'Gestão Geral de Tarefas';
    welcomeSubmessage.textContent = 'Distribua, acompanhe e gerencie as atividades de toda a equipe.';
    btnCreateTaskLabel.textContent = 'Nova Tarefa para a Equipe';
    filterMember.classList.remove('hidden');
    assigneeContainer.classList.remove('hidden');
  } else {
    roleBadge.textContent = '👤 Membro da Equipe';
    roleBadge.className = 'inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200';
    welcomeMessage.textContent = `Olá, ${currentUser.name}`;
    welcomeSubmessage.textContent = 'Aqui estão as tarefas atribuídas a você.';
    btnCreateTaskLabel.textContent = 'Nova Tarefa para Mim';
    filterMember.classList.add('hidden');
    assigneeContainer.classList.add('hidden');
  }

  await carregarMembros();
  await carregarTarefas();
}

async function carregarMembros() {
  try {
    const res = await fetch('/api/users');
    if (res.ok) {
      teamMembers = await res.json();
      popularSelectsMembros();
    }
  } catch (err) {
    console.error('Erro ao buscar membros', err);
  }
}

function popularSelectsMembros() {
  // Popular select do modal
  taskAssigneeInput.innerHTML = '';
  teamMembers.forEach(user => {
    const opt = document.createElement('option');
    opt.value = user.id;
    opt.textContent = `${user.name} (${user.role === 'gerente' ? 'Gerente' : 'Membro'})`;
    taskAssigneeInput.appendChild(opt);
  });

  // Popular select de filtro (somente se gerente)
  filterMember.innerHTML = '<option value="todos">Todos os Membros</option>';
  teamMembers.forEach(user => {
    const opt = document.createElement('option');
    opt.value = user.id;
    opt.textContent = user.name;
    filterMember.appendChild(opt);
  });
}

async function carregarTarefas() {
  try {
    const res = await fetch('/api/tasks');
    if (res.ok) {
      allTasks = await res.json();
      atualizarEstatisticas();
      renderizarTarefas();
    }
  } catch (err) {
    console.error('Erro ao buscar tarefas', err);
  }
}

// Atualizar cards de estatísticas
function atualizarEstatisticas() {
  const total = allTasks.length;
  const pending = allTasks.filter(t => t.status === 'pendente').length;
  const progress = allTasks.filter(t => t.status === 'em_andamento').length;
  const completed = allTasks.filter(t => t.status === 'concluida').length;

  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-pending').textContent = pending;
  document.getElementById('stat-progress').textContent = progress;
  document.getElementById('stat-completed').textContent = completed;
}

// Renderizar lista filtrada
function renderizarTarefas() {
  const busca = filterSearch.value.toLowerCase().trim();
  const filtroStatus = filterStatus.value;
  const filtroPrioridade = filterPriority.value;
  const filtroMembro = filterMember.value;

  const tarefasFiltradas = allTasks.filter(t => {
    // Filtro texto
    const matchTexto = (t.title && t.title.toLowerCase().includes(busca)) ||
                       (t.description && t.description.toLowerCase().includes(busca));
    if (!matchTexto) return false;

    // Filtro status
    if (filtroStatus !== 'todos' && t.status !== filtroStatus) return false;

    // Filtro prioridade
    if (filtroPrioridade !== 'todas' && t.priority !== filtroPrioridade) return false;

    // Filtro membro (gerente)
    if (currentUser.role === 'gerente' && filtroMembro !== 'todos') {
      if (t.assigned_to != filtroMembro) return false;
    }

    return true;
  });

  tasksContainer.innerHTML = '';

  if (tarefasFiltradas.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  tarefasFiltradas.forEach(tarefa => {
    const card = criarCardTarefa(tarefa);
    tasksContainer.appendChild(card);
  });
}

// Gerar HTML de cada cartão de tarefa
function criarCardTarefa(t) {
  const card = document.createElement('div');
  card.className = 'card-task bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between';

  // Badges de Status
  const statusInfo = {
    pendente: { label: 'Pendente', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: 'fa-regular fa-clock' },
    em_andamento: { label: 'Em Andamento', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: 'fa-solid fa-spinner fa-spin' },
    concluida: { label: 'Concluída', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: 'fa-regular fa-circle-check' }
  }[t.status] || { label: t.status, bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', icon: 'fa-regular fa-circle' };

  // Badges de Prioridade
  const priorityInfo = {
    alta: { label: 'Alta', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    media: { label: 'Média', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    baixa: { label: 'Baixa', bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' }
  }[t.priority] || { label: t.priority, bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };

  // Data Formatada
  let dataFormatada = 'Sem prazo';
  if (t.due_date) {
    const [ano, mes, dia] = t.due_date.split('-');
    if (ano && mes && dia) {
      dataFormatada = `${dia}/${mes}/${ano}`;
    }
  }

  const isManager = currentUser.role === 'gerente';

  card.innerHTML = `
    <div>
      <!-- Cabeçalho do Card: Prioridade e Ações de Gerente -->
      <div class="flex items-center justify-between mb-3">
        <span class="text-[11px] font-semibold px-2 py-0.5 rounded-md border ${priorityInfo.bg} ${priorityInfo.text} ${priorityInfo.border}">
          Prioridade ${priorityInfo.label}
        </span>

        ${isManager ? `
          <div class="flex items-center gap-1">
            <button onclick="abrirModalEdicao(${t.id})" class="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition" title="Editar Tarefa">
              <i class="fa-regular fa-pen-to-square text-sm"></i>
            </button>
            <button onclick="excluirTarefa(${t.id})" class="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition" title="Excluir Tarefa">
              <i class="fa-regular fa-trash-can text-sm"></i>
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Título -->
      <h4 class="font-bold text-slate-900 text-base mb-1.5 leading-snug ${t.status === 'concluida' ? 'line-through text-slate-400' : ''}">
        ${escapeHtml(t.title)}
      </h4>

      <!-- Descrição -->
      <p class="text-xs text-slate-500 mb-4 whitespace-pre-line line-clamp-3">
        ${escapeHtml(t.description || 'Nenhum detalhe adicional informado.')}
      </p>
    </div>

    <!-- Rodapé do Card -->
    <div class="pt-3 border-t border-slate-100 space-y-3">
      
      <!-- Detalhes de Responsável e Data -->
      <div class="flex items-center justify-between text-xs text-slate-500">
        <div class="flex items-center gap-1.5" title="Responsável">
          <i class="fa-regular fa-user text-indigo-500"></i>
          <span class="font-medium text-slate-700">${escapeHtml(t.assigned_to_name || 'Desconhecido')}</span>
        </div>
        <div class="flex items-center gap-1.5" title="Prazo">
          <i class="fa-regular fa-calendar text-slate-400"></i>
          <span>${dataFormatada}</span>
        </div>
      </div>

      <!-- Seletor de Situação (Acesso para quem foi atribuída a tarefa ou para o Gerente) -->
      <div class="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
        <span class="text-xs font-medium text-slate-600 flex items-center gap-1.5">
          <i class="${statusInfo.icon} ${statusInfo.text}"></i>
          <span>Situação:</span>
        </span>

        <select onchange="alterarStatusTarefa(${t.id}, this.value)" class="text-xs font-semibold px-2 py-1 rounded-lg border bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer ${statusInfo.border} ${statusInfo.text}">
          <option value="pendente" ${t.status === 'pendente' ? 'selected' : ''}>Pendente</option>
          <option value="em_andamento" ${t.status === 'em_andamento' ? 'selected' : ''}>Em Andamento</option>
          <option value="concluida" ${t.status === 'concluida' ? 'selected' : ''}>Concluída</option>
        </select>
      </div>
    </div>
  `;

  return card;
}

// --- CONTROLE DO MODAL DE CRIAÇÃO E EDIÇÃO ---

function abrirModalCriacao() {
  isEditing = false;
  taskForm.reset();
  taskIdInput.value = '';
  modalTitle.textContent = currentUser.role === 'gerente' ? 'Criar Nova Tarefa' : 'Criar Tarefa para Mim';
  statusEditContainer.classList.add('hidden');

  // Se for membro, o responsável padrão é ele mesmo
  if (currentUser.role === 'membro') {
    taskAssigneeInput.value = currentUser.id;
  }

  taskModal.classList.remove('hidden');
}

function abrirModalEdicao(id) {
  const task = allTasks.find(t => t.id === id);
  if (!task) return;

  isEditing = true;
  taskIdInput.value = task.id;
  taskTitleInput.value = task.title;
  taskDescInput.value = task.description || '';
  taskPriorityInput.value = task.priority;
  taskDueDateInput.value = task.due_date || '';
  taskAssigneeInput.value = task.assigned_to;
  taskStatusInput.value = task.status;

  modalTitle.textContent = 'Editar Tarefa';
  statusEditContainer.classList.remove('hidden');
  taskModal.classList.remove('hidden');
}

function fecharModalTarefa() {
  taskModal.classList.add('hidden');
  taskForm.reset();
}

// Salvar Tarefa (Criar ou Atualizar)
async function salvarTarefa(e) {
  e.preventDefault();

  const title = taskTitleInput.value.trim();
  const description = taskDescInput.value.trim();
  const priority = taskPriorityInput.value;
  const due_date = taskDueDateInput.value;
  const assigned_to = taskAssigneeInput.value;
  const status = taskStatusInput.value;

  if (!title) return;

  try {
    if (isEditing) {
      // Atualização via PUT (Gerente)
      const id = taskIdInput.value;
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, priority, due_date, assigned_to, status })
      });
      if (!res.ok) throw new Error();
    } else {
      // Criação via POST
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, priority, due_date, assigned_to })
      });
      if (!res.ok) throw new Error();
    }

    fecharModalTarefa();
    await carregarTarefas();
  } catch (err) {
    alert('Erro ao salvar a tarefa. Tente novamente.');
  }
}

// Alterar Status
async function alterarStatusTarefa(id, novoStatus) {
  try {
    const res = await fetch(`/api/tasks/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus })
    });

    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Erro ao atualizar situação.');
      await carregarTarefas();
      return;
    }

    await carregarTarefas();
  } catch (err) {
    alert('Não foi possível atualizar a tarefa.');
    await carregarTarefas();
  }
}

// Excluir Tarefa
async function excluirTarefa(id) {
  if (!confirm('Tem certeza de que deseja remover esta tarefa definitivamente?')) {
    return;
  }

  try {
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json();
      alert(data.error || 'Erro ao excluir tarefa.');
      return;
    }
    await carregarTarefas();
  } catch (err) {
    alert('Erro ao excluir tarefa.');
  }
}

// Função utilitária para evitar injeção de HTML
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
