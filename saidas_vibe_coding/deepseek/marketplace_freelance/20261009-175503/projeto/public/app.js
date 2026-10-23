// ---------- Utilidades ----------
const $ = sel => document.querySelector(sel);
const app = $('#app');

function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

async function api(url, options = {}) {
  options.headers = Object.assign(
    { 'Content-Type': 'application/json' },
    options.headers || {}
  );
  if (options.body && typeof options.body === 'object') {
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, options);
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || 'Erro na operação');
  return data;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function money(n) {
  return 'R$ ' + Number(n || 0).toFixed(2).replace('.', ',');
}

function fmtDate(s) {
  if (!s) return '-';
  const d = new Date(s);
  return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ---------- Estado ----------
let currentUser = null;
let currentPage = 'home';

// ---------- Auth UI ----------
async function loadMe() {
  try {
    const data = await api('/api/me');
    currentUser = data.user;
  } catch (e) { currentUser = null; }
  renderAuth();
  renderNav();
}

function renderAuth() {
  const area = $('#authArea');
  if (currentUser) {
    area.innerHTML = `
      <span class="user-chip">Olá, <strong>${escapeHtml(currentUser.name)}</strong>${currentUser.role === 'admin' ? ' (admin)' : ''}</span>
      <button class="secondary small" onclick="logout()">Sair</button>
    `;
  } else {
    area.innerHTML = `
      <button class="small" onclick="go('login')">Entrar</button>
      <button class="secondary small" onclick="go('register')">Cadastre-se</button>
    `;
  }
}

function renderNav() {
  document.querySelectorAll('nav a').forEach(a => {
    const page = a.dataset.page;
    a.classList.toggle('active', page === currentPage);
  });
  const adminLink = document.querySelector('#navAdmin');
  if (!currentUser || currentUser.role !== 'admin') {
    adminLink.style.display = 'none';
  } else {
    adminLink.style.display = 'inline';
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  currentUser = null;
  renderAuth();
  renderNav();
  go('home');
}

// ---------- Roteamento ----------
function go(page, params = {}) {
  currentPage = page;
  renderNav();
  const pages = {
    home: renderHome,
    login: renderLogin,
    register: renderRegister,
    explore: renderExplore,
    publish: renderPublish,
    contracts: renderContracts,
    admin: renderAdmin,
  };
  (pages[page] || renderHome)(params);
  window.scrollTo(0, 0);
}

// ---------- Páginas ----------
async function renderHome() {
  if (!currentUser) {
    app.innerHTML = `
      <div class="card" style="text-align:center;padding:40px 20px;">
        <h1>Encontre o freelancer certo para o seu projeto</h1>
        <p class="subtitle">Publique seus serviços ou contrate talentos em minutos.</p>
        <div class="actions" style="justify-content:center;">
          <button onclick="go('register')">Criar conta grátis</button>
          <button class="secondary" onclick="go('login')">Já tenho conta</button>
        </div>
      </div>
      <div class="grid" style="margin-top:20px;">
        <div class="card"><h3>Publicar serviço</h3><p>Divulgue o que você faz e receba propostas.</p></div>
        <div class="card"><h3>Contratar</h3><p>Encontre profissionais e feche o serviço.</p></div>
        <div class="card"><h3>Acompanhar</h3><p>Gerencie todos os seus contratos em um só lugar.</p></div>
      </div>`;
    return;
  }
  app.innerHTML = `
    <h1>Bem-vindo(a), ${escapeHtml(currentUser.name)}!</h1>
    <p class="subtitle">O que você deseja fazer hoje?</p>
    <div class="grid">
      <div class="card">
        <h3>Explorar serviços</h3>
        <p>Veja o que outros usuários estão oferecendo.</p>
        <div class="actions"><button onclick="go('explore')">Explorar</button></div>
      </div>
      <div class="card">
        <h3>Publicar um serviço</h3>
        <p>Anuncie o serviço que você oferece.</p>
        <div class="actions"><button onclick="go('publish')">Publicar</button></div>
      </div>
      <div class="card">
        <h3>Meus contratos</h3>
        <p>Acompanhe contratos como cliente ou prestador.</p>
        <div class="actions"><button onclick="go('contracts')">Ver contratos</button></div>
      </div>
    </div>`;
}

function renderLogin() {
  app.innerHTML = `
    <div class="form-narrow card">
      <h1>Entrar</h1>
      <form onsubmit="doLogin(event)">
        <label>E-mail</label>
        <input type="email" id="loginEmail" required />
        <label>Senha</label>
        <input type="password" id="loginPassword" required />
        <div class="actions" style="margin-top:16px;">
          <button type="submit">Entrar</button>
          <button type="button" class="secondary" onclick="go('register')">Criar conta</button>
        </div>
      </form>
    </div>`;
}

async function doLogin(e) {
  e.preventDefault();
  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: {
        email: $('#loginEmail').value,
        password: $('#loginPassword').value,
      },
    });
    currentUser = data.user;
    renderAuth(); renderNav();
    toast('Bem-vindo(a), ' + currentUser.name, 'success');
    go('home');
  } catch (err) { toast(err.message, 'error'); }
}

function renderRegister() {
  app.innerHTML = `
    <div class="form-narrow card">
      <h1>Criar conta</h1>
      <form onsubmit="doRegister(event)">
        <label>Nome completo</label>
        <input type="text" id="regName" required />
        <label>E-mail</label>
        <input type="email" id="regEmail" required />
        <label>Senha (mín. 4 caracteres)</label>
        <input type="password" id="regPassword" required minlength="4" />
        <label>Tipo de conta</label>
        <select id="regRole">
          <option value="client">Quero contratar serviços</option>
          <option value="freelancer">Quero oferecer serviços</option>
        </select>
        <div class="actions" style="margin-top:16px;">
          <button type="submit">Criar conta</button>
          <button type="button" class="secondary" onclick="go('login')">Já tenho conta</button>
        </div>
      </form>
    </div>`;
}

async function doRegister(e) {
  e.preventDefault();
  try {
    const data = await api('/api/register', {
      method: 'POST',
      body: {
        name: $('#regName').value,
        email: $('#regEmail').value,
        password: $('#regPassword').value,
        role: $('#regRole').value,
      },
    });
    currentUser = data.user;
    renderAuth(); renderNav();
    toast('Conta criada com sucesso!', 'success');
    go('home');
  } catch (err) { toast(err.message, 'error'); }
}

async function renderExplore() {
  if (!currentUser) return go('login');
  app.innerHTML = '<p>Carregando serviços...</p>';
  try {
    const { services } = await api('/api/services');
    const approved = services.filter(s => s.status === 'approved');
    if (!approved.length) {
      app.innerHTML = `
        <h1>Explorar serviços</h1>
        <div class="empty">Nenhum serviço disponível ainda. Volte mais tarde!</div>`;
      return;
    }
    app.innerHTML = `
      <h1>Explorar serviços</h1>
      <p class="subtitle">${approved.length} serviço(s) disponível(is).</p>
      <div class="grid">
        ${approved.map(s => `
          <div class="card service-card">
            <h3>${escapeHtml(s.title)}</h3>
            <div class="owner">Por ${escapeHtml(s.owner?.name || 'Usuário')} • ${escapeHtml(s.category)}</div>
            <p>${escapeHtml(s.description)}</p>
            <div class="price">${money(s.price)}</div>
            <div class="actions">
              <button onclick="openContract('${s.id}')">Contratar</button>
            </div>
          </div>
        `).join('')}
      </div>`;
  } catch (err) {
    app.innerHTML = '<div class="empty">Erro ao carregar serviços.</div>';
  }
}

function openContract(serviceId) {
  const modal = document.createElement('div');
  modal.className = 'card';
  modal.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:50;width:90%;max-width:440px;box-shadow:0 10px 40px rgba(0,0,0,.3);';
  modal.innerHTML = `
    <h3>Contratar serviço</h3>
    <p class="subtitle">Envie uma mensagem opcional para o prestador.</p>
    <label>Mensagem (opcional)</label>
    <textarea id="contractMsg" rows="3" placeholder="Olá, tenho interesse..."></textarea>
    <div class="actions" style="margin-top:14px;">
      <button class="success" onclick="submitContract('${serviceId}')">Confirmar contratação</button>
      <button class="secondary" onclick="this.closest('.card').remove()">Cancelar</button>
    </div>`;
  document.body.appendChild(modal);
}

async function submitContract(serviceId) {
  try {
    const msg = document.querySelector('#contractMsg')?.value || '';
    await api('/api/contracts', { method: 'POST', body: { serviceId, message: msg } });
    document.querySelectorAll('.card').forEach(c => {
      if (c.style.position === 'fixed') c.remove();
    });
    toast('Contrato criado com sucesso!', 'success');
    go('contracts');
  } catch (err) { toast(err.message, 'error'); }
}

function renderPublish() {
  if (!currentUser) return go('login');
  app.innerHTML = `
    <div class="form-narrow card">
      <h1>Publicar serviço</h1>
      <p class="subtitle">Seu serviço será analisado pela administração antes de aparecer.</p>
      <form onsubmit="doPublish(event)">
        <label>Título</label>
        <input type="text" id="svcTitle" required placeholder="Ex: Criação de sites" />
        <label>Categoria</label>
        <input type="text" id="svcCategory" placeholder="Ex: Design, Programação" />
        <label>Descrição</label>
        <textarea id="svcDescription" rows="4" required placeholder="Descreva o serviço..."></textarea>
        <label>Preço (R$)</label>
        <input type="number" id="svcPrice" min="0" step="0.01" value="0" />
        <div class="actions" style="margin-top:16px;">
          <button type="submit">Enviar para aprovação</button>
        </div>
      </form>
    </div>`;

  loadMyServices();
}

async function loadMyServices() {
  try {
    const { services } = await api('/api/services/mine');
    const box = document.createElement('div');
    box.innerHTML = `
      <h2>Meus serviços publicados</h2>
      <div class="grid" id="myServices">
        ${services.length ? services.map(s => `
          <div class="card service-card">
            <div><span class="badge ${s.status}">${s.status === 'pending' ? 'Aguardando' : s.status === 'approved' ? 'Aprovado' : 'Rejeitado'}</span></div>
            <h3>${escapeHtml(s.title)}</h3>
            <p>${escapeHtml(s.description)}</p>
            <div class="price">${money(s.price)}</div>
            <div class="actions">
              <button class="danger small" onclick="deleteService('${s.id}')">Remover</button>
            </div>
          </div>
        `).join('') : '<p class="empty">Você ainda não publicou nenhum serviço.</p>'}
      </div>`;
    app.appendChild(box);
  } catch (e) {}
}

async function doPublish(e) {
  e.preventDefault();
  try {
    await api('/api/services', {
      method: 'POST',
      body: {
        title: $('#svcTitle').value,
        category: $('#svcCategory').value,
        description: $('#svcDescription').value,
        price: $('#svcPrice').value,
      },
    });
    toast('Serviço enviado para aprovação!', 'success');
    renderPublish();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteService(id) {
  if (!confirm('Tem certeza que deseja remover este serviço?')) return;
  try {
    await api('/api/services/' + id, { method: 'DELETE' });
    toast('Serviço removido.', 'success');
    renderPublish();
  } catch (err) { toast(err.message, 'error'); }
}

async function renderContracts() {
  if (!currentUser) return go('login');
  app.innerHTML = '<p>Carregando contratos...</p>';
  try {
    const { contracts } = await api('/api/contracts');
    if (!contracts.length) {
      app.innerHTML = `
        <h1>Meus contratos</h1>
        <div class="empty">Você ainda não participa de nenhum contrato.</div>`;
      return;
    }
    app.innerHTML = `
      <h1>Meus contratos</h1>
      <p class="subtitle">${contracts.length} contrato(s) encontrado(s).</p>
      ${contracts.map(c => {
        const isClient = c.clientId === currentUser.id;
        const other = isClient ? c.provider : c.client;
        const otherRole = isClient ? 'Prestador' : 'Cliente';
        return `
          <div class="card">
            <div class="section-head">
              <h3>${escapeHtml(c.serviceTitle)}</h3>
              <span class="badge ${c.status}">${c.status === 'pending' ? 'Pendente' : c.status === 'accepted' ? 'Aceito' : c.status === 'declined' ? 'Recusado' : c.status === 'completed' ? 'Concluído' : 'Cancelado'}</span>
            </div>
            <p><strong>${otherRole}:</strong> ${escapeHtml(other?.name || '-')}</p>
            <p><strong>Valor:</strong> ${money(c.price)}</p>
            ${c.message ? `<p><strong>Mensagem:</strong> ${escapeHtml(c.message)}</p>` : ''}
            <p class="subtitle" style="margin-top:6px;">Criado em ${fmtDate(c.createdAt)}</p>
            <div class="actions">
              ${isClient && c.status === 'pending' ? `<button class="danger small" onclick="setContractStatus('${c.id}','cancelled')">Cancelar</button>` : ''}
              ${!isClient && c.status === 'pending' ? `
                <button class="success small" onclick="setContractStatus('${c.id}','accepted')">Aceitar</button>
                <button class="danger small" onclick="setContractStatus('${c.id}','declined')">Recusar</button>
              ` : ''}
              ${c.status === 'accepted' && isClient ? `<button class="success small" onclick="setContractStatus('${c.id}','completed')">Marcar como concluído</button>` : ''}
            </div>
          </div>`;
      }).join('')}`;
  } catch (err) {
    app.innerHTML = '<div class="empty">Erro ao carregar contratos.</div>';
  }
}

async function setContractStatus(id, status) {
  try {
    await api('/api/contracts/' + id + '/status', { method: 'POST', body: { status } });
    toast('Status atualizado.', 'success');
    renderContracts();
  } catch (err) { toast(err.message, 'error'); }
}

// ---------- Admin ----------
let adminTab = 'services';

async function renderAdmin() {
  if (!currentUser || currentUser.role !== 'admin') {
    app.innerHTML = '<div class="empty">Acesso restrito.</div>';
    return;
  }
  app.innerHTML = `
    <h1>Painel administrativo</h1>
    <p class="subtitle">Gerencie usuários, serviços e contratos.</p>
    <div class="tabs">
      <button class="${adminTab === 'services' ? 'active' : ''}" onclick="setAdminTab('services')">Serviços</button>
      <button class="${adminTab === 'users' ? 'active' : ''}" onclick="setAdminTab('users')">Usuários</button>
      <button class="${adminTab === 'contracts' ? 'active' : ''}" onclick="setAdminTab('contracts')">Contratos</button>
    </div>
    <div id="adminContent">Carregando...</div>`;
  loadAdminTab();
}

function setAdminTab(t) {
  adminTab = t;
  renderAdmin();
}

async function loadAdminTab() {
  const box = $('#adminContent');
  try {
    if (adminTab === 'services') {
      const { services } = await api('/api/admin/services');
      if (!services.length) { box.innerHTML = '<div class="empty">Nenhum serviço cadastrado.</div>'; return; }
      box.innerHTML = `
        <table>
          <thead><tr><th>Título</th><th>Dono</th><th>Preço</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${services.map(s => `
              <tr>
                <td>${escapeHtml(s.title)}</td>
                <td>${escapeHtml(s.owner?.name || '-')}</td>
                <td>${money(s.price)}</td>
                <td><span class="badge ${s.status}">${s.status}</span></td>
                <td class="actions">
                  ${s.status !== 'approved' ? `<button class="success small" onclick="adminApprove('${s.id}')">Aprovar</button>` : ''}
                  ${s.status !== 'rejected' ? `<button class="secondary small" onclick="adminReject('${s.id}')">Rejeitar</button>` : ''}
                  <button class="danger small" onclick="adminDeleteService('${s.id}')">Remover</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    } else if (adminTab === 'users') {
      const { users } = await api('/api/admin/users');
      box.innerHTML = `
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Status</th><th>Ações</th></tr></thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td>${escapeHtml(u.name)}</td>
                <td>${escapeHtml(u.email)}</td>
                <td>${u.role}</td>
                <td>${u.suspended ? '<span class="badge suspended">Suspenso</span>' : '<span class="badge approved">Ativo</span>'}</td>
                <td class="actions">
                  ${u.role !== 'admin' ? `<button class="${u.suspended ? 'success' : 'danger'} small" onclick="adminToggleSuspend('${u.id}')">${u.suspended ? 'Reativar' : 'Suspender'}</button>` : '—'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    } else {
      const { contracts } = await api('/api/admin/contracts');
      if (!contracts.length) { box.innerHTML = '<div class="empty">Nenhum contrato.</div>'; return; }
      box.innerHTML = `
        <table>
          <thead><tr><th>Serviço</th><th>Cliente</th><th>Prestador</th><th>Valor</th><th>Status</th><th>Data</th></tr></thead>
          <tbody>
            ${contracts.map(c => `
              <tr>
                <td>${escapeHtml(c.serviceTitle)}</td>
                <td>${escapeHtml(c.client?.name || '-')}</td>
                <td>${escapeHtml(c.provider?.name || '-')}</td>
                <td>${money(c.price)}</td>
                <td><span class="badge ${c.status}">${c.status}</span></td>
                <td>${fmtDate(c.createdAt)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>`;
    }
  } catch (err) {
    box.innerHTML = '<div class="empty">Erro ao carregar dados.</div>';
  }
}

async function adminApprove(id) {
  try { await api('/api/services/' + id + '/approve', { method: 'POST' }); toast('Serviço aprovado.', 'success'); loadAdminTab(); }
  catch (e) { toast(e.message, 'error'); }
}
async function adminReject(id) {
  try { await api('/api/services/' + id + '/reject', { method: 'POST' }); toast('Serviço rejeitado.', 'success'); loadAdminTab(); }
  catch (e) { toast(e.message, 'error'); }
}
async function adminDeleteService(id) {
  if (!confirm('Remover este serviço permanentemente?')) return;
  try { await api('/api/services/' + id, { method: 'DELETE' }); toast('Serviço removido.', 'success'); loadAdminTab(); }
  catch (e) { toast(e.message, 'error'); }
}
async function adminToggleSuspend(id) {
  try { await api('/api/admin/users/' + id + '/suspend', { method: 'POST' }); toast('Status atualizado.', 'success'); loadAdminTab(); }
  catch (e) { toast(e.message, 'error'); }
}

// ---------- Inicialização ----------
(async function init() {
  await loadMe();
  go('home');
})();
