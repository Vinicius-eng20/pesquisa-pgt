// ================= Estado =================
let me = null;
let currentView = '';

// ================= Utilidades =================
async function api(url, method = 'GET', body = null) {
  const opts = { method, headers: {} };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Erro inesperado.');
  return data;
}

function toast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3500);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z');
  return d.toLocaleDateString('pt-BR');
}

function openModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); }

// ================= Autenticação =================
function showTab(tab) {
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
  document.getElementById('auth-msg').textContent = '';
}

function authMsg(msg, isError = true) {
  const el = document.getElementById('auth-msg');
  el.textContent = msg;
  el.className = 'msg ' + (isError ? 'error' : 'ok');
}

async function doLogin(e) {
  e.preventDefault();
  try {
    await api('/api/login', 'POST', {
      username: document.getElementById('login-username').value,
      password: document.getElementById('login-password').value
    });
    await init();
  } catch (err) { authMsg(err.message); }
  return false;
}

async function doRegister(e) {
  e.preventDefault();
  try {
    await api('/api/register', 'POST', {
      name: document.getElementById('reg-name').value,
      username: document.getElementById('reg-username').value,
      password: document.getElementById('reg-password').value
    });
    await init();
  } catch (err) { authMsg(err.message); }
  return false;
}

async function doLogout() {
  await api('/api/logout', 'POST');
  location.reload();
}

function openChangePassword() {
  openModal(`
    <h2>Trocar senha</h2>
    <form onsubmit="return submitChangePassword(event)">
      <label>Senha atual</label>
      <input type="password" id="cp-current" required>
      <label>Nova senha</label>
      <input type="password" id="cp-new" required>
      <button class="btn primary full">Salvar nova senha</button>
    </form>
  `);
}
async function submitChangePassword(e) {
  e.preventDefault();
  try {
    await api('/api/change-password', 'POST', {
      current: document.getElementById('cp-current').value,
      newPassword: document.getElementById('cp-new').value
    });
    closeModal();
    toast('Senha alterada com sucesso!', 'ok');
  } catch (err) { toast(err.message, 'error'); }
  return false;
}

// ================= Inicialização =================
async function init() {
  me = await api('/api/me');
  if (!me.logged) {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-screen').classList.add('hidden');
    return;
  }
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('main-screen').classList.remove('hidden');
  document.getElementById('user-info').textContent =
    `${me.name} — ${me.role === 'librarian' ? '👔 Bibliotecário(a)' : '📖 Leitor(a)'}`;
  buildMenu();
  showView(me.role === 'librarian' ? 'items' : 'catalog');
}

function buildMenu() {
  const menu = document.getElementById('menu');
  if (me.role === 'librarian') {
    menu.innerHTML = `
      <button data-view="items" onclick="showView('items')">📦 Acervo</button>
      <button data-view="add-item" onclick="showView('add-item')">➕ Cadastrar item</button>
      <button data-view="all-loans" onclick="showView('all-loans')">📋 Empréstimos</button>
      <button data-view="readers" onclick="showView('readers')">👥 Leitores</button>
      <button data-view="add-librarian" onclick="showView('add-librarian')">👔 Novo bibliotecário</button>
    `;
  } else {
    menu.innerHTML = `
      <button data-view="catalog" onclick="showView('catalog')">🔍 Buscar no acervo</button>
      <button data-view="my-loans" onclick="showView('my-loans')">📚 Meus empréstimos</button>
    `;
  }
}

function setActiveMenu(view) {
  currentView = view;
  document.querySelectorAll('#menu button').forEach(b =>
    b.classList.toggle('active', b.dataset.view === view));
}

async function showView(view) {
  setActiveMenu(view);
  const c = document.getElementById('content');
  c.innerHTML = '<p class="empty">Carregando...</p>';
  try {
    if (view === 'catalog') await renderCatalog(c, false);
    else if (view === 'my-loans') await renderMyLoans(c);
    else if (view === 'items') await renderCatalog(c, true);
    else if (view === 'add-item') renderItemForm(c);
    else if (view === 'all-loans') await renderAllLoans(c);
    else if (view === 'readers') await renderReaders(c);
    else if (view === 'add-librarian') renderLibrarianForm(c);
  } catch (err) {
    c.innerHTML = `<p class="empty">Erro: ${esc(err.message)}</p>`;
  }
}

// ================= ACERVO (leitor e bibliotecário) =================
async function renderCatalog(c, isAdmin) {
  const q = sessionStorage.getItem('lastSearch') || '';
  c.innerHTML = `
    <h2 class="section-title">${isAdmin ? '📦 Acervo' : '🔍 Buscar no acervo'}</h2>
    ${!isAdmin && me.restricted ? `<div class="alert-box">⚠️ ${esc(me.restrictionReason)}</div>` : ''}
    <div class="search-bar">
      <input type="text" id="search-input" placeholder="Buscar por título, autor, tipo..." value="${esc(q)}"
        onkeyup="if(event.key==='Enter') doSearch(${isAdmin})">
      <button class="btn primary" onclick="doSearch(${isAdmin})">Buscar</button>
      <button class="btn" onclick="clearSearch(${isAdmin})">Limpar</button>
    </div>
    <div id="items-area"></div>
  `;
  await loadItems(isAdmin, q);
}

async function doSearch(isAdmin) {
  const q = document.getElementById('search-input').value;
  sessionStorage.setItem('lastSearch', q);
  await loadItems(isAdmin, q);
}
async function clearSearch(isAdmin) {
  document.getElementById('search-input').value = '';
  sessionStorage.setItem('lastSearch', '');
  await loadItems(isAdmin, '');
}

async function loadItems(isAdmin, q) {
  const items = await api('/api/items' + (q ? '?q=' + encodeURIComponent(q) : ''));
  const area = document.getElementById('items-area');
  if (!items.length) {
    area.innerHTML = '<p class="empty">Nenhum item encontrado no acervo.</p>';
    return;
  }
  area.innerHTML = '<div class="cards">' + items.map(it => {
    const avail = it.available;
    const badge = avail > 0
      ? `<span class="badge green">${avail} disponível(is)</span>`
      : `<span class="badge red">Indisponível</span>`;
    let actions = '';
    if (isAdmin) {
      actions = `
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn small" onclick="editItem(${it.id})">✏️ Editar</button>
          <button class="btn small danger" onclick="deleteItem(${it.id}, '${esc(it.title)}')">🗑️ Remover</button>
        </div>`;
    } else {
      const canBorrow = avail > 0 && !me.restricted;
      actions = `
        <button class="btn small ${canBorrow ? 'primary' : ''}" ${canBorrow ? '' : 'disabled'}
          onclick="borrowItem(${it.id})">📖 Pegar emprestado</button>`;
    }
    return `
      <div class="card">
        <h3>${esc(it.title)}</h3>
        <div class="meta">
          ${it.author ? '✍️ ' + esc(it.author) + ' · ' : ''}
          <span class="badge blue">${esc(it.type)}</span>
          ${it.year ? ' · ' + esc(it.year) : ''}
        </div>
        ${it.description ? `<div class="desc">${esc(it.description)}</div>` : ''}
        <div>${badge} <span class="meta">(${it.quantity} exemplar(es) no total)</span></div>
        ${actions}
      </div>`;
  }).join('') + '</div>';
}

// ================= Leitor: empréstimos =================
async function borrowItem(id) {
  try {
    const r = await api('/api/loans', 'POST', { itemId: id });
    toast(r.message, 'ok');
    showView('catalog');
  } catch (err) { toast(err.message, 'error'); }
}

async function renderMyLoans(c) {
  const loans = await api('/api/my-loans');
  const active = loans.filter(l => l.status === 'active');
  const past = loans.filter(l => l.status === 'returned');
  c.innerHTML = `
    <h2 class="section-title">📚 Meus empréstimos</h2>
    ${me.restricted ? `<div class="alert-box">⚠️ ${esc(me.restrictionReason)}</div>` : ''}
    <h3 style="margin:10px 0;">Em andamento (${active.length})</h3>
    ${active.length ? `
      <div class="table-wrap"><table>
        <tr><th>Item</th><th>Retirado em</th><th>Devolver até</th><th>Situação</th><th></th></tr>
        ${active.map(l => `
          <tr class="${l.overdue ? 'overdue-row' : ''}">
            <td><b>${esc(l.title)}</b><br><small>${esc(l.type)}</small></td>
            <td>${fmtDate(l.loan_date)}</td>
            <td>${fmtDate(l.due_date)}</td>
            <td>${l.overdue ? '<span class="badge red">Em atraso!</span>' : '<span class="badge green">No prazo</span>'}</td>
            <td><button class="btn small success" onclick="returnItem(${l.id})">Devolver</button></td>
          </tr>`).join('')}
      </table></div>` : '<p class="empty">Você não tem itens emprestados no momento.</p>'}
    <h3 style="margin:22px 0 10px;">Histórico de devolvidos (${past.length})</h3>
    ${past.length ? `
      <div class="table-wrap"><table>
        <tr><th>Item</th><th>Retirado em</th><th>Devolvido em</th></tr>
        ${past.map(l => `
          <tr>
            <td><b>${esc(l.title)}</b></td>
            <td>${fmtDate(l.loan_date)}</td>
            <td>${fmtDate(l.return_date)}</td>
          </tr>`).join('')}
      </table></div>` : '<p class="empty">Nenhum item devolvido ainda.</p>'}
  `;
}

async function returnItem(id) {
  try {
    const r = await api(`/api/loans/${id}/return`, 'POST');
    toast(r.message, 'ok');
    me = await api('/api/me');
    showView('my-loans');
  } catch (err) { toast(err.message, 'error'); }
}

// ================= Bibliotecário: cadastro/edição de itens =================
function renderItemForm(c, item = null) {
  c.innerHTML = `
    <h2 class="section-title">${item ? '✏️ Editar item' : '➕ Cadastrar novo item'}</h2>
    <form onsubmit="return submitItem(event, ${item ? item.id : 'null'})" style="max-width:520px;">
      <label>Título *</label>
      <input type="text" id="it-title" required value="${esc(item?.title || '')}">
      <label>Autor / Diretor / Editora</label>
      <input type="text" id="it-author" value="${esc(item?.author || '')}">
      <label>Tipo de item</label>
      <select id="it-type">
        ${['Livro', 'Revista', 'DVD', 'CD', 'Jogo', 'Gibigibi', 'Outro'].map(t =>
          `<option ${item?.type === t ? 'selected' : ''}>${t}</option>`).join('')}
      </select>
      <label>Ano</label>
      <input type="text" id="it-year" value="${esc(item?.year || '')}">
      <label>Quantidade de exemplares *</label>
      <input type="number" id="it-qty" min="1" value="${item?.quantity || 1}" required>
      <label>Descrição</label>
      <textarea id="it-desc" rows="3">${esc(item?.description || '')}</textarea>
      <button class="btn primary full">${item ? 'Salvar alterações' : 'Cadastrar item'}</button>
      ${item ? `<button type="button" class="btn full" onclick="showView('items')">Cancelar</button>` : ''}
    </form>
  `;
}

async function submitItem(e, id) {
  e.preventDefault();
  const body = {
    title: document.getElementById('it-title').value,
    author: document.getElementById('it-author').value,
    type: document.getElementById('it-type').value,
    year: document.getElementById('it-year').value,
    quantity: parseInt(document.getElementById('it-qty').value) || 1,
    description: document.getElementById('it-desc').value
  };
  try {
    if (id) await api('/api/items/' + id, 'PUT', body);
    else await api('/api/items', 'POST', body);
    toast(id ? 'Item atualizado!' : 'Item cadastrado!', 'ok');
    showView('items');
  } catch (err) { toast(err.message, 'error'); }
  return false;
}

async function editItem(id) {
  const items = await api('/api/items');
  const item = items.find(i => i.id === id);
  if (!item) return toast('Item não encontrado.', 'error');
  renderItemForm(document.getElementById('content'), item);
  window.scrollTo(0, 0);
}

async function deleteItem(id, title) {
  if (!confirm(`Remover "${title}" do acervo?\nEssa ação não pode ser desfeita.`)) return;
  try {
    await api('/api/items/' + id, 'DELETE');
    toast('Item removido.', 'ok');
    showView('items');
  } catch (err) { toast(err.message, 'error'); }
}

// ================= Bibliotecário: empréstimos e leitores =================
async function renderAllLoans(c) {
  c.innerHTML = `
    <h2 class="section-title">📋 Todos os empréstimos</h2>
    <div class="search-bar">
      <select id="loan-filter" onchange="loadAllLoans()">
        <option value="all">Todos</option>
        <option value="active">Em andamento</option>
        <option value="overdue">Em atraso</option>
        <option value="returned">Devolvidos</option>
      </select>
    </div>
    <div id="loans-area"></div>
  `;
  await loadAllLoans();
}

async function loadAllLoans() {
  const filter = document.getElementById('loan-filter').value;
  const loans = await api('/api/loans?filter=' + filter);
  const area = document.getElementById('loans-area');
  if (!loans.length) { area.innerHTML = '<p class="empty">Nenhum empréstimo encontrado.</p>'; return; }
  area.innerHTML = `
    <div class="table-wrap"><table>
      <tr><th>Leitor</th><th>Item</th><th>Retirado</th><th>Prazo</th><th>Devolução</th><th>Situação</th></tr>
      ${loans.map(l => `
        <tr class="${l.overdue ? 'overdue-row' : ''}">
          <td><b>${esc(l.reader_name)}</b><br><small>@${esc(l.reader_username)}</small></td>
          <td>${esc(l.item_title)}<br><small>${esc(l.item_type)}</small></td>
          <td>${fmtDate(l.loan_date)}</td>
          <td>${fmtDate(l.due_date)}</td>
          <td>${l.return_date ? fmtDate(l.return_date) : '—'}</td>
          <td>${l.status === 'returned'
            ? '<span class="badge gray">Devolvido</span>'
            : l.overdue ? '<span class="badge red">Em atraso</span>' : '<span class="badge green">No prazo</span>'}</td>
        </tr>`).join('')}
    </table></div>`;
}

async function renderReaders(c) {
  const readers = await api('/api/readers');
  c.innerHTML = `
    <h2 class="section-title">👥 Leitores cadastrados</h2>
    ${!readers.length ? '<p class="empty">Nenhum leitor cadastrado ainda.</p>' : `
    <div class="table-wrap"><table>
      <tr><th>Nome</th><th>Usuário</th><th>Emprestados</th><th>Em atraso</th><th>Situação</th><th>Ações</th></tr>
      ${readers.map(r => {
        const restricted = r.blocked || r.overdue_loans > 0;
        const sit = r.blocked ? '<span class="badge red">Bloqueado</span>'
          : r.overdue_loans > 0 ? '<span class="badge orange">Bloqueio automático (atraso)</span>'
          : '<span class="badge green">Liberado</span>';
        return `
          <tr>
            <td><b>${esc(r.name)}</b></td>
            <td>@${esc(r.username)}</td>
            <td>${r.active_loans}</td>
            <td>${r.overdue_loans > 0 ? `<span class="badge red">${r.overdue_loans}</span>` : '0'}</td>
            <td>${sit}</td>
            <td>
              <button class="btn small ${r.blocked ? 'success' : 'warning'}"
                onclick="toggleBlock(${r.id})">${r.blocked ? '✅ Desbloquear' : '🚫 Bloquear'}</button>
              <button class="btn small" onclick="viewReaderLoans('${esc(r.username)}')">📋 Histórico</button>
            </td>
          </tr>`;
      }).join('')}
    </table></div>`}
    <p class="hint" style="text-align:left;margin-top:14px;">
      💡 Leitores com itens em atraso ficam automaticamente impedidos de pegar novos itens até devolverem.
      O bloqueio manual impede novos empréstimos mesmo sem atraso.
    </p>
  `;
}

async function toggleBlock(id) {
  try {
    const r = await api(`/api/readers/${id}/block`, 'POST');
    toast(r.blocked ? 'Leitor bloqueado.' : 'Leitor desbloqueado.', 'ok');
    showView('readers');
  } catch (err) { toast(err.message, 'error'); }
}

async function viewReaderLoans(username) {
  const loans = await api('/api/loans?filter=all');
  const mine = loans.filter(l => l.reader_username === username);
  openModal(`
    <h2>📋 Histórico de @${esc(username)}</h2>
    ${!mine.length ? '<p class="empty">Nenhum empréstimo registrado.</p>' : `
    <div class="table-wrap" style="margin-top:14px;"><table>
      <tr><th>Item</th><th>Retirado</th><th>Prazo</th><th>Devolução</th><th>Situação</th></tr>
      ${mine.map(l => `
        <tr class="${l.overdue ? 'overdue-row' : ''}">
          <td>${esc(l.item_title)}</td>
          <td>${fmtDate(l.loan_date)}</td>
          <td>${fmtDate(l.due_date)}</td>
          <td>${l.return_date ? fmtDate(l.return_date) : '—'}</td>
          <td>${l.status === 'returned' ? '<span class="badge gray">Devolvido</span>'
            : l.overdue ? '<span class="badge red">Atraso</span>' : '<span class="badge green">No prazo</span>'}</td>
        </tr>`).join('')}
    </table></div>`}
  `);
}

// ================= Bibliotecário: novo bibliotecário =================
function renderLibrarianForm(c) {
  c.innerHTML = `
    <h2 class="section-title">👔 Cadastrar novo bibliotecário</h2>
    <form onsubmit="return submitLibrarian(event)" style="max-width:420px;">
      <label>Nome completo *</label>
      <input type="text" id="lib-name" required>
      <label>Nome de usuário *</label>
      <input type="text" id="lib-username" required>
      <label>Senha *</label>
      <input type="password" id="lib-password" required>
      <button class="btn primary full">Cadastrar bibliotecário</button>
    </form>
  `;
}

async function submitLibrarian(e) {
  e.preventDefault();
  try {
    await api('/api/librarians', 'POST', {
      name: document.getElementById('lib-name').value,
      username: document.getElementById('lib-username').value,
      password: document.getElementById('lib-password').value
    });
    toast('Bibliotecário cadastrado!', 'ok');
    document.getElementById('lib-name').value = '';
    document.getElementById('lib-username').value = '';
    document.getElementById('lib-password').value = '';
  } catch (err) { toast(err.message, 'error'); }
  return false;
}

// ================= Start =================
init();
