// ESTADO GLOBAL DO APLICATIVO
let currentUser = null;
let token = localStorage.getItem('token') || null;
let systemCategories = [];

// Inicialização ao carregar a página
document.addEventListener('DOMContentLoaded', () => {
  // Configurar input de mês atual como padrão (YYYY-MM)
  const today = new Date();
  const currentMonthStr = today.toISOString().slice(0, 7);
  document.getElementById('filter-month').value = currentMonthStr;

  // Configurar input de data padrão do modal para hoje
  document.getElementById('exp-date').value = today.toISOString().slice(0, 10);

  // Se já houver token salvo, verificar sessão
  if (token) {
    checkCurrentUser();
  } else {
    showAuthScreen();
  }
});

// --- SISTEMA DE NOTIFICAÇÕES (TOAST) ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Formatar valor para moeda brasileira (R$)
function formatBRL(amount) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(amount || 0);
}

// Formatar data YYYY-MM-DD para DD/MM/AAAA
function formatDateBR(dateString) {
  if (!dateString) return '-';
  const parts = dateString.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateString;
}

// --- GERENCIAMENTO DE TELAS E TABS ---
function switchAuthTab(tab) {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const loginBtn = document.getElementById('tab-login-btn');
  const registerBtn = document.getElementById('tab-register-btn');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginBtn.classList.add('active');
    registerBtn.classList.remove('active');
  } else {
    loginForm.classList.add('hidden');
    registerForm.classList.remove('hidden');
    loginBtn.classList.remove('active');
    registerBtn.classList.add('active');
  }
}

function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('app-screen').classList.add('hidden');
}

function showAppScreen() {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('app-screen').classList.remove('hidden');

  // Atualizar visual do usuário logado
  document.getElementById('user-display-name').innerText = `Olá, ${currentUser.name}`;

  const roleBadge = document.getElementById('user-role-badge');
  const adminElements = document.querySelectorAll('.admin-only');

  if (currentUser.role === 'admin') {
    roleBadge.classList.remove('hidden');
    adminElements.forEach(el => el.classList.remove('hidden'));
  } else {
    roleBadge.classList.add('hidden');
    adminElements.forEach(el => el.classList.add('hidden'));
  }

  // Carregar dados iniciais
  loadCategories().then(() => {
    loadUserExpenses();
  });
}

function switchSection(sectionId) {
  const sections = ['user', 'admin-stats', 'admin-categories', 'admin-users'];
  sections.forEach(s => {
    const secEl = document.getElementById(`section-${s}`);
    const navEl = document.getElementById(`nav-btn-${s}`);
    if (secEl) secEl.classList.add('hidden');
    if (navEl) navEl.classList.remove('active');
  });

  const activeSec = document.getElementById(`section-${sectionId}`);
  const activeNav = document.getElementById(`nav-btn-${sectionId}`);
  if (activeSec) activeSec.classList.remove('hidden');
  if (activeNav) activeNav.classList.add('active');

  // Ações de carregamento de cada tela
  if (sectionId === 'user') {
    loadUserExpenses();
  } else if (sectionId === 'admin-stats') {
    loadAdminStats();
  } else if (sectionId === 'admin-categories') {
    renderCategoriesTable();
  } else if (sectionId === 'admin-users') {
    loadAdminUsers();
  }
}

// --- FUNÇÃO AUXILIAR FETCH COM AUTH ---
async function apiFetch(url, options = {}) {
  const headers = options.headers || {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  options.headers = headers;
  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      if (data.error && data.error.includes('desativada')) {
        showToast(data.error, 'error');
        handleLogout();
        return null;
      }
    }
    throw new Error(data.error || 'Erro na requisição');
  }

  return data;
}

// --- AUTENTICAÇÃO ---
async function checkCurrentUser() {
  try {
    const data = await apiFetch('/api/auth/me');
    if (data && data.user) {
      currentUser = data.user;
      showAppScreen();
    } else {
      handleLogout();
    }
  } catch (err) {
    handleLogout();
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;

  try {
    const data = await apiFetch('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    });

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    showToast(`Bem-vindo(a), ${currentUser.name}!`, 'success');
    showAppScreen();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('register-name').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;

  try {
    const data = await apiFetch('/api/auth/register', {
      method: 'POST',
      body: { name, email, password }
    });

    token = data.token;
    currentUser = data.user;
    localStorage.setItem('token', token);
    showToast('Conta criada com sucesso!', 'success');
    showAppScreen();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function handleLogout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('token');
  showAuthScreen();
  showToast('Você saiu do sistema.', 'info');
}

// --- CATEGORIAS ---
async function loadCategories() {
  try {
    systemCategories = await apiFetch('/api/categories');
    populateCategorySelects();
    renderCategoriesTable();
  } catch (err) {
    showToast('Erro ao carregar categorias.', 'error');
  }
}

function populateCategorySelects() {
  const filterSelect = document.getElementById('filter-category');
  const modalSelect = document.getElementById('exp-category');

  // Limpar mantendo padrão
  filterSelect.innerHTML = '<option value="">Todas as Categorias</option>';
  modalSelect.innerHTML = '<option value="">Selecione uma categoria...</option>';

  systemCategories.forEach(cat => {
    // Select de filtro
    const optFilter = document.createElement('option');
    optFilter.value = cat.id;
    optFilter.textContent = cat.name;
    filterSelect.appendChild(optFilter);

    // Select do modal
    const optModal = document.createElement('option');
    optModal.value = cat.id;
    optModal.textContent = cat.name;
    modalSelect.appendChild(optModal);
  });
}

function renderCategoriesTable() {
  const tbody = document.getElementById('categories-table-body');
  if (!tbody) return;

  if (systemCategories.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="text-center">Nenhuma categoria encontrada.</td></tr>';
    return;
  }

  tbody.innerHTML = systemCategories.map(cat => `
    <tr>
      <td>
        <span class="bar-color-dot" style="background-color: ${cat.color}; width: 14px; height: 14px;"></span>
      </td>
      <td><strong>${cat.name}</strong></td>
      <td class="text-right">
        <button class="btn-danger-sm" onclick="handleDeleteCategory(${cat.id})">Excluir</button>
      </td>
    </tr>
  `).join('');
}

async function handleCreateCategory(e) {
  e.preventDefault();
  const nameInput = document.getElementById('cat-name');
  const colorInput = document.getElementById('cat-color');

  try {
    await apiFetch('/api/categories', {
      method: 'POST',
      body: { name: nameInput.value, color: colorInput.value }
    });

    showToast('Categoria criada com sucesso!', 'success');
    nameInput.value = '';
    await loadCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteCategory(id) {
  if (!confirm('Tem certeza de que deseja excluir esta categoria?')) return;

  try {
    await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
    showToast('Categoria removida com sucesso!', 'success');
    await loadCategories();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- GASTOS PESSOAIS DO USUÁRIO ---
async function loadUserExpenses() {
  const month = document.getElementById('filter-month').value;
  const categoryId = document.getElementById('filter-category').value;
  const tbody = document.getElementById('expenses-table-body');

  tbody.innerHTML = '<tr><td colspan="5" class="text-center">Carregando despesas...</td></tr>';

  try {
    // Carregar despesas filtradas
    let url = `/api/expenses?month=${month}`;
    if (categoryId) url += `&categoryId=${categoryId}`;

    const expenses = await apiFetch(url);

    // Carregar resumo do mês
    const summary = await apiFetch(`/api/expenses/summary?month=${month}`);

    // Atualizar Card de Total do Mês
    document.getElementById('total-month-value').innerText = formatBRL(summary.totalMonthly);
    const [year, m] = month.split('-');
    const dateObj = new Date(year, m - 1, 1);
    const monthName = dateObj.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    document.getElementById('total-month-label').innerText = `Referência: ${monthName}`;

    // Renderizar Barras por Categoria no Mês
    renderCategoryBars(summary.byCategory, summary.totalMonthly);

    // Renderizar Tabela de Gastos
    if (expenses.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center">Nenhum gasto encontrado para este período.</td></tr>';
      return;
    }

    tbody.innerHTML = expenses.map(exp => `
      <tr>
        <td>${formatDateBR(exp.date)}</td>
        <td><strong>${exp.description}</strong></td>
        <td>
          <span class="category-tag" style="background-color: ${exp.category_color};">
            ${exp.category_name}
          </span>
        </td>
        <td class="amount-text">${formatBRL(exp.amount)}</td>
        <td class="text-right">
          <button class="btn-danger-sm" onclick="handleDeleteExpense(${exp.id})">Excluir</button>
        </td>
      </tr>
    `).join('');

  } catch (err) {
    showToast('Erro ao carregar despesas.', 'error');
  }
}

function renderCategoryBars(categories, totalMonth) {
  const container = document.getElementById('category-bars-list');
  if (!categories || categories.length === 0 || totalMonth <= 0) {
    container.innerHTML = '<p class="empty-text">Nenhum gasto registrado neste mês.</p>';
    return;
  }

  container.innerHTML = categories.map(cat => {
    const percent = Math.min(100, Math.round((cat.total / totalMonth) * 100));
    return `
      <div class="bar-item">
        <div class="bar-info">
          <span class="bar-name">
            <span class="bar-color-dot" style="background-color: ${cat.color};"></span>
            ${cat.name} (${cat.count}x)
          </span>
          <span><strong>${formatBRL(cat.total)}</strong> (${percent}%)</span>
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${percent}%; background-color: ${cat.color};"></div>
        </div>
      </div>
    `;
  }).join('');
}

// Modal de Despesas
function openExpenseModal() {
  document.getElementById('modal-expense').classList.remove('hidden');
  document.getElementById('exp-description').focus();
}

function closeExpenseModal() {
  document.getElementById('modal-expense').classList.add('hidden');
  document.getElementById('expense-form').reset();
  document.getElementById('exp-date').value = new Date().toISOString().slice(0, 10);
}

async function handleCreateExpense(e) {
  e.preventDefault();
  const description = document.getElementById('exp-description').value;
  const amount = document.getElementById('exp-amount').value;
  const category_id = document.getElementById('exp-category').value;
  const date = document.getElementById('exp-date').value;

  try {
    await apiFetch('/api/expenses', {
      method: 'POST',
      body: { description, amount, category_id, date }
    });

    showToast('Gasto salvo com sucesso!', 'success');
    closeExpenseModal();

    // Se o gasto foi em outro mês, atualizar o filtro para visualizá-lo
    const expenseMonth = date.slice(0, 7);
    document.getElementById('filter-month').value = expenseMonth;

    loadUserExpenses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleDeleteExpense(id) {
  if (!confirm('Deseja realmente apagar esta despesa?')) return;

  try {
    await apiFetch(`/api/expenses/${id}`, { method: 'DELETE' });
    showToast('Despesa apagada!', 'success');
    loadUserExpenses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// --- PAINEL DO ADMINISTRADOR ---
async function loadAdminStats() {
  try {
    const stats = await apiFetch('/api/admin/stats');
    document.getElementById('admin-total-spent').innerText = formatBRL(stats.totalGlobal);
    document.getElementById('admin-total-transactions').innerText = stats.totalTransactions;
    document.getElementById('admin-total-users').innerText = stats.totalUsers;
    document.getElementById('admin-active-users').innerText = `${stats.activeUsers} usuários ativos`;

    const catContainer = document.getElementById('admin-global-categories');
    if (!stats.categories || stats.categories.length === 0) {
      catContainer.innerHTML = '<p class="empty-text">Nenhum gasto cadastrado no sistema ainda.</p>';
      return;
    }

    catContainer.innerHTML = stats.categories.map(c => {
      const pct = stats.totalGlobal > 0 ? Math.round((c.total / stats.totalGlobal) * 100) : 0;
      return `
        <div class="bar-item">
          <div class="bar-info">
            <span class="bar-name">
              <span class="bar-color-dot" style="background-color: ${c.color};"></span>
              ${c.name}
            </span>
            <span><strong>${formatBRL(c.total)}</strong> (${pct}%)</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%; background-color: ${c.color};"></div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    showToast('Erro ao carregar estatísticas do admin.', 'error');
  }
}

async function loadAdminUsers() {
  const tbody = document.getElementById('admin-users-table-body');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center">Carregando usuários...</td></tr>';

  try {
    const users = await apiFetch('/api/admin/users');

    if (users.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center">Nenhum usuário comum registrado.</td></tr>';
      return;
    }

    tbody.innerHTML = users.map(u => {
      const isActive = u.status === 'active';
      const statusBadge = isActive
        ? '<span class="badge-status-active">Ativo</span>'
        : '<span class="badge-status-disabled">Desativado</span>';

      const actionBtn = isActive
        ? `<button class="btn-toggle-disable" onclick="toggleUserStatus(${u.id}, 'disabled')">Desativar Conta</button>`
        : `<button class="btn-toggle-active" onclick="toggleUserStatus(${u.id}, 'active')">Reativar Conta</button>`;

      return `
        <tr>
          <td><strong>${u.name}</strong></td>
          <td>${u.email}</td>
          <td>${statusBadge}</td>
          <td>${u.expense_count} despesa(s)</td>
          <td class="amount-text">${formatBRL(u.total_spent)}</td>
          <td class="text-right">${actionBtn}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    showToast('Erro ao carregar lista de usuários.', 'error');
  }
}

async function toggleUserStatus(userId, newStatus) {
  const actionText = newStatus === 'disabled' ? 'desativar' : 'reativar';
  if (!confirm(`Deseja realmente ${actionText} o acesso deste usuário?`)) return;

  try {
    await apiFetch(`/api/admin/users/${userId}/status`, {
      method: 'PATCH',
      body: { status: newStatus }
    });

    showToast(`Conta ${newStatus === 'disabled' ? 'desativada' : 'reativada'} com sucesso!`, 'success');
    loadAdminUsers();
  } catch (err) {
    showToast(err.message, 'error');
  }
}
