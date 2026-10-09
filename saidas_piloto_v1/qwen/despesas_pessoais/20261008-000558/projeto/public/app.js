(function () {
  'use strict';

  // ---------- estado ----------
  const state = {
    user: null,
    categories: [],
    expenses: [],
    filterMonth: '',
    filterCategory: '',
    view: 'me'
  };

  const $ = (id) => document.getElementById(id);

  // ---------- helpers de UI ----------
  const brl = (cents) =>
    (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  function monthLabel(ym) {
    const [y, m] = ym.split('-').map(Number);
    return `${MONTHS[m - 1]} de ${y}`;
  }
  function todayISO() { return new Date().toISOString().slice(0, 10); }
  function currentYM() { return todayISO().slice(0, 7); }

  function ymOf(dateStr) { return dateStr.slice(0, 7); }
  function dateLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
    return `${wd} ${String(d).padStart(2, '0')} de ${MONTHS[m - 1]}`;
  }

  let toastTimer;
  function toast(msg, ok = true) {
    const t = $('toast');
    t.textContent = msg;
    t.style.background = ok ? 'var(--ink)' : 'var(--red)';
    t.classList.remove('hidden');
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.classList.add('hidden'), 300);
    }, 2600);
  }

  // ---------- api ----------
  async function api(path, opts = {}) {
    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: opts.body ? JSON.stringify(opts.body) : undefined
    });
    let data = {};
    try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || ('Erro ' + res.status));
    return data;
  }

  // ---------- telas ----------
  function showAuth() {
    $('auth-screen').classList.remove('hidden');
    $('app').classList.add('hidden');
    setAuthMode('login');
  }
  function showApp() {
    $('auth-screen').classList.add('hidden');
    $('app').classList.remove('hidden');
    $('user-name').textContent = state.user.username;
    $('admin-badge').classList.toggle('hidden', !state.user.is_admin);
    $('tab-admin').classList.toggle('hidden', !state.user.is_admin);
    switchView(state.user.is_admin ? state.view : 'me');
  }

  function setAuthMode(mode) {
    const login = mode === 'login';
    $('tab-login').classList.toggle('active', login);
    $('tab-register').classList.toggle('active', !login);
    $('auth-submit').textContent = login ? 'Entrar' : 'Criar conta';
    $('email-field').classList.toggle('hidden', login);
    $('auth-message').classList.add('hidden');
    $('auth-password').setAttribute('autocomplete', login ? 'current-password' : 'new-password');
  }

  // ---------- login / registro ----------
  $('tab-login').addEventListener('click', () => setAuthMode('login'));
  $('tab-register').addEventListener('click', () => setAuthMode('register'));

  $('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const register = $('tab-register').classList.contains('active');
    const payload = {
      username: $('auth-username').value.trim(),
      password: $('auth-password').value
    };
    if (register) payload.email = $('auth-email').value.trim();
    const msg = $('auth-message');
    msg.classList.add('hidden');
    try {
      const data = await api(register ? '/api/register' : '/api/login', { method: 'POST', body: payload });
      state.user = data.user;
      toast(register ? 'Conta criada! Bem-vindo(a) 🎉' : 'Bem-vindo(a) de volta');
      await boot();
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.remove('hidden');
    }
  });

  $('logout-btn').addEventListener('click', async () => {
    try { await api('/api/logout', { method: 'POST' }); } catch {}
    state.user = null;
    state.expenses = [];
    state.categories = [];
    showAuth();
  });

  // ---------- navegação ----------
  $('tab-me').addEventListener('click', () => switchView('me'));
  $('tab-admin').addEventListener('click', () => switchView('admin'));
  function switchView(v) {
    if (v === 'admin' && !state.user.is_admin) v = 'me';
    state.view = v;
    $('tab-me').classList.toggle('active', v === 'me');
    $('tab-admin').classList.toggle('active', v === 'admin');
    $('view-me').classList.toggle('hidden', v !== 'me');
    $('view-admin').classList.toggle('hidden', v !== 'admin');
    if (v === 'admin') loadAdmin();
  }

  // ---------- categorias ----------
  function populateCategorySelects() {
    const sel = $('exp-category');
    sel.innerHTML = '<option value="">Escolha…</option>';
    state.categories.forEach(c => {
      const o = document.createElement('option');
      o.value = c.id; o.textContent = c.name;
      sel.appendChild(o);
    });
    const fsel = $('filter-category');
    const prev = fsel.value;
    fsel.innerHTML = '<option value="">Todas as categorias</option>';
    const names = {};
    state.expenses.forEach(e => { if (e.category) names[e.category.name] = 1; });
    Object.keys(names).sort().forEach(n => {
      const o = document.createElement('option'); o.value = n; o.textContent = n; fsel.appendChild(o);
    });
    if ([...fsel.options].some(o => o.value === prev)) fsel.value = prev;
  }

  function populateMonthSelect() {
    const sel = $('filter-month');
    const all = new Set();
    state.expenses.forEach(e => all.add(ymOf(e.spent_on)));
    all.add(currentYM());
    const yms = [...all].sort().reverse();
    const prev = sel.value;
    sel.innerHTML = '';
    const allOpt = document.createElement('option');
    allOpt.value = ''; allOpt.textContent = 'Todos os meses';
    sel.appendChild(allOpt);
    yms.forEach(ym => {
      const o = document.createElement('option'); o.value = ym; o.textContent = monthLabel(ym); sel.appendChild(o);
    });
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
  }

  // ---------- render: meus gastos ----------
  function statMonth() {
    const ym = currentYM();
    const sum = state.expenses.filter(e => ymOf(e.spent_on) === ym).reduce((s, e) => s + e.amount_cents, 0);
    return sum;
  }
  function renderMe() {
    $('me-month-label').textContent = monthLabel(currentYM());
    $('stat-month').textContent = brl(statMonth());
    $('stat-month-hint').textContent = 'só este mês';
    const total = state.expenses.reduce((s, e) => s + e.amount_cents, 0);
    $('stat-total').textContent = brl(total);
    $('stat-total-hint').textContent = 'desde o início';
    $('stat-count').textContent = state.expenses.length;

    populateMonthSelect();
    populateCategorySelects();
    renderList();
  }

  function filteredExpenses() {
    return state.expenses.filter(e => {
      if (state.filterMonth && ymOf(e.spent_on) !== state.filterMonth) return false;
      if (state.filterCategory && e.category.name !== state.filterCategory) return false;
      return true;
    });
  }

  function renderList() {
    const list = filteredExpenses();
    const groups = $('expense-groups');
    groups.innerHTML = '';
    const noData = $('no-data');
    if (!list.length) {
      noData.classList.remove('hidden');
      return;
    }
    noData.classList.add('hidden');

    const byDate = {};
    list.forEach(e => {
      (byDate[e.spent_on] = byDate[e.spent_on] || []).push(e);
    });
    const dates = Object.keys(byDate).sort((a, b) => (a < b ? 1 : -1));
    dates.forEach(date => {
      const items = byDate[date];
      const total = items.reduce((s, e) => s + e.amount_cents, 0);
      const g = document.createElement('div');
      g.className = 'expense-group';

      const head = document.createElement('div');
      head.className = 'group-head';
      const dl = document.createElement('div');
      dl.innerHTML = `<span class="group-date">${dateLabel(date)}</span>`;
      const gt = document.createElement('span');
      gt.className = 'group-total'; gt.textContent = brl(total);
      head.appendChild(dl); head.appendChild(gt);
      g.appendChild(head);

      items.forEach(e => {
        const row = document.createElement('div');
        row.className = 'expense-item';
        const chip = document.createElement('span');
        chip.className = 'cat-chip';
        chip.innerHTML =
          `<span class="cat-dot" style="background:${e.category.color}"></span>` +
          `<span class="exp-desc">${escapeHtml(e.description)}</span>` +
          `<span class="exp-cat-name">${escapeHtml(e.category.name)}</span>`;
        const amt = document.createElement('span');
        amt.className = 'exp-amount'; amt.textContent = brl(e.amount_cents);
        const del = document.createElement('button');
        del.className = 'exp-del'; del.type = 'button'; del.title = 'Excluir'; del.textContent = '✕';
        del.addEventListener('click', () => deleteExpense(e.id));
        row.appendChild(chip); row.appendChild(amt); row.appendChild(del);
        g.appendChild(row);
      });
      groups.appendChild(g);
    });
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- adicionar / excluir gasto ----------
  $('exp-date').value = todayISO();
  $('expense-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('expense-message'); msg.textContent = '';
    const btn = e.target.querySelector('button[type=submit]');
    const original = btn.textContent; btn.disabled = true; btn.textContent = 'Salvando…';
    try {
      const payload = {
        description: $('exp-desc').value.trim(),
        amount: $('exp-amount').value.trim(),
        category_id: $('exp-category').value,
        spent_on: $('exp-date').value
      };
      const data = await api('/api/expenses', { method: 'POST', body: payload });
      state.expenses.unshift(data.expense);
      $('exp-desc').value = ''; $('exp-amount').value = ''; $('exp-date').value = todayISO();
      renderMe();
      toast('Gasto registrado!');
    } catch (err) { msg.textContent = err.message; }
    finally { btn.disabled = false; btn.textContent = original; }
  });

  async function deleteExpense(id) {
    try {
      await api('/api/expenses/' + id, { method: 'DELETE' });
      state.expenses = state.expenses.filter(e => e.id !== id);
      renderMe();
      toast('Gasto excluído');
    } catch (err) { toast(err.message, false); }
  }

  $('filter-month').addEventListener('change', (e) => { state.filterMonth = e.target.value; renderList(); });
  $('filter-category').addEventListener('change', (e) => { state.filterCategory = e.target.value; renderList(); });
  $('me-refresh').addEventListener('click', async () => { await loadExpenses(); toast('Atualizado'); });

  // ---------- admin ----------
  async function loadAdmin() {
    try {
      const data = await api('/api/admin/overview');
      $('admin-total').textContent = brl(data.total_cents);
      $('admin-users').textContent = data.active_count;
      $('admin-avg').textContent = brl(data.avg_cents);
      renderUsers(data.users);
    } catch (err) { toast(err.message, false); }
    try { await loadCategories(true); } catch (err) { toast(err.message, false); }
  }

  function renderUsers(users) {
    const tb = $('user-rows'); tb.innerHTML = '';
    users.forEach(u => {
      const tr = document.createElement('tr');
      const statusOn = u.is_active;
      tr.innerHTML =
        `<td class="user-name">${escapeHtml(u.username)}</td>` +
        `<td class="user-total">${brl(u.total_cents)}</td>` +
        `<td><span class="status-pill ${statusOn ? 'status-on' : 'status-off'}">${statusOn ? 'Ativo' : 'Desativado'}</span></td>` +
        `<td></td>`;
      const td = tr.lastElementChild;
      const b = document.createElement('button');
      b.className = 'toggle' + (statusOn ? '' : ' off');
      b.type = 'button';
      b.textContent = statusOn ? 'Desativar' : 'Reativar';
      b.addEventListener('click', () => toggleUser(u, b));
      td.appendChild(b);
      tb.appendChild(tr);
    });
    if (!users.length) {
      const tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="color:var(--ink-soft);text-align:center;padding:24px">Nenhum usuário ainda.</td>';
      tb.appendChild(tr);
    }
  }

  async function toggleUser(u, btn) {
    btn.disabled = true;
    try {
      const next = !u.is_active;
      const data = await api('/api/admin/users/' + u.id, { method: 'PATCH', body: { is_active: next } });
      u.is_active = data.user.is_active;
      btn.textContent = u.is_active ? 'Desativar' : 'Reativar';
      btn.className = 'toggle' + (u.is_active ? '' : ' off');
      loadAdmin();
      toast(u.is_active ? 'Conta reativada' : 'Conta desativada');
    } catch (err) {
      toast(err.message, false);
      btn.disabled = false;
    }
  }

  async function loadCategories(admin = false) {
    const data = await api('/api/categories');
    state.categories = data.categories;
    if (admin) renderCategories();
    else populateCategorySelects();
  }

  function renderCategories() {
    const list = $('category-list'); list.innerHTML = '';
    // contagem de gastos por categoria (uso os gastos carregados do admin? não carregamos gastos do admin; usamos só nome/estado)
    state.categories.forEach(c => {
      const li = document.createElement('li');
      li.className = 'category-row' + (c.is_active ? '' : ' is-off');
      li.innerHTML =
        `<span class="cat-dot" style="background:${c.color}"></span>` +
        `<span class="cat-name">${escapeHtml(c.name)}</span>` +
        `<button class="toggle ${c.is_active ? '' : 'off'}" type="button">${c.is_active ? 'Ativa' : 'Desativada'}</button>`;
      const b = li.querySelector('button');
      b.addEventListener('click', () => toggleCategory(c, b));
      list.appendChild(li);
    });
    if (!state.categories.length) {
      const li = document.createElement('li');
      li.className = 'empty'; li.style.padding = '16px'; li.textContent = 'Nenhuma categoria ainda.';
      list.appendChild(li);
    }
  }

  async function toggleCategory(c, btn) {
    btn.disabled = true;
    try {
      const next = !c.is_active;
      const data = await api('/api/admin/categories/' + c.id, { method: 'PATCH', body: { is_active: next } });
      c.is_active = data.category.is_active;
      c.name = data.category.name;
      renderCategories();
      await loadCategories(false);
      renderMe();
      toast(c.is_active ? 'Categoria ativada' : 'Categoria desativada');
    } catch (err) {
      toast(err.message, false);
      btn.disabled = false;
    }
  }

  $('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('category-message'); msg.textContent = '';
    try {
      await api('/api/admin/categories', {
        method: 'POST',
        body: { name: $('cat-name').value.trim(), color: $('cat-color').value }
      });
      $('cat-name').value = '';
      await loadCategories(true);
      toast('Categoria adicionada');
    } catch (err) { msg.textContent = err.message; }
  });

  // ---------- carga inicial de dados do usuário ----------
  async function loadExpenses() {
    const data = await api('/api/expenses');
    state.expenses = data.expenses;
    renderMe();
  }

  async function boot() {
    showApp();
    try {
      await Promise.all([loadCategories(false), loadExpenses()]);
    } catch (err) {
      toast(err.message, false);
    }
  }

  // ---------- início ----------
  (async function init() {
    try {
      const data = await api('/api/me');
      if (data.user) {
        state.user = data.user;
        await boot();
      } else {
        showAuth();
      }
    } catch {
      showAuth();
    }
  })();

})();
