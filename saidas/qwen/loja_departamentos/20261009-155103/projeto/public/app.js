/* =============== Utilitários =============== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const BRL = n => 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = iso => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STATUS_LABEL = { pendente: 'Pendente', processando: 'Em processamento', enviado: 'Enviado', entregue: 'Entregue', cancelado: 'Cancelado' };

let state = {
  token: localStorage.getItem('mm_token') || null,
  user: JSON.parse(localStorage.getItem('mm_user') || 'null'),
  products: [],
  category: 'Todas',
  search: '',
  cart: JSON.parse(localStorage.getItem('mm_cart') || '[]')
};

/* =============== API =============== */
async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.token) headers.Authorization = 'Bearer ' + state.token;
  const res = await fetch('/api' + path, { ...opts, headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    if (res.status === 401 && path.startsWith('/api/auth') === false) {
      // sessão expirada
    }
    throw new Error((data && data.error) || 'Algo deu errado.');
  }
  return data;
}

function toast(msg, type = '') {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast show ' + type;
  clearTimeout(t._to);
  t._to = setTimeout(() => { t.className = 'toast'; }, 2600);
}

/* =============== Carrinho =============== */
function saveCart() { localStorage.setItem('mm_cart', JSON.stringify(state.cart)); updateCartUI(); }
function cartCount() { return state.cart.reduce((a, i) => a + i.quantity, 0); }
function cartTotal() { return state.cart.reduce((a, i) => a + i.price * i.quantity, 0); }
function addToCart(p, qty = 1) {
  if (p.stock <= 0) return;
  const ex = state.cart.find(i => i.productId === p.id);
  if (ex) ex.quantity = Math.min(ex.quantity + qty, p.stock);
  else state.cart.push({ productId: p.id, name: p.name, price: p.price, quantity: Math.min(qty, p.stock) });
  saveCart();
  toast('Adicionado ao carrinho!', 'ok');
  openDrawer();
}
function setCartQty(id, qty) {
  const it = state.cart.find(i => i.productId === id);
  if (!it) return;
  const p = state.products.find(x => x.id === id);
  const max = p ? p.stock : 99;
  it.quantity = Math.max(1, Math.min(qty, max));
  if (it.quantity <= 0) state.cart = state.cart.filter(i => i.productId !== id);
  saveCart(); renderDrawer();
}
function removeCartItem(id) { state.cart = state.cart.filter(i => i.productId !== id); saveCart(); renderDrawer(); }

function updateCartUI() {
  const c = cartCount();
  const b = $('#cartCount');
  b.hidden = c === 0; b.textContent = c;
  $('#drawerCount').textContent = c ? `(${c} ${c === 1 ? 'item' : 'itens'})` : '';
  $('#drawerTotal').textContent = BRL(cartTotal());
}

/* =============== Drawer carrinho =============== */
function openDrawer() { $('#drawerOverlay').hidden = false; requestAnimationFrame(() => $('#drawer').classList.add('open')); renderDrawer(); }
function closeDrawer() { $('#drawer').classList.remove('open'); setTimeout(() => $('#drawerOverlay').hidden = true, 280); }
function renderDrawer() {
  const body = $('#drawerBody');
  if (state.cart.length === 0) {
    body.innerHTML = '<div class="empty"><span class="big">🛒</span>Seu carrinho está vazio.<br>Que tal explorar nossas ofertas?</div>';
  } else {
    body.innerHTML = state.cart.map(i => `
      <div class="cart-item">
        <div class="ci-thumb">${esc(emojiFor(i.name))}</div>
        <div>
          <div class="ci-name">${esc(i.name)}</div>
          <div class="ci-price">${BRL(i.price)}</div>
        </div>
        <div class="ci-controls">
          <div class="ci-qty">
            <button data-qty="dec" data-id="${i.productId}">−</button>
            <span>${i.quantity}</span>
            <button data-qty="inc" data-id="${i.productId}">+</button>
          </div>
          <button class="ci-remove" data-remove="${i.productId}">Remover</button>
        </div>
      </div>`).join('');
  }
  $('#drawerBody').querySelectorAll('[data-qty]').forEach(b => {
    b.onclick = () => { const id = +b.dataset.id; const it = state.cart.find(x => x.productId === id); setCartQty(id, it.quantity + (b.dataset.qty === 'inc' ? 1 : -1)); };
  });
  $('#drawerBody').querySelectorAll('[data-remove]').forEach(b => b.onclick = () => removeCartItem(+b.dataset.remove));
  updateCartUI();
}

/* =============== Emoji por produto =============== */
function emojiFor(p) {
  if (p && p.image) return p.image;
  const map = { 'Eletrônicos': '📱', 'Cozinha': '🍳', 'Moda': '👕', 'Beleza': '💄', 'Esportes': '⚽', 'Livros': '📚', 'Lar': '🛏️', 'Infantil': '🧸' };
  return '🛍️';
}

/* =============== Sessão =============== */
function setSession(token, user) {
  state.token = token; state.user = user;
  localStorage.setItem('mm_token', token);
  localStorage.setItem('mm_user', JSON.stringify(user));
  renderUserChip();
}
function logout() {
  state.token = null; state.user = null;
  localStorage.removeItem('mm_token'); localStorage.removeItem('mm_user');
  renderUserChip();
  toast('Você saiu da conta.');
  location.hash = '#/';
}
function renderUserChip() {
  const chip = $('#userChip'), btn = $('#loginBtn');
  if (state.user) {
    chip.hidden = false; btn.hidden = true;
    $('#userName').textContent = state.user.name.split(' ')[0];
    $('#userAvatar').textContent = (state.user.name[0] || '?').toUpperCase();
  } else {
    chip.hidden = true; btn.hidden = false;
  }
}
function isAdmin() { return state.user && state.user.role === 'admin'; }

/* =============== Rotas =============== */
function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [name, param] = hash.split('/');
  switch (name) {
    case '': case 'home': return renderHome();
    case 'produto': return renderProduct(+param);
    case 'carrinho': return openDrawer();
    case 'checkout': return renderCheckout();
    case 'pedidos': case 'orders': return renderOrders();
    case 'admin': return renderAdmin();
    case 'login': return renderAuth('login');
    case 'cadastro': return renderAuth('register');
    default: return renderHome();
  }
}

/* =============== Home / Lista =============== */
function categories() {
  return ['Todas', ...new Set(state.products.map(p => p.category))];
}
function filteredProducts() {
  let list = state.products;
  if (state.category !== 'Todas') list = list.filter(p => p.category === state.category);
  const q = state.search.trim().toLowerCase();
  if (q) list = list.filter(p => (p.name + ' ' + p.category + ' ' + (p.description || '')).toLowerCase().includes(q));
  return list;
}
async function renderHome() {
  if (state.products.length === 0) await loadProducts();
  const app = $('#app');
  const cats = categories();
  app.innerHTML = `
    ${state.products.length ? `
    <section class="hero">
      <div class="hero-main">
        <span class="hero-kicker">🛍️ Departamento completo em um só lugar</span>
        <h1>Tudo o que você precisa, do eletrônico à decoração.</h1>
        <p>Milhares de produtos das melhores categorias, com preços justos e entrega rápida para todo o Brasil.</p>
        <button class="btn" data-link href="#/">Ver ofertas</button>
      </div>
      <div class="hero-side">
        <div class="hero-tile" title="Eletrônicos">📱</div>
        <div class="hero-tile" title="Moda">👟</div>
        <div class="hero-tile" title="Casa">🛏️</div>
        <div class="hero-tile" title="Beleza">💄</div>
      </div>
    </section>` : ''}
    <div class="chips">
      ${cats.map(c => `<button class="chip ${c === state.category ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    <h2 class="section-title">${state.category === 'Todas' ? 'Todos os produtos' : esc(state.category)} <small id="resultCount"></small></h2>
    <div class="grid" id="grid"></div>`;

  $$('#app .chip').forEach(c => c.onclick = () => { state.category = c.dataset.cat; renderHome(); });
  const grid = $('#grid');
  const list = filteredProducts();
  const rc = $('#resultCount'); if (rc) rc.textContent = list.length + (list.length === 1 ? ' produto' : ' produtos');
  if (list.length === 0) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1"><span class="big">🔍</span>Nenhum produto encontrado.</div>`;
  } else {
    grid.innerHTML = list.map(p => productCard(p)).join('');
    bindGrid(grid);
  }
}
function productCard(p) {
  const stockTxt = p.stock <= 0
    ? `<div class="card-stock out">Esgotado</div>`
    : p.stock <= 5 ? `<div class="card-stock low">Só ${p.stock} unidades!</div>`
    : `<div class="card-stock">Em estoque</div>`;
  const tag = p.stock <= 5 && p.stock > 0 ? `<span class="tag">Últimas unidades</span>` : '';
  return `
    <div class="card" data-id="${p.id}">
      ${tag}
      <div class="card-thumb">${esc(p.image || '🛍️')}</div>
      <div class="card-body">
        <span class="card-cat">${esc(p.category)}</span>
        <span class="card-name">${esc(p.name)}</span>
        <span class="card-price">${BRL(p.price)}</span>
        ${stockTxt}
        ${p.stock > 0 ? `<button class="btn btn-primary btn-sm" data-add="${p.id}">Adicionar 🛒</button>` : `<button class="btn btn-ghost btn-sm" disabled>Indisponível</button>`}
      </div>
    </div>`;
}
function bindGrid(grid) {
  grid.querySelectorAll('[data-add]').forEach(b => b.onclick = () => addToCart(state.products.find(p => p.id === +b.dataset.add)));
  grid.querySelectorAll('.card').forEach(c => c.onclick = e => { if (!e.target.closest('[data-add]')) location.hash = '#/produto/' + c.dataset.id; });
}

/* =============== Detalhe produto =============== */
function renderProduct(id) {
  const p = state.products.find(x => x.id === id);
  const app = $('#app');
  if (!p) { app.innerHTML = '<div class="empty"><span class="big">❓</span>Produto não encontrado.</div>'; return; }
  app.innerHTML = `
    <a class="back" data-link href="#/">← Voltar ao catálogo</a>
    <div class="detail">
      <div class="detail-thumb">${esc(p.image || '🛍️')}</div>
      <div>
        <span class="card-cat">${esc(p.category)}</span>
        <h1 class="detail-name">${esc(p.name)}</h1>
        <p class="detail-desc">${esc(p.description || 'Sem descrição.')}</p>
        <div class="card-price" style="font-size:2rem">${BRL(p.price)}</div>
        <div class="card-stock" style="margin-top:8px">${p.stock > 0 ? `${p.stock} unidades em estoque` : 'Produto esgotado'}</div>
        <div class="qty-row" id="pQtyRow" style="${p.stock > 0 ? '' : 'display:none'}">
          <div class="qty">
            <button id="pDec">−</button><span id="pQty">1</span><button id="pInc">+</button>
          </div>
          <span class="muted">Quantidade</span>
        </div>
        <button class="btn btn-primary" id="pAdd" style="${p.stock > 0 ? '' : 'display:none'}">Adicionar ao carrinho 🛒</button>
      </div>
    </div>`;
  if (p.stock > 0) {
    let q = 1; const el = $('#pQty');
    const upd = () => { el.textContent = q; };
    $('#pInc').onclick = () => { q = Math.min(q + 1, p.stock); upd(); };
    $('#pDec').onclick = () => { q = Math.max(1, q - 1); upd(); };
    $('#pAdd').onclick = () => addToCart(p, q);
  }
}

/* =============== Checkout =============== */
function renderCheckout() {
  const app = $('#app');
  if (!state.user) { location.hash = '#/login?next=checkout'; return; }
  if (state.cart.length === 0) {
    app.innerHTML = '<div class="empty"><span class="big">🛒</span>Seu carrinho está vazio.</div>';
    return;
  }
  app.innerHTML = `
    <h2 class="section-title">Finalizar Pedido</h2>
    <div class="checkout">
      <div class="panel">
        <h3>Dados de entrega</h3>
        <div id="formMsg"></div>
        <div class="field"><label>Nome completo</label><input id="fName" value="${esc(state.user.name)}" /></div>
        <div class="field"><label>E-mail</label><input id="fEmail" type="email" placeholder="voce@email.com" /></div>
        <div class="field"><label>Telefone</label><input id="fPhone" placeholder="(00) 00000-0000" /></div>
        <div class="field"><label>Endereço (rua, número, bairro, cidade/UF)</label><textarea id="fAddr" rows="3" placeholder="Rua Exemplo, 123 - Bairro - Cidade/UF"></textarea></div>
        <div class="field">
          <label>Forma de pagamento</label>
          <select id="fPay">
            <option value="pix">Pix (aprovação imediata)</option>
            <option value="cartao">Cartão de crédito</option>
            <option value="boleto">Boleto bancário</option>
          </select>
          <div class="hint">Pagamento simulado — nenhum valor real é cobrado.</div>
        </div>
        <button class="btn btn-primary btn-block" id="placeOrder">Confirmar pedido</button>
      </div>
      <div class="panel checkout-summary">
        <h3>Resumo</h3>
        ${state.cart.map(i => `<div class="sum-item"><span>${esc(i.name)} × ${i.quantity}</span><span>${BRL(i.price * i.quantity)}</span></div>`).join('')}
        <div class="sum-total"><span>Total</span><span>${BRL(cartTotal())}</span></div>
      </div>
    </div>`;

  $('#placeOrder').onclick = async () => {
    const name = $('#fName').value.trim(), email = $('#fEmail').value.trim(), phone = $('#fPhone').value.trim(), address = $('#fAddr').value.trim();
    const msg = $('#formMsg');
    if (!name || !address) { msg.innerHTML = '<div class="form-error">Preencha nome e endereço.</div>'; return; }
    const btn = $('#placeOrder');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Processando...';
    try {
      const order = await api('/orders', { method: 'POST', body: { items: state.cart, customer: { name, email, phone, address, payment: $('#fPay').value } } });
      state.cart = []; saveCart();
      toast('Pedido realizado com sucesso! 🎉', 'ok');
      location.hash = '#/pedidos';
    } catch (e) {
      msg.innerHTML = `<div class="form-error">${esc(e.message)}</div>`;
      btn.disabled = false; btn.textContent = 'Confirmar pedido';
    }
  };
}

/* =============== Pedidos do cliente =============== */
async function renderOrders() {
  const app = $('#app');
  if (!state.user) { location.hash = '#/login?next=orders'; return; }
  app.innerHTML = '<div class="empty">Carregando seus pedidos...</div>';
  let orders;
  try { orders = await api('/orders'); } catch (e) { app.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  app.innerHTML = `<h2 class="section-title">Meus Pedidos <small>${orders.length}</small></h2>` +
    (orders.length === 0
      ? '<div class="empty"><span class="big">📦</span>Você ainda não fez nenhum pedido.<br><button class="btn btn-primary" style="margin-top:14px" data-link href="#/">Começar a comprar</button></div>'
      : `<div class="orders-list">${orders.map(orderCard).join('')}</div>`);
}
function orderCard(o) {
  return `
    <div class="order-card">
      <div class="order-head">
        <div>
          <div class="order-code">${esc(o.code)}</div>
          <div class="order-date">📅 ${fmtDate(o.createdAt)}</div>
        </div>
        <span class="status ${o.status}">${STATUS_LABEL[o.status] || o.status}</span>
      </div>
      <div class="order-items">
        ${o.items.map(it => `<div class="oi"><span>${esc(it.name)} × ${it.quantity}</span><span>${BRL(it.price * it.quantity)}</span></div>`).join('')}
      </div>
      <div class="order-foot">
        <span class="muted">Pagamento: ${esc(o.payment || '-')}</span>
        <span class="order-total">${BRL(o.total)}</span>
      </div>
    </div>`;
}

/* =============== Login / Cadastro =============== */
function renderAuth(mode) {
  const next = location.hash.split('next=')[1] || 'home';
  const app = $('#app');
  app.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-logo"><div class="logo"><span class="logo-mark">M</span><span class="logo-text">Mega<span class="accent">Mall</span></span></div></div>
      <div class="auth-card">
        <div class="auth-tabs">
          <button class="auth-tab ${mode === 'login' ? 'active' : ''}" data-mode="login">Entrar</button>
          <button class="auth-tab ${mode === 'register' ? 'active' : ''}" data-mode="register">Criar conta</button>
        </div>
        <div id="authMsg"></div>
        <form id="authForm">
          ${mode === 'register' ? '<div class="field"><label>Nome completo</label><input id="aName" required placeholder="Seu nome" /></div>' : ''}
          <div class="field"><label>Usuário</label><input id="aUser" required placeholder="seu_usuario" /></div>
          <div class="field"><label>Senha</label><input id="aPass" type="password" required placeholder="••••••••" /></div>
          <button class="btn btn-primary btn-block" type="submit">${mode === 'login' ? 'Entrar' : 'Criar minha conta'}</button>
        </form>
        <p class="auth-note">${mode === 'login' ? 'Novo por aqui? Toque em <b>Criar conta</b> acima.' : 'Já tem conta? Toque em <b>Entrar</b> acima.'}</p>
      </div>
    </div>`;
  $$('.auth-tab').forEach(t => t.onclick = () => { location.hash = '#/' + (t.dataset.mode === 'login' ? 'login' : 'cadastro'); });
  $('#authForm').onsubmit = async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const msg = $('#authMsg');
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Um instante...';
    try {
      const body = { username: $('#aUser').value.trim(), password: $('#aPass').value };
      if (mode === 'register') body.name = $('#aName').value.trim();
      const data = await api(mode === 'login' ? '/auth/login' : '/auth/register', { method: 'POST', body });
      setSession(data.token, data.user);
      toast(mode === 'login' ? 'Bem-vindo(a), ' + data.user.name.split(' ')[0] + '!' : 'Conta criada com sucesso!', 'ok');
      location.hash = '#' + (isAdmin() ? 'admin' : 'home');
    } catch (err) {
      msg.innerHTML = `<div class="form-error">${esc(err.message)}</div>`;
      btn.disabled = false; btn.textContent = mode === 'login' ? 'Entrar' : 'Criar minha conta';
    }
  };
}

/* =============== Painel Admin =============== */
async function renderAdmin(tab = 'produtos') {
  const app = $('#app');
  if (!isAdmin()) { location.hash = '#/login'; return; }
  await loadProducts();
  const tabs = { produtos: '📦 Produtos', pedidos: '🧾 Pedidos', vendas: '📊 Vendas' };
  app.innerHTML = `
    <h2 class="section-title">Painel do Lojista</h2>
    <div class="admin-tabs">
      ${Object.entries(tabs).map(([k, l]) => `<button class="chip ${tab === k ? 'active' : ''}" data-tab="${k}">${l}</button>`).join('')}
    </div>
    <div id="adminBody"></div>`;
  $$('#app .chip[data-tab]').forEach(c => c.onclick = () => renderAdmin(c.dataset.tab));
  $('#adminBody').innerHTML = tab === 'produtos' ? adminProducts() : tab === 'pedidos' ? '<div class="empty">Carregando...</div>' : '<div class="empty">Carregando...</div>';
  if (tab === 'produtos') bindAdminProducts();
  if (tab === 'pedidos') await loadAdminOrders();
  if (tab === 'vendas') await loadAdminStats();
}

/* --- Produtos admin --- */
function adminProducts() {
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <h3 style="margin:0">Produtos cadastrados (${state.products.length})</h3>
      <button class="btn btn-primary btn-sm" id="newProduct">+ Novo produto</button>
    </div>
    <div id="productFormBox"></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th></th><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th style="width:130px">Ações</th></tr></thead>
        <tbody id="ptBody"></tbody>
      </table>
    </div>`;
}
function bindAdminProducts() {
  renderProductRows();
  const box = $('#productFormBox');
  $('#newProduct').onclick = () => showProductForm(box, null);
  $('#ptBody').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = +b.dataset.id;
    const p = state.products.find(x => x.id === id);
    if (b.dataset.act === 'edit') showProductForm(box, p);
    if (b.dataset.act === 'del') {
      if (confirm('Remover "' + p.name + '"? Esta ação não pode ser desfeita.')) {
        api('/products/' + id, { method: 'DELETE' }).then(() => { loadProducts().then(() => { renderProductRows(); toast('Produto removido.', 'ok'); }); }).catch(err => toast(err.message, 'err'));
      }
    }
  });
}
function renderProductRows() {
  const tb = $('#ptBody'); if (!tb) return;
  tb.innerHTML = state.products.map(p => `
    <tr>
      <td class="table-emoji">${esc(p.image || '🛍️')}</td>
      <td>${esc(p.name)}</td>
      <td>${esc(p.category)}</td>
      <td>${BRL(p.price)}</td>
      <td>${p.stock}</td>
      <td class="row-actions">
        <button class="btn btn-ghost btn-sm" data-act="edit" data-id="${p.id}">Editar</button>
        <button class="btn btn-danger btn-sm" data-act="del" data-id="${p.id}">Excluir</button>
      </td>
    </tr>`).join('');
}
function showProductForm(box, p) {
  const isNew = !p;
  box.innerHTML = `
    <div class="panel" style="margin-bottom:18px">
      <h3>${isNew ? 'Novo produto' : 'Editar produto'}</h3>
      <div class="form-error" id="pfErr" style="display:none"></div>
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:12px">
        <div class="field"><label>Nome</label><input id="pfName" value="${p ? esc(p.name) : ''}" /></div>
        <div class="field"><label>Categoria</label><input id="pfCat" value="${p ? esc(p.category) : ''}" list="catList" placeholder="Ex: Eletrônicos" /></div>
        <div class="field"><label>Emoji / Ícone</label><input id="pfImg" value="${p ? esc(p.image) : ''}" placeholder="📱" /></div>
      </div>
      <datalist id="catList">${categories().filter(c => c !== 'Todas').map(c => `<option value="${esc(c)}">`).join('')}</datalist>
      <div class="field"><label>Descrição</label><textarea id="pfDesc" rows="2">${p ? esc(p.description) : ''}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="field"><label>Preço (R$)</label><input id="pfPrice" type="number" min="0" step="0.01" value="${p ? p.price : ''}" /></div>
        <div class="field"><label>Estoque</label><input id="pfStock" type="number" min="0" value="${p ? p.stock : ''}" /></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-primary" id="pfSave">${isNew ? 'Cadastrar' : 'Salvar alterações'}</button>
        <button class="btn btn-ghost" id="pfCancel">Cancelar</button>
      </div>
    </div>`;
  $('#pfCancel').onclick = () => { box.innerHTML = ''; };
  $('#pfSave').onclick = async () => {
    const body = {
      name: $('#pfName').value.trim(), category: $('#pfCat').value.trim(),
      description: $('#pfDesc').value.trim(), price: Number($('#pfPrice').value),
      stock: Number($('#pfStock').value), image: $('#pfImg').value.trim() || '🛍️'
    };
    const errEl = $('#pfErr');
    if (!body.name || !body.category) { errEl.style.display = 'block'; errEl.textContent = 'Nome e categoria são obrigatórios.'; return; }
    try {
      if (isNew) await api('/products', { method: 'POST', body });
      else await api('/products/' + p.id, { method: 'PUT', body });
      await loadProducts();
      box.innerHTML = ''; renderProductRows(); toast('Produto salvo!', 'ok');
    } catch (e) { errEl.style.display = 'block'; errEl.textContent = e.message; }
  };
}

/* --- Pedidos admin --- */
async function loadAdminOrders() {
  const box = $('#adminBody');
  let orders; try { orders = await api('/orders'); } catch (e) { box.innerHTML = `<div class="empty">${esc(e.message)}</div>`; return; }
  box.innerHTML = orders.length === 0
    ? '<div class="empty"><span class="big">🧾</span>Nenhum pedido ainda.</div>'
    : `<div class="table-wrap"><table>
        <thead><tr><th>Código</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Quando</th><th>Situação</th></tr></thead>
        <tbody id="ordBody"></tbody></table></div>`;
  const tb = $('#ordBody');
  tb.innerHTML = orders.map(o => `
    <tr>
      <td><b>${esc(o.code)}</b></td>
      <td>${esc(o.customer?.name || '-')}${o.customer?.phone ? '<br><small class="muted">' + esc(o.customer.phone) + '</small>' : ''}</td>
      <td>${o.items.reduce((a, i) => a + i.quantity, 0)}</td>
      <td><b>${BRL(o.total)}</b></td>
      <td><small class="muted">${fmtDate(o.createdAt)}</small></td>
      <td>
        <select class="admin-select" data-status="${o.id}">
          ${['pendente', 'processando', 'enviado', 'entregue', 'cancelado'].map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${STATUS_LABEL[s]}</option>`).join('')}
        </select>
        <details class="table-actions"><summary>Detalhes</summary>
          <div class="order-items" style="margin-top:8px;max-width:260px">
            ${o.items.map(i => `<div class="oi"><span>${esc(i.name)} × ${i.quantity}</span><span>${BRL(i.price * i.quantity)}</span></div>`).join('')}
          </div>
          <div class="muted" style="font-size:.85rem;margin-top:8px">📍 ${esc(o.customer?.address || 'sem endereço')}<br>💳 ${esc(o.payment || '-')}</div>
        </details>
      </td>
    </tr>`).join('');
  $$('#ordBody [data-status]').forEach(sel => sel.onchange = async () => {
    try { await api('/orders/' + sel.dataset.status + '/status', { method: 'PATCH', body: { status: sel.value } }); toast('Situação atualizada.', 'ok'); }
    catch (e) { toast(e.message, 'err'); }
  });
}

/* --- Vendas admin --- */
async function loadAdminStats() {
  const box = $('#adminBody');
  let orders = await api('/orders').catch(() => []);
  const valid = orders.filter(o => o.status !== 'cancelado');
  const revenue = valid.reduce((a, o) => a + o.total, 0);
  const byStatus = {};
  orders.forEach(o => byStatus[o.status] = (byStatus[o.status] || 0) + 1);
  box.innerHTML = `
    <div class="stat-row">
      <div class="stat"><div class="num">${BRL(revenue)}</div><div class="lbl">Faturamento (sem cancelados)</div></div>
      <div class="stat"><div class="num">${orders.length}</div><div class="lbl">Pedidos no total</div></div>
      <div class="stat"><div class="num">${valid.length}</div><div class="lbl">Pedidos válidos</div></div>
      <div class="stat"><div class="num">${state.products.length}</div><div class="lbl">Produtos ativos</div></div>
    </div>
    <div class="panel">
      <h3>Pedidos por situação</h3>
      ${Object.keys(STATUS_LABEL).map(s => `<div class="sum-item"><span><span class="status ${s}">${STATUS_LABEL[s]}</span></span><span>${byStatus[s] || 0}</span></div>`).join('')}
    </div>`;
}

/* =============== Bootstrap =============== */
async function loadProducts() {
  if (!state.token) {
    try { state.products = await api('/products'); return; } catch (e) { state.products = []; return; }
  }
  try { state.products = await api('/products'); } catch (e) { state.products = []; }
}

function init() {
  $('#year').textContent = new Date().getFullYear();
  renderUserChip();
  updateCartUI();

  $('#menuBtn').onclick = () => location.hash = '#/';
  $('#cartBtn').onclick = openDrawer;
  $('#drawerClose').onclick = closeDrawer;
  $('#drawerOverlay').onclick = closeDrawer;
  $('#checkoutBtn').onclick = () => {
    closeDrawer();
    if (!state.user) location.hash = '#/login?next=checkout';
    else location.hash = '#/checkout';
  };

  const onSearch = v => { state.search = v; if (location.hash === '' || location.hash === '#/' || location.hash === '#') renderHome(); };
  const s1 = $('#searchInput'), s2 = $('#searchInputMobile');
  s1.oninput = () => onSearch(s1.value);
  s2.oninput = () => onSearch(s2.value);

  window.addEventListener('hashchange', route);

  // Sessão: carrega produtos e vai para o início (ou admin se for lojista)
  loadProducts().then(() => {
    if (isAdmin() && location.hash === '') location.hash = '#/admin';
    else route();
  });
}
document.addEventListener('DOMContentLoaded', init);
