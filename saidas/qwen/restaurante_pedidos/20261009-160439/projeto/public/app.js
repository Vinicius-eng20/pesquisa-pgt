// ============ Estado global ============
let state = {
  token: localStorage.getItem('token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  role: null, // 'client' | 'manager'
  dishes: [],
  orders: [],
  view: null,
  cart: {} // { dishId: qty }
};

// ============ Helpers de API ============
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  const res = await fetch(path, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const err = new Error(data.error || 'Algo deu errado.');
    err.status = res.status;
    throw err;
  }
  return data;
}

function money(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s.replace(' ', 'T') + (s.length === 19 ? 'Z' : ''));
  if (isNaN(d)) return s;
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

const STATUS_LABEL = {
  new: 'Novo',
  preparing: 'Preparando',
  ready: 'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado'
};

function statusLabel(s) { return STATUS_LABEL[s] || s; }

// ============ Toast ============
function toast(msg, isError) {
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 300); }, 2600);
}

// ============ Autenticação ============
function saveSession(token, user) {
  state.token = token; state.user = user; state.role = user.role;
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function clearSession() {
  state.token = null; state.user = null; state.role = null;
  localStorage.removeItem('token'); localStorage.removeItem('user');
  state.cart = {};
}

function setupUserbox() {
  const box = document.getElementById('userbox');
  if (state.user) {
    box.style.display = 'flex';
    document.getElementById('userbox-name').textContent = state.user.name;
    const roleEl = document.getElementById('userbox-role');
    roleEl.textContent = state.user.role === 'manager' ? 'Gerente' : 'Cliente';
    roleEl.className = 'badge' + (state.user.role === 'manager' ? ' manager' : '');
  } else {
    box.style.display = 'none';
  }
}

// ============ Roteador ============
function render() {
  const app = document.getElementById('app');
  setupUserbox();
  if (!state.user) return renderAuth(app);
  if (state.role === 'manager') return renderManager(app);
  return renderClient(app);
}

// ============ TELA: Login / Cadastro ============
function renderAuth(app) {
  app.innerHTML = `
    <div class="auth-wrap">
      <div class="card auth-card">
        <h1>🍽️ Sabor &amp; Cia</h1>
        <p class="sub">Entre na sua conta para ver o cardápio e fazer seus pedidos.</p>
        <div class="tabs">
          <button id="tab-login" class="active">Entrar</button>
          <button id="tab-register">Criar conta</button>
        </div>
        <div class="form-error" id="auth-error"></div>
        <form id="auth-form">
          <div class="field" id="field-name" style="display:none;">
            <label>Seu nome</label>
            <input id="auth-name" type="text" placeholder="Como podemos te chamar" autocomplete="name">
          </div>
          <div class="field">
            <label>E-mail</label>
            <input id="auth-email" type="email" placeholder="voce@email.com" autocomplete="email">
          </div>
          <div class="field">
            <label>Senha</label>
            <input id="auth-pass" type="password" placeholder="Sua senha" autocomplete="current-password">
          </div>
          <div class="field" id="field-role" style="display:none;">
            <label class="role-switch" style="margin:0;">
              <input type="checkbox" id="auth-manager"> Quero entrar como <strong>Gerente</strong>
            </label>
          </div>
          <button class="btn btn-primary" type="submit" style="width:100%;" id="auth-submit">Entrar</button>
        </form>
        <p class="sub" style="margin-top:18px; text-align:center; font-size:.85rem;">
          Primeiro acesso? Já existe uma conta de gerente: <br>
          <strong>gerente@restaurante.com</strong> / <strong>123456</strong>
        </p>
      </div>
    </div>
  `;

  let mode = 'login';
  const tabLogin = document.getElementById('tab-login');
  const tabReg = document.getElementById('tab-register');

  function setMode(m) {
    mode = m;
    tabLogin.classList.toggle('active', m === 'login');
    tabReg.classList.toggle('active', m === 'register');
    document.getElementById('field-name').style.display = m === 'register' ? 'block' : 'none';
    document.getElementById('field-role').style.display = m === 'register' ? 'block' : 'none';
    document.getElementById('auth-submit').textContent = m === 'register' ? 'Criar conta' : 'Entrar';
    document.getElementById('auth-error').textContent = '';
  }
  tabLogin.onclick = () => setMode('login');
  tabReg.onclick = () => setMode('register');

  document.getElementById('auth-form').onsubmit = async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('auth-error');
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-pass').value;
    const btn = document.getElementById('auth-submit');
    errEl.textContent = '';

    try {
      let data;
      if (mode === 'login') {
        data = await api('/api/auth/login', { method: 'POST', body: { email, password: pass } });
      } else {
        const name = document.getElementById('auth-name').value.trim();
        const role = document.getElementById('auth-manager').checked ? 'manager' : 'client';
        data = await api('/api/auth/register', { method: 'POST', body: { name, email, password: pass, role } });
      }
      saveSession(data.token, data.user);
      state.view = 'menu';
      render();
    } catch (err) {
      errEl.textContent = err.message;
    }
  };
}

// ============ TELA: CLIENTE ============
function renderClient(app) {
  const nav = [
    ['menu', 'Cardápio'],
    ['orders', 'Meus Pedidos']
  ];
  app.innerHTML = `
    <nav class="nav">
      ${nav.map(([k, label]) => `<button data-v="${k}" class="${state.view === k ? 'active' : ''}">${label}</button>`).join('')}
    </nav>
    <div id="view"></div>
  `;
  app.querySelectorAll('.nav button').forEach(b => {
    b.onclick = () => { state.view = b.dataset.v; render(); };
  });
  const view = document.getElementById('view');
  if (state.view === 'orders') renderMyOrders(view);
  else renderMenu(view);
}

function renderMenu(view) {
  if (!state.dishes.length) state.dishes = [];
  view.innerHTML = `
    <div class="menu-head"><h2>Cardápio</h2></div>
    <div class="search-row"><input id="search" type="text" placeholder="Buscar prato ou categoria..."></div>
    <div id="grid" class="grid"><p class="empty">Carregando...</p></div>
  `;
  loadDishes().then(() => {
    renderGrid();
    document.getElementById('search').oninput = renderGrid;
  });
}

async function loadDishes() {
  const data = await api('/api/dishes');
  state.dishes = data.dishes;
  return data.dishes;
}

function renderGrid() {
  const grid = document.getElementById('grid');
  const q = (document.getElementById('search') ? document.getElementById('search').value : '').toLowerCase();
  const list = state.dishes.filter(d =>
    !q || d.name.toLowerCase().includes(q) || (d.category || '').toLowerCase().includes(q)
  );
  if (!list.length) { grid.innerHTML = '<p class="empty">Nenhum prato encontrado.</p>'; return; }

  // agrupa por categoria
  const groups = {};
  list.forEach(d => { (groups[d.category || 'Geral'] = groups[d.category || 'Geral'] || []).push(d); });

  let html = '';
  for (const cat in groups) {
    html += `<div style="grid-column:1/-1; font-size:.78rem; font-weight:800; text-transform:uppercase; letter-spacing:.6px; color:var(--muted); margin:14px 0 2px;">${escapeHtml(cat)}</div>`;
    html += groups[cat].map(d => dishCard(d)).join('');
  }
  grid.innerHTML = html;

  grid.querySelectorAll('.qty button[data-act]').forEach(b => {
    b.onclick = () => {
      const id = b.dataset.id;
      const act = b.dataset.act;
      state.cart[id] = state.cart[id] || 0;
      if (act === 'inc') state.cart[id]++;
      if (act === 'dec') state.cart[id] = Math.max(0, state.cart[id] - 1);
      if (state.cart[id] === 0) delete state.cart[id];
      updateQtyLabels(id);
      updateCartBar();
    };
  });
  updateCartBar();
}

function dishCard(d) {
  const qty = state.cart[d.id] || 0;
  return `
    <div class="dish ${d.available ? '' : 'unavailable'}">
      <div class="cat">${escapeHtml(d.category || 'Geral')}</div>
      <h3>${escapeHtml(d.name)}</h3>
      <div class="desc">${escapeHtml(d.description)}</div>
      <div class="foot">
        <span class="price">${money(d.price)}</span>
        ${d.available ? `
          <div class="qty">
            <button data-act="dec" data-id="${d.id}">−</button>
            <span data-qty="${d.id}">${qty}</span>
            <button data-act="inc" data-id="${d.id}">+</button>
          </div>` : `<span class="pill">Indisponível</span>`}
      </div>
    </div>
  `;
}

function updateQtyLabels(id) {
  const el = document.querySelector(`[data-qty="${id}"]`);
  if (el) el.textContent = state.cart[id] || 0;
}

function cartCount() { return Object.values(state.cart).reduce((a, b) => a + b, 0); }
function cartTotal() {
  return Object.entries(state.cart).reduce((sum, [id, qty]) => {
    const d = state.dishes.find(x => String(x.id) === String(id));
    return sum + (d ? d.price * qty : 0);
  }, 0);
}

function updateCartBar() {
  let bar = document.getElementById('cart-bar');
  const count = cartCount();
  if (count === 0 && bar) { bar.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'cart-bar';
    bar.className = 'cart-bar';
    bar.innerHTML = `
      <div class="cart-inner">
        <div class="info" id="cart-summary">0 itens<small></small></div>
        <button class="btn btn-primary" id="open-cart">Ver pedido</button>
      </div>`;
    document.body.appendChild(bar);
    bar.querySelector('#open-cart').onclick = openCart;
  }
  document.getElementById('cart-summary').innerHTML = `${count} ${count === 1 ? 'item' : 'itens'}<small>Total: ${money(cartTotal())}</small>`;
}

function openCart() {
  const lines = Object.entries(state.cart).map(([id, qty]) => {
    const d = state.dishes.find(x => String(x.id) === String(id));
    if (!d) return '';
    return `<div class="cart-line" data-id="${d.id}">
      <div class="nm">${escapeHtml(d.name)}<small>${money(d.price)} cada</small></div>
      <div class="qty">
        <button data-cact="dec">−</button>
        <span>${qty}</span>
        <button data-cact="inc">+</button>
      </div>
    </div>`;
  }).join('');

  const modal = document.createElement('div');
  modal.className = 'modal-bg';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-head">
        <h2>Seu pedido</h2>
        <button class="icon-btn" data-close>✕</button>
      </div>
      <div id="cart-lines">${lines || '<p class="empty">Carrinho vazio.</p>'}</div>
      <div class="cart-total"><span>Total</span><span id="cart-total-val">${money(cartTotal())}</span></div>
      <div class="field"><label>Mesa / referência (opcional)</label><input id="cart-table" type="text" placeholder="Ex.: Mesa 5"></div>
      <div class="field"><label>Observações (opcional)</label><textarea id="cart-notes" placeholder="Ex.: sem alho, ponto da carne..."></textarea></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-close>Continuar</button>
        <button class="btn btn-primary" id="place-order">Fazer pedido</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  modal.querySelectorAll('[data-close]').forEach(b => b.onclick = () => modal.remove());
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  modal.querySelectorAll('[data-cact]').forEach(b => {
    b.onclick = () => {
      const line = b.closest('.cart-line');
      const id = line.dataset.id;
      state.cart[id] = state.cart[id] || 0;
      if (b.dataset.cact === 'inc') state.cart[id]++;
      if (b.dataset.cact === 'dec') state.cart[id] = Math.max(0, state.cart[id] - 1);
      if (state.cart[id] === 0) delete state.cart[id];
      openCart(); // redesenha
      updateCartBar();
    };
  });

  document.getElementById('place-order').onclick = async () => {
    const items = Object.entries(state.cart).map(([dish_id, quantity]) => ({ dish_id: Number(dish_id), quantity }));
    const btn = document.getElementById('place-order');
    if (!items.length) return toast('Seu carrinho está vazio.', true);
    btn.disabled = true; btn.textContent = 'Enviando...';
    try {
      await api('/api/orders', {
        method: 'POST',
        body: {
          items,
          table_number: document.getElementById('cart-table').value.trim(),
          notes: document.getElementById('cart-notes').value.trim()
        }
      });
      state.cart = {};
      updateCartBar();
      modal.remove();
      toast('Pedido enviado! Acompanhe em "Meus Pedidos".');
      state.view = 'orders';
      render();
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false; btn.textContent = 'Fazer pedido';
    }
  };
}

async function renderMyOrders(view) {
  view.innerHTML = '<div class="section"><p class="empty">Carregando seus pedidos...</p></div>';
  try {
    const data = await api('/api/orders/mine');
    state.orders = data.orders;
    if (!data.orders.length) {
      view.innerHTML = `<div class="section"><p class="empty"><div class="big">🍜</div>Você ainda não fez nenhum pedido.<br><br><button class="btn btn-primary" id="go-menu">Ver o cardápio</button></p></div>`;
      const g = document.getElementById('go-menu');
      if (g) g.onclick = () => { state.view = 'menu'; render(); };
      return;
    }
    view.innerHTML = `<div class="section"><h2>Meus pedidos</h2>` + data.orders.map(orderCard).join('') + `</div>`;
  } catch (err) {
    view.innerHTML = `<div class="section"><p class="empty">${escapeHtml(err.message)}</p></div>`;
  }
}

function orderCard(o) {
  const items = o.items.map(i =>
    `<li><span>${i.quantity}× ${escapeHtml(i.dish_name)}</span><span>${money(i.unit_price * i.quantity)}</span></li>`
  ).join('');
  return `
    <div class="order-card">
      <div class="order-top">
        <div><span class="oid">Pedido #${o.id}</span><div class="odate">${fmtDate(o.created_at)}</div></div>
        <span class="status ${o.status}">${statusLabel(o.status)}</span>
      </div>
      <div class="order-items"><ul>${items}</ul></div>
      ${o.table_number ? `<div class="order-meta">📍 ${escapeHtml(o.table_number)}</div>` : ''}
      ${o.notes ? `<div class="order-meta">📝 ${escapeHtml(o.notes)}</div>` : ''}
      <div class="order-total"><span>Total</span><span>${money(o.total)}</span></div>
    </div>
  `;
}

// ============ TELA: GERENTE ============
function renderManager(app) {
  const nav = [
    ['orders', 'Pedidos'],
    ['dishes', 'Cardápio']
  ];
  app.innerHTML = `
    <nav class="nav">
      ${nav.map(([k, label]) => `<button data-v="${k}" class="${state.view === k ? 'active' : ''}">${label}</button>`).join('')}
    </nav>
    <div id="view"></div>
  `;
  app.querySelectorAll('.nav button').forEach(b => {
    b.onclick = () => { state.view = b.dataset.v; render(); };
  });
  if (!state.view || !nav.some(([k]) => k === state.view)) state.view = 'orders';
  const view = document.getElementById('view');
  if (state.view === 'dishes') renderManagerDishes(view);
  else renderManagerOrders(view);
}

async function renderManagerOrders(view) {
  view.innerHTML = `<p class="empty">Carregando pedidos...</p>`;
  try {
    const data = await api('/api/orders/all');
    state.orders = data.orders;
    const statuses = ['', 'new', 'preparing', 'ready', 'delivered', 'cancelled'];
    view.innerHTML = `
      <div class="dash-head">
        <h2>Todos os pedidos</h2>
        <div class="filters">
          <select id="filter-status">
            ${statuses.map(s => `<option value="${s}">${s ? statusLabel(s) : 'Todos os status'}</option>`).join('')}
          </select>
          <button class="btn btn-ghost btn-sm" id="refresh-orders">Atualizar</button>
        </div>
      </div>
      <div class="mtable-wrap"><table class="mtable">
        <thead><tr><th>#</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Situação</th></tr></thead>
        <tbody id="orders-body"></tbody>
      </table></div>
    `;
    document.getElementById('refresh-orders').onclick = () => renderManagerOrders(view);
    document.getElementById('filter-status').onchange = () => drawOrdersRows(view);
    drawOrdersRows(view);
  } catch (err) {
    view.innerHTML = `<p class="empty">${escapeHtml(err.message)}</p>`;
  }
}

function drawOrdersRows(view) {
  const body = document.getElementById('orders-body');
  const fStatus = document.getElementById('filter-status').value;
  const rows = state.orders.filter(o => !fStatus || o.status === fStatus);
  if (!rows.length) { body.innerHTML = '<tr><td colspan="5" class="item-cell" style="text-align:center;padding:24px;">Nenhum pedido aqui.</td></tr>'; return; }
  body.innerHTML = rows.map(o => {
    const items = o.items.map(i => `${i.quantity}× ${escapeHtml(i.dish_name)}`).join(', ');
    const options = Object.keys(STATUS_LABEL).map(s =>
      `<option value="${s}" ${o.status === s ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`
    ).join('');
    return `<tr>
      <td><strong>#${o.id}</strong><div class="item-cell">${fmtDate(o.created_at)}${o.table_number ? ' · Mesa ' + escapeHtml(o.table_number) : ''}</div></td>
      <td>${escapeHtml(o.owner_name)}<div class="item-cell">${escapeHtml(o.owner_email || '')}</div></td>
      <td class="item-cell">${items}${o.notes ? '<br>📝 ' + escapeHtml(o.notes) : ''}</td>
      <td>${money(o.total)}</td>
      <td><select data-status="${o.id}">${options}</select></td>
    </tr>`;
  }).join('');
  body.querySelectorAll('select[data-status]').forEach(sel => {
    sel.onchange = async () => {
      try {
        await api(`/api/orders/${sel.dataset.status}/status`, { method: 'PATCH', body: { status: sel.value } });
        toast('Situação atualizada.');
        const o = state.orders.find(x => String(x.id) === String(sel.dataset.status));
        if (o) o.status = sel.value;
      } catch (err) { toast(err.message, true); }
    };
  });
}

async function renderManagerDishes(view) {
  const data = await loadDishes().then(() => ({ dishes: state.dishes }));
  view.innerHTML = `
    <div class="dash-head">
      <h2>Cardápio</h2>
      <button class="btn btn-primary btn-sm" id="add-dish">+ Novo prato</button>
    </div>
    <div class="mtable-wrap"><table class="mtable">
      <thead><tr><th>Prato</th><th>Categoria</th><th>Preço</th><th>Status</th><th></th></tr></thead>
      <tbody id="dishes-body"></tbody>
    </table></div>
  `;
  document.getElementById('add-dish').onclick = () => dishFormModal();
  drawDishesRows(view);
}

function drawDishesRows(view) {
  const body = document.getElementById('dishes-body');
  if (!state.dishes.length) { body.innerHTML = '<tr><td colspan="5" class="item-cell" style="text-align:center;padding:24px;">Nenhum prato cadastrado ainda.</td></tr>'; return; }
  body.innerHTML = state.dishes.map(d => `
    <tr>
      <td><strong>${escapeHtml(d.name)}</strong>${d.description ? '<div class="item-cell">' + escapeHtml(d.description) + '</div>' : ''}</td>
      <td><span class="pill">${escapeHtml(d.category || 'Geral')}</span></td>
      <td>${money(d.price)}</td>
      <td><span class="status ${d.available ? 'ready' : 'cancelled'}">${d.available ? 'Disponível' : 'Pausado'}</span></td>
      <td class="row-actions" style="justify-content:flex-end;">
        <button class="btn btn-ghost btn-sm" data-edit="${d.id}">Editar</button>
        <button class="btn btn-danger btn-sm" data-del="${d.id}">Remover</button>
      </td>
    </tr>`).join('');

  body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => {
    const d = state.dishes.find(x => String(x.id) === String(b.dataset.edit));
    if (d) dishFormModal(d);
  });
  body.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('Remover este prato do cardápio?')) return;
    try {
      await api('/api/dishes/' + b.dataset.del, { method: 'DELETE' });
      state.dishes = state.dishes.filter(x => String(x.id) !== String(b.dataset.del));
      drawDishesRows(view);
      toast('Prato removido.');
    } catch (err) { toast(err.message, true); }
  });
}

function dishFormModal(existing) {
  const d = existing || { name: '', description: '', price: '', category: '', available: true };
  const modal = document.createElement('div');
  modal.className = 'modal-bg';
  modal.innerHTML = `
    <div class="modal">
      <div class="modal-head"><h2>${existing ? 'Editar prato' : 'Novo prato'}</h2><button class="icon-btn" data-close>✕</button></div>
      <form id="dish-form">
        <div class="field"><label>Nome</label><input id="d-name" type="text" value="${escapeHtml(d.name)}" required></div>
        <div class="field"><label>Descrição</label><textarea id="d-desc">${escapeHtml(d.description)}</textarea></div>
        <div class="field"><label>Categoria</label><input id="d-cat" type="text" value="${escapeHtml(d.category)}" placeholder="Ex.: Pratos Principais"></div>
        <div class="field"><label>Preço (R$)</label><input id="d-price" type="number" step="0.01" min="0" value="${d.price}"></div>
        <div class="field"><label class="role-switch" style="margin:0;"><input type="checkbox" id="d-av" ${d.available ? 'checked' : ''} style="width:auto;"> Disponível para o cliente</label></div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" data-close>Cancelar</button>
          <button type="submit" class="btn btn-primary">${existing ? 'Salvar' : 'Cadastrar'}</button>
        </div>
      </form>
    </div>`;
  document.body.appendChild(modal);
  modal.querySelectorAll('[data-close]').forEach(b => b.onclick = () => modal.remove());
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };

  document.getElementById('dish-form').onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: document.getElementById('d-name').value,
      description: document.getElementById('d-desc').value,
      category: document.getElementById('d-cat').value,
      price: document.getElementById('d-price').value,
      available: document.getElementById('d-av').checked
    };
    try {
      if (existing) {
        await api('/api/dishes/' + existing.id, { method: 'PUT', body: payload });
      } else {
        await api('/api/dishes', { method: 'POST', body: payload });
      }
      modal.remove();
      toast(existing ? 'Prato atualizado.' : 'Prato cadastrado.');
      await loadDishes();
      drawDishesRows(document.getElementById('view'));
    } catch (err) { toast(err.message, true); }
  };
}

// ============ Logout ============
document.getElementById('btn-logout').onclick = async () => {
  try { await api('/api/auth/logout', { method: 'POST' }); } catch (e) {}
  clearSession();
  state.view = null;
  render();
};

// ============ Inicialização ============
(async function init() {
  if (state.token) {
    try {
      const data = await api('/api/auth/me');
      state.user = data.user;
      state.role = data.user.role;
      state.view = data.user.role === 'manager' ? 'orders' : 'menu';
    } catch (e) {
      clearSession();
    }
  }
  render();
})();
