let currentUser = null;
let members = [];
let tasks = [];
let authMode = 'login';
let editingId = null;

const STATUS_LABELS = {
  'pendente': 'Pendente',
  'em_andamento': 'Em andamento',
  'concluida': 'Concluída'
};

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro');
  return data;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderAuth(error) {
  const app = document.getElementById('app');
  const isLogin = authMode === 'login';
  app.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <h1>Gestão de Tarefas da Equipe</h1>
        <p class="sub">${isLogin ? 'Entre com sua conta' : 'Crie sua conta. O primeiro usuário será o gerente.'}</p>
        ${error ? `<div class="error">${escapeHtml(error)}</div>` : ''}
        <form id="authForm">
          ${!isLogin ? '<input name="name" placeholder="Seu nome" required>' : ''}
          <input name="username" placeholder="Usuário" required autocomplete="username">
          <input name="password" type="password" placeholder="Senha" required autocomplete="${isLogin ? 'current-password' : 'new-password'}">
          <button type="submit" class="btn-primary">${isLogin ? 'Entrar' : 'Criar conta'}</button>
        </form>
        <div class="toggle-auth" id="toggleAuth">
          ${isLogin ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar'}
        </div>
      </div>
    </div>
  `;
  document.getElementById('toggleAuth').onclick = () => {
    authMode = isLogin ? 'register' : 'login';
    renderAuth();
  };
  document.getElementById('authForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      await api('/api/' + (isLogin ? 'login' : 'register'), {
        method: 'POST',
        body: JSON.stringify(body)
      });
      await loadApp();
    } catch (err) {
      renderAuth(err.message);
    }
  };
}

async function loadApp() {
  try {
    currentUser = await api('/api/me');
  } catch {
    renderAuth();
    return;
  }
  const promises = [api('/api/tasks')];
  if (currentUser.role === 'gerente') promises.push(api('/api/members'));
  const results = await Promise.all(promises);
  tasks = results[0];
  members = results[1] || [];
  renderMain();
}

function renderMain() {
  const app = document.getElementById('app');
  const isManager = currentUser.role === 'gerente';
  app.innerHTML = `
    <header>
      <h1>Gestão de Tarefas</h1>
      <div class="user-info">
        <span>${escapeHtml(currentUser.name)}</span>
        <span class="badge-role">${isManager ? 'Gerente' : 'Membro'}</span>
        <button class="btn-ghost btn-small" id="logoutBtn">Sair</button>
      </div>
    </header>
    <div class="container">
      <div class="new-task-card">
        <h2>${editingId ? 'Editar tarefa' : 'Nova tarefa'}</h2>
        <form id="taskForm">
          <input name="title" placeholder="Título da tarefa" required value="${editingId ? escapeHtml((tasks.find(t => t.id === editingId) || {}).title || '') : ''}">
          <textarea name="description" placeholder="Descrição (opcional)">${editingId ? escapeHtml((tasks.find(t => t.id === editingId) || {}).description || '') : ''}</textarea>
          ${isManager ? `
            <div class="row">
              <select name="assigned_to">
                ${members.map(m => {
                  const cur = editingId ? (tasks.find(t => t.id === editingId) || {}).assigned_to : null;
                  return `<option value="${m.id}" ${cur === m.id ? 'selected' : ''}>${escapeHtml(m.name)}</option>`;
                }).join('')}
              </select>
              <select name="status">
                ${Object.entries(STATUS_LABELS).map(([k, v]) => {
                  const cur = editingId ? (tasks.find(t => t.id === editingId) || {}).status : 'pendente';
                  return `<option value="${k}" ${cur === k ? 'selected' : ''}>${v}</option>`;
                }).join('')}
              </select>
            </div>
          ` : ''}
          <div class="row">
            <button type="submit" class="btn-primary">${editingId ? 'Salvar alterações' : 'Criar tarefa'}</button>
            ${editingId ? '<button type="button" class="btn-ghost" id="cancelEdit">Cancelar</button>' : ''}
          </div>
        </form>
      </div>
      <h2 style="font-size:16px;margin-bottom:16px;">${isManager ? 'Todas as tarefas' : 'Minhas tarefas'}</h2>
      <div class="tasks-grid" id="tasksGrid"></div>
    </div>
  `;

  document.getElementById('logoutBtn').onclick = async () => {
    await api('/api/logout', { method: 'POST' });
    currentUser = null;
    renderAuth();
  };

  document.getElementById('taskForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      if (editingId) {
        await api('/api/tasks/' + editingId, { method: 'PUT', body: JSON.stringify(body) });
        editingId = null;
      } else {
        await api('/api/tasks', { method: 'POST', body: JSON.stringify(body) });
      }
      await loadApp();
    } catch (err) {
      alert(err.message);
    }
  };

  const cancelBtn = document.getElementById('cancelEdit');
  if (cancelBtn) cancelBtn.onclick = () => { editingId = null; renderMain(); };

  renderTasks();
}

function renderTasks() {
  const grid = document.getElementById('tasksGrid');
  const isManager = currentUser.role === 'gerente';
  if (!tasks.length) {
    grid.innerHTML = '<div class="empty">Nenhuma tarefa por aqui ainda.</div>';
    return;
  }
  grid.innerHTML = tasks.map(t => {
    const canEditFull = isManager;
    const canChangeStatus = isManager || t.assigned_to === currentUser.id;
    return `
      <div class="task-card status-${t.status}">
        <h3>${escapeHtml(t.title)}</h3>
        ${t.description ? `<div class="desc">${escapeHtml(t.description)}</div>` : ''}
        <div class="meta">Responsável: ${escapeHtml(t.assigned_name)}</div>
        <div class="actions">
          ${canChangeStatus ? `
            <select class="status-select" data-id="${t.id}">
              ${Object.entries(STATUS_LABELS).map(([k, v]) =>
                `<option value="${k}" ${t.status === k ? 'selected' : ''}>${v}</option>`
              ).join('')}
            </select>` : `<span class="badge-role">${STATUS_LABELS[t.status]}</span>`}
          ${canEditFull ? `
            <button class="btn-edit btn-small" data-edit="${t.id}">Editar</button>
            <button class="btn-danger btn-small" data-del="${t.id}">Remover</button>` : ''}
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.status-select').forEach(sel => {
    sel.onchange = async () => {
      try {
        await api('/api/tasks/' + sel.dataset.id, {
          method: 'PUT',
          body: JSON.stringify({ status: sel.value })
        });
        await loadApp();
      } catch (err) { alert(err.message); }
    };
  });

  grid.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = () => {
      editingId = parseInt(btn.dataset.edit, 10);
      renderMain();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
  });

  grid.querySelectorAll('[data-del]').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Remover esta tarefa?')) return;
      try {
        await api('/api/tasks/' + btn.dataset.del, { method: 'DELETE' });
        await loadApp();
      } catch (err) { alert(err.message); }
    };
  });
}

loadApp();
