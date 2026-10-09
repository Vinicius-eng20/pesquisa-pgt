// ===== Estado global =====
let currentUser = null;
let route = 'menu';
let dishes = [];
let orders = [];
let cart = {};          // { dishId: qty }
let cartOpen = false;
let lastPoll = 0;

// Situações ordenadas para transição
const SITUACOES = ['novo', 'preparando', 'pronto', 'entregue', 'cancelado'];
const SITUACAO_LABEL = {
  novo: 'Novo', preparando: 'Em preparo', pronto: 'Pronto',
  entregue: 'Entregue', cancelado: 'Cancelado'
};
const SITUACAO_ICONE = {
  novo: '🆕', preparando: '👨‍🍳', pronto: '✅', entregue: '📦', cancelado: '❌'
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

// ===== Helpers =====
function money(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
}
function initials(name) {
  return (name || '?').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}
function timeAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'agora mesmo';
  const m = Math.floor(s / 60);
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  return `há ${d} d`;
}
function shortId(id) {
  return '#' + (id || '').slice(0, 6).toUpperCase();
}
function esc(s) {
  return (s == null ? '' : String(s)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function toast(msg, type = '') {
  const wrap = $('#toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ===== API =====
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin'
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = new Error((data && data.error) || 'Erro inesperado.');
    err.status = res.status;
    throw err;
  }
  return data;
}

// ===== Auth =====
function setAuth(user) {
  currentUser = user;
}

function showScreen(name) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const map = { auth: 'screen-auth', app: 'screen-app' };
  const el = $('#' + map[name]);
  if (el) el.classList.add('active');
  $('#splash').hidden = true;
}

function renderChrome() {
  if (!currentUser) return;
  $('#user-avatar').textContent = initials(currentUser.name);
  $('#user-name').textContent = currentUser.name;
  $('#user-role').textContent = currentUser.role === 'gerente' ? 'Gerente' : 'Cliente';

  const nav = $('#nav');
  const links = currentUser.role === 'gerente'
    ? [{ k: 'menu', t: 'Cardápio' }, { k: 'orders', t: 'Pedidos' }, { k: 'manage', t: 'Cardápio (Gerenciar)' }]
    : [{ k: 'menu', t: 'Cardápio' }, { k: 'orders', t: 'Meus Pedidos' }];
  nav.innerHTML = links.map(l =>
    `<button class="nav-link ${route === l.k ? 'active' : ''}" data-route="${l.k}">${l.t}</button>`
  ).join('');
  $$('#nav .nav-link').forEach(b => b.onclick = () => navigate(b.dataset.route));
}

async function login(email, password) {
  return api('/auth/login', { method: 'POST', body: { email, password } });
}
async function register(name, email, password) {
  return api('/auth/register', { method: 'POST', body: { name, email, password } });
}
async function me() { return api('/auth/me'); }
async function logout() { return api('/auth/logout', { method: 'POST' }); }

async function enterApp() {
  renderChrome();
  showScreen('app');
  await loadMenu();
  if (currentUser.role === 'gerente') await loadAllOrders();
  else await loadMyOrders();
  navigate('menu');
  startPolling();
}

// ===== Dados =====
async function loadMenu() {
  dishes = await api('/dishes');
}
async function loadAllOrders() { orders = await api('/orders'); }
async function loadMyOrders() { orders = await api('/orders'); }

function visibleOrders() {
  if (currentUser.role === 'gerente') return orders;
  return orders.filter(o => o.customerName === currentUser.name);
}

// ===== Navegação =====
function navigate(r) {
  route = r;
  renderChrome();
  const c = $('#content');
  c.innerHTML = '';
  if (r === 'menu') renderMenu(c);
  else if (r === 'orders') renderOrders(c);
  else if (r === 'manage') renderManage(c);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== CARDÁPIO =====
function renderMenu(c) {
  const isGerente = currentUser.role === 'gerente';
  const cats = ['Todas', ...new Set(dishes.map(d => d.category))];
  c.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Cardápio</h2>
        <p>Escolha seus pratos favoritos e monte seu pedido.</p>
      </div>
      <div class="menu-controls">
        <input class="search-input" id="menu-search" placeholder="🔍 Buscar prato…" />
        <div id="cat-pills" style="display:flex;gap:8px;flex-wrap:wrap"></div>
      </div>
    </div>
    <div id="menu-filter" style="display:none;margin-bottom:16px;font-size:.85rem;color:var(--ink-mute)"></div>
    <div id="menu-grid" class="menu-grid"></div>
  `;

  const pills = $('#cat-pills');
  pills.innerHTML = cats.map((cat, i) =>
    `<button class="cat-pill ${i === 0 ? 'active' : ''}" data-cat="${esc(cat)}">${esc(cat)}</button>`
  ).join('');

  const state = { cat: cats[0], q: '' };

  function draw() {
    const grid = $('#menu-grid');
    const list = dishes.filter(d =>
      (state.cat === 'Todas' || d.category === state.cat) &&
      (!state.q || d.name.toLowerCase().includes(state.q.toLowerCase()))
    );
    if (list.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="emoji">🍽️</div><h3>Nenhum prato encontrado</h3><p>Tente outra busca.</p></div>`;
      return;
    }
    grid.innerHTML = list.map((d, i) => dishCard(d, i)).join('');
    bindDishButtons();
  }

  function dishCard(d, i) {
    const qty = cart[d.id] || 0;
    const out = !d.available;
    let action;
    if (qty > 0) {
      action = `<div class="qty-stepper">
        <button data-act="dec" data-id="${d.id}">−</button>
        <span class="qty-val">${qty}</span>
        <button data-act="inc" data-id="${d.id}">+</button>
      </div>`;
    } else if (out) {
      action = `<button class="dish-add" disabled>Esgotado</button>`;
    } else {
      action = `<button class="dish-add" data-act="inc" data-id="${d.id}">+ Adicionar</button>`;
    }
    return `<div class="dish-card reveal ${out ? 'out' : ''}" style="animation-delay:${Math.min(i * 40, 300)}ms">
      <span class="dish-tag">${esc(d.category)}</span>
      <div class="dish-name">${esc(d.name)}</div>
      ${d.description ? `<div class="dish-desc">${esc(d.description)}</div>` : `<div class="dish-desc" style="visibility:hidden">&nbsp;</div>`}
      <div class="dish-foot">
        <span class="dish-price">${money(d.price)}</span>
        ${action}
      </div>
    </div>`;
  }

  function bindDishButtons() {
    $$('#menu-grid [data-act]').forEach(btn => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const dish = dishes.find(d => d.id === id);
        if (!dish) return;
        if (!dish.available) return;
        if (btn.dataset.act === 'inc') cart[id] = (cart[id] || 0) + 1;
        else cart[id] = Math.max(0, (cart[id] || 0) - 1);
        if (cart[id] === 0) delete cart[id];
        draw();
        updateFab();
      };
    });
  }

  pills.querySelectorAll('.cat-pill').forEach(p => p.onclick = () => {
    pills.querySelectorAll('.cat-pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    state.cat = p.dataset.cat;
    draw();
  });
  $('#menu-search').oninput = e => {
    state.q = e.target.value;
    draw();
  };

  draw();
  updateFab();
}

function cartCount() { return Object.values(cart).reduce((a, b) => a + b, 0); }
function cartTotal() {
  return Object.entries(cart).reduce((sum, [id, q]) => {
    const d = dishes.find(x => x.id === id);
    return sum + (d ? d.price * q : 0);
  }, 0);
}
function updateFab() {
  let fab = $('.cart-fab');
  if (route !== 'menu') { if (fab) fab.remove(); return; }
  if (!fab) {
    fab = document.createElement('button');
    fab.className = 'cart-fab';
    fab.innerHTML = `🛒 Pedir <span class="cart-count" id="cart-count">0</span> <span id="cart-total"></span>`;
    fab.onclick = openCart;
    document.body.appendChild(fab);
  }
  const n = cartCount();
  $('#cart-count', fab).textContent = n;
  const t = $('#cart-total', fab);
  if (t) t.textContent = n ? money(cartTotal()) : '';
  if (n === 0) fab.style.display = 'none'; else fab.style.display = 'flex';
}

function openCart() {
  const entries = Object.entries(cart).map(([id, q]) => {
    const d = dishes.find(x => x.id === id);
    return { ...d, qty: q };
  }).filter(x => x && x.name);
  const html = entries.map(e => `
    <div class="cart-item">
      <div>
        <div class="cart-item-name">${e.qty}× ${esc(e.name)}</div>
        <div class="cart-item-price">${money(e.price)} un.</div>
      </div>
      <div class="qty-stepper">
        <button data-act="dec" data-id="${e.id}">−</button>
        <span class="qty-val">${e.qty}</span>
        <button data-act="inc" data-id="${e.id}">+</button>
      </div>
    </div>`).join('');

  const total = entries.reduce((s, e) => s + e.price * e.qty, 0);
  openModal(`
    <div class="modal-head"><h3>Seu pedido</h3><button class="close-x" data-close>×</button></div>
    <div class="modal-body">
      ${entries.length === 0 ? `<p style="color:var(--ink-mute)">Seu carrinho está vazio.</p>` : html}
      <label class="field" style="margin-top:8px">
        <span>Obs. (opcional)</span>
        <input type="text" id="order-note" placeholder="Ex.: sem cebola, ponto da carne…" maxlength="120" />
      </label>
      <div class="total-row"><span>Total</span><span id="modal-total">${money(total)}</span></div>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost" data-close>Continuar</button>
      <button class="btn btn-primary" id="btn-confirm" ${entries.length ? '' : 'disabled'}>Confirmar pedido</button>
    </div>
  `);

  $$('#modal [data-act]').forEach(btn => btn.onclick = () => {
    const id = btn.dataset.id;
    if (btn.dataset.act === 'inc') cart[id] = (cart[id] || 0) + 1;
    else cart[id] = Math.max(0, (cart[id] || 0) - 1);
    if (cart[id] === 0) delete cart[id];
    openCart();
    updateFab();
  });
  $('#btn-confirm').onclick = confirmOrder;
}

async function confirmOrder() {
  const items = Object.entries(cart).map(([dishId, qty]) => ({ dishId, qty }));
  if (items.length === 0) return;
  const btn = $('#btn-confirm');
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    await api('/orders', { method: 'POST', body: { items, note: $('#order-note').value } });
    cart = {};
    closeModal();
    updateFab();
    toast('Pedido enviado com sucesso! 🎉', 'success');
    if (currentUser.role === 'gerente') await loadAllOrders();
    await loadMyOrders();
  } catch (e) {
    toast(e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Confirmar pedido';
  }
}

// ===== PEDIDOS =====
function renderOrders(c) {
  const isGerente = currentUser.role === 'gerente';
  let list = visibleOrders();

  c.innerHTML = `
    <div class="section-head">
      <div><h2>${isGerente ? 'Todos os Pedidos' : 'Meus Pedidos'}</h2>
      <p>${isGerente ? 'Acompanhe e gerencie os pedidos dos clientes.' : 'Acompanhe o status dos seus pedidos.'}</p></div>
    </div>
    <div class="filter-row" id="order-filters"></div>
    <div id="order-list"></div>
  `;

  const filters = [
    { k: 'todos', t: 'Todos' },
    { k: 'ativo', t: 'Em andamento' },
    { k: 'entregue', t: 'Entregues' },
    { k: 'cancelado', t: 'Cancelados' }
  ];
  $('#order-filters').innerHTML = filters.map((f, i) =>
    `<button class="cat-pill ${i === 0 ? 'active' : ''}" data-f="${f.k}">${f.t}</button>`
  ).join('');

  let state = { f: 'todos' };

  function filtered() {
    if (state.f === 'todos') return list;
    if (state.f === 'ativo') return list.filter(o => ['novo', 'preparando', 'pronto'].includes(o.situation));
    return list.filter(o => o.situation === state.f);
  }

  function draw() {
    const wl = filtered();
    const el = $('#order-list');
    if (wl.length === 0) {
      el.innerHTML = `<div class="empty-state"><div class="emoji">🧾</div><h3>Nenhum pedido por aqui</h3><p>Quando você fizer um pedido, ele aparece nesta lista.</p></div>`;
      return;
    }
    el.innerHTML = wl.map((o, i) => orderCard(o, isGerente, i)).join('');
    bindOrderActions();
  }

  function orderCard(o, gerente, i) {
    const lines = o.items.map(it =>
      `<div class="order-line"><span>${it.qty}× ${esc(it.name)}</span><b>${money(it.subtotal)}</b></div>`
    ).join('');
    const sitBtns = gerente ? SITUACOES.map(s =>
      `<button class="sit-btn ${o.situation === s ? 'active' : ''}" data-sit="${s}" data-id="${o.id}">${SITUACAO_ICONE[s]} ${SITUACAO_LABEL[s]}</button>`
    ).join('') : '';

    return `<div class="order-card reveal" style="animation-delay:${Math.min(i * 40, 240)}ms">
      <div class="order-main">
        <div class="order-top">
          <span class="order-id">${shortId(o.id)}</span>
          <span class="badge ${o.situation}"><span class="dot"></span>${SITUACAO_ICONE[o.situation]} ${SITUACAO_LABEL[o.situation]}</span>
          ${gerente ? `<span style="font-size:.85rem;color:var(--ink-mute)">👤 ${esc(o.customerName)}</span>` : ''}
        </div>
        <div class="order-items">${lines}</div>
        ${o.note ? `<div class="order-note">📝 ${esc(o.note)}</div>` : ''}
        ${gerente ? `<div class="sit-actions">${sitBtns}</div>` : ''}
      </div>
      <div class="order-side">
        <div class="order-total">${money(o.total)}</div>
        <div class="order-meta">${gerente ? esc(o.customerName) : ''}<br/>${timeAgo(o.createdAt)}</div>
      </div>
    </div>`;
  }

  function bindOrderActions() {
    $$('#order-list .sit-btn').forEach(b => b.onclick = async () => {
      try {
        await api(`/orders/${b.dataset.id}/situation`, { method: 'PUT', body: { situation: b.dataset.sit } });
        await loadAllOrders();
        renderOrders(c);
        toast(`Status: ${SITUACAO_LABEL[b.dataset.sit]}`, 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  $$('#order-filters .cat-pill').forEach(p => p.onclick = () => {
    $$('#order-filters .cat-pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    state.f = p.dataset.f;
    draw();
  });

  draw();
}

// ===== GERENCIAR CARDÁPIO (gerente) =====
function renderManage(c) {
  c.innerHTML = `
    <div class="section-head">
      <div><h2>Gerenciar Cardápio</h2>
      <p>Cadastre, edite e remova pratos. Mude a disponibilidade a qualquer momento.</p></div>
      <button class="btn btn-primary" id="btn-new-dish">+ Novo prato</button>
    </div>
    <div class="dish-form-grid" id="dish-form" hidden></div>
    <div id="dish-table-wrap"></div>
  `;

  const form = $('#dish-form');
  const wrap = $('#dish-table-wrap');
  let editing = null;

  function showForm(d = null) {
    editing = d;
    form.hidden = false;
    form.innerHTML = `
      <label class="field"><span>Nome</span><input name="name" value="${esc(d ? d.name : '')}" placeholder="Ex.: Feijoada" required></label>
      <label class="field"><span>Categoria</span><input name="category" value="${esc(d ? d.category : '')}" placeholder="Principais" list="cat-list"></label>
      <label class="field"><span>Preço (R$)</span><input name="price" type="number" min="0" step="0.01" value="${d ? d.price : ''}" placeholder="0.00"></label>
      <label class="field"><span>Descrição</span><input name="description" value="${esc(d ? d.description : '')}" placeholder="Breve descrição"></label>
      <label class="field"><span>Disponível</span>
        <div class="switch"><input type="checkbox" name="available" ${d ? (d.available ? 'checked' : '') : 'checked'}><span>${d ? (d.available ? 'Sim' : 'Não') : 'Sim'}</span></div>
      </label>
      <div class="dish-form-actions">
        <button class="btn btn-primary" id="save-dish">${d ? 'Salvar' : 'Adicionar'}</button>
        <button class="btn btn-ghost" id="cancel-dish">Cancelar</button>
      </div>
      <datalist id="cat-list">${[...new Set(dishes.map(d => d.category))].map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    `;
    form.querySelectorAll('input, datalist');
    const setAvail = form.querySelector('input[name=available]');
    setAvail.onchange = () => setAvail.nextElementSibling.textContent = setAvail.checked ? 'Sim' : 'Não';
    form.querySelector('#cancel-dish').onclick = () => { form.hidden = true; form.innerHTML = ''; };
    form.querySelector('#save-dish').onclick = saveDish;
  }

  async function saveDish() {
    const get = n => form.querySelector(`[name="${n}"]`).value.trim();
    const body = {
      name: get('name'),
      category: get('category') || 'Outros',
      price: Number(form.querySelector('[name=price]').value),
      description: get('description'),
      available: form.querySelector('[name=available]').checked
    };
    if (!body.name) return toast('Informe o nome do prato', 'error');
    if (isNaN(body.price) || body.price < 0) return toast('Preço inválido', 'error');
    try {
      if (editing) {
        await api('/dishes/' + editing.id, { method: 'PUT', body });
        toast('Prato atualizado', 'success');
      } else {
        await api('/dishes', { method: 'POST', body });
        toast('Prato adicionado', 'success');
      }
      form.hidden = true;
      await loadMenu();
      renderManage(c);
    } catch (e) { toast(e.message, 'error'); }
  }

  function draw() {
    const rows = dishes.map(d => `
      <tr>
        <td class="name-cell">${esc(d.name)}</td>
        <td>${esc(d.category)}</td>
        <td>${esc(d.description || '—')}</td>
        <td><b>${money(d.price)}</b></td>
        <td>
          <label class="switch">
            <input type="checkbox" data-avail="${d.id}" ${d.available ? 'checked' : ''}>
            <span>${d.available ? 'Disponível' : 'Esgotado'}</span>
          </label>
        </td>
        <td>
          <div class="table-actions">
            <button class="icon-btn" data-edit="${d.id}" title="Editar">✏️</button>
            <button class="icon-btn danger" data-del="${d.id}" title="Remover">🗑️</button>
          </div>
        </td>
      </tr>`).join('');
    wrap.innerHTML = dishes.length === 0
      ? `<div class="empty-state"><div class="emoji">🍳</div><h3>Cardápio vazio</h3><p>Clique em "Novo prato" para começar.</p></div>`
      : `<table class="dish-table">
          <thead><tr><th>Prato</th><th>Categoria</th><th>Descrição</th><th>Preço</th><th>Status</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;

    wrap.querySelectorAll('[data-avail]').forEach(cb => cb.onchange = async () => {
      try {
        await api('/dishes/' + cb.dataset.avail, { method: 'PUT', body: { available: cb.checked } });
        await loadMenu();
        renderManage(c);
        toast(cb.checked ? 'Prato disponível' : 'Prato esgotado', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
    wrap.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
      const d = dishes.find(x => x.id === b.dataset.edit);
      showForm(d);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    wrap.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
      const d = dishes.find(x => x.id === b.dataset.del);
      if (!confirm(`Remover o prato "${d.name}"?`)) return;
      try {
        await api('/dishes/' + d.id, { method: 'DELETE' });
        await loadMenu();
        renderManage(c);
        toast('Prato removido', 'success');
      } catch (e) { toast(e.message, 'error'); }
    });
  }

  $('#btn-new-dish').onclick = () => { showForm(null); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  draw();
}

// ===== MODAL =====
function openModal(html) {
  const m = $('#modal');
  m.innerHTML = `<div class="modal">${html}</div>`;
  m.hidden = false;
  m.onclick = e => { if (e.target === m || e.target.closest('[data-close]')) closeModal(); };
  $$('[data-close]', m).forEach(b => b.onclick = e => { e.stopPropagation(); closeModal(); });
}
function closeModal() {
  const m = $('#modal');
  m.hidden = true;
  m.innerHTML = '';
}

// ===== POLLING (atualização em tempo real) =====
function startPolling() {
  clearInterval(window._poll);
  window._poll = setInterval(async () => {
    if (document.hidden) return;
    try {
      await loadMyOrders();
      if (route === 'orders') renderOrders($('#content'));
    } catch (e) { /* silêncio */ }
  }, 8000);
}

// ===== EVENTOS GLOBAIS =====
function setupAuth() {
  const tabs = $$('.auth-tabs .tab');
  const forms = { login: $('#form-login'), register: $('#form-register') };
  function switchTab(name) {
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    Object.entries(forms).forEach(([k, f]) => f.hidden = k !== name);
    $$('[data-error]').forEach(e => e.textContent = '');
  }
  tabs.forEach(t => t.onclick = () => switchTab(t.dataset.tab));

  async function handle(err, data) {
    const errEl = $('[data-error]', (document.querySelector('.auth-form:not([hidden])')));
    if (err) { errEl.textContent = err; return; }
    setAuth(data.user);
    await enterApp();
  }

  forms.login.onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    try {
      const data = await login(f.email.value, f.password.value);
      await handle(null, data);
    } catch (e2) { handle(e2.message); }
  };
  forms.register.onsubmit = async e => {
    e.preventDefault();
    const f = e.target;
    try {
      const data = await register(f.name.value, f.email.value, f.password.value);
      await handle(null, data);
    } catch (e2) { handle(e2.message); }
  };
}

function setupLogout() {
  $('#btn-logout').onclick = async () => {
    try { await logout(); } catch (e) {}
    currentUser = null;
    route = 'menu';
    cart = {};
    clearInterval(window._poll);
    showScreen('auth');
    $$('[data-error]').forEach(e => e.textContent = '');
  };
}

// ===== BOOT =====
(async function boot() {
  setupAuth();
  setupLogout();
  window.addEventListener('beforeunload', saveDbHint);
  try {
    const data = await me();
    setAuth(data.user);
    await enterApp();
  } catch (e) {
    showScreen('auth');
  }
  $('#splash').hidden = true;
})();

function saveDbHint() {
  // O backend já salva sozinho; isso é só um gancho de segurança.
}
