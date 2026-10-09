/* ========================================================= *
 *  Marketplace de Freelancers — SPA
 * ========================================================= */
const API = {
  token: localStorage.getItem('ml_token') || null,
  user: JSON.parse(localStorage.getItem('ml_user') || 'null'),
  setSession(token, user) {
    this.token = token;
    this.user = user;
    if (token) {
      localStorage.setItem('ml_token', token);
      localStorage.setItem('ml_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('ml_token');
      localStorage.removeItem('ml_user');
    }
  },
  logout() { this.setSession(null, null); }
};

const state = {
  route: 'home',
  data: {
    publicServicos: [],
    meusServicos: [],
    meusContratos: [],
    adminServicos: [],
    adminContratos: [],
    adminUsuarios: []
  },
  filtro: { q: '', cat: '' },
  authTab: 'login',
  adminTab: 'servicos'
};

const CATEGORIAS = [
  { id: 'design',     nome: 'Design',        cor: '#ff5a1f' },
  { id: 'dev',        nome: 'Desenvolvimento', cor: '#1e5fd9' },
  { id: 'marketing',  nome: 'Marketing',     cor: '#0f8a5f' },
  { id: 'escrita',    nome: 'Escrita',       cor: '#7c3aed' },
  { id: 'financas',   nome: 'Finanças',      cor: '#b77a00' },
  { id: 'traducao',   nome: 'Tradução',      cor: '#0891b2' },
  { id: 'educacao',   nome: 'Educação',      cor: '#db2777' },
  { id: 'outro',      nome: 'Outros',        cor: '#6b6f78' }
];

const categoriaPorId = id => CATEGORIAS.find(c => c.id === id) || { nome: id, cor: '#6b6f78' };
const corInicial = s => {
  const palette = ['#ff5a1f','#1e5fd9','#0f8a5f','#7c3aed','#db2777','#b77a00','#0891b2'];
  let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
};

/* ---------------------------------- *
 *  Helpers de UI
 * ---------------------------------- */
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function esc(s) {
  return String(s ?? '')
    .replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

function iniciais(nome = '') {
  const p = String(nome).trim().split(/\s+/).slice(0, 2);
  return p.map(x => x[0]).join('').toUpperCase() || '?';
}

function moeda(v) {
  const n = Number(v || 0);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function dataRelativa(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `há ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `há ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `há ${Math.floor(diff / 86400)} d`;
  return d.toLocaleDateString('pt-BR');
}

function toast(msg, tipo = 'info') {
  const icons = {
    success: 'M5 12l5 5L20 7',
    error:   'M6 6l12 12M18 6L6 18',
    info:    'M12 8v4m0 4h.01'
  };
  const t = el(`
    <div class="toast toast--${tipo}" role="status">
      <span class="toast__icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="${icons[tipo] || icons.info}"/>
        </svg>
      </span>
      <div class="toast__msg">${esc(msg)}</div>
    </div>
  `);
  $('#toastStack').appendChild(t);
  setTimeout(() => {
    t.classList.add('is-leaving');
    setTimeout(() => t.remove(), 220);
  }, 3600);
}

function api(path, opts = {}) {
  const headers = opts.headers || {};
  if (opts.body && typeof opts.body !== 'string') headers['Content-Type'] = 'application/json';
  if (API.token) headers['Authorization'] = 'Bearer ' + API.token;
  return fetch('/api' + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  }).then(async res => {
    let data = null;
    try { data = await res.json(); } catch { data = {}; }
    if (!res.ok) {
      const err = new Error(data.erro || 'Erro');
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  });
}

/* ---------------------------------- *
 *  Navegação e layout
 * ---------------------------------- */
const PAGES = ['home', 'explorar', 'meus-servicos', 'publicar', 'contratos', 'admin', 'conta', 'auth'];

function navegar(rot) {
  state.route = rot;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  renderNav();
  renderPage();
  fecharMenuMobile();
}

function fecharMenuMobile() {
  $('#navToggle')?.classList.remove('is-open');
  $('#mainNav')?.classList.remove('is-open');
}

function renderNav() {
  const nav = $('#mainNav');
  const userBox = $('#userBox');
  const btnAuth = $('#btnAuthTop');
  const isAdmin = API.user?.role === 'admin';
  const links = [];

  if (API.user) {
    links.push({ id: 'explorar', label: 'Explorar' });
    if (isAdmin) {
      links.push({ id: 'admin', label: 'Administração', badge: 'A' });
    } else {
      links.push({ id: 'publicar', label: 'Publicar' });
      links.push({ id: 'meus-servicos', label: 'Meus serviços' });
      const pend = state.data.meusContratos.filter(c => c.status === 'pendente' && c.prestadorId === API.user.id).length;
      links.push({ id: 'contratos', label: 'Meus contratos', badge: pend || null });
    }
    links.push({ id: 'conta', label: 'Minha conta' });
  } else {
    links.push({ id: 'explorar', label: 'Explorar serviços' });
  }

  nav.innerHTML = links.map(l => `
    <a class="nav-link ${state.route === l.id ? 'is-active' : ''}" href="#" data-nav="${l.id}">
      ${esc(l.label)}
      ${l.badge ? `<span class="badge ${l.badge === 'A' ? '' : 'badge--accent'}">${l.badge === 'A' ? '★' : l.badge}</span>` : ''}
    </a>
  `).join('');
  $$('.nav-link', nav).forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    navegar(a.dataset.nav);
  }));

  if (API.user) {
    userBox.hidden = false;
    btnAuth.hidden = true;
    userBox.innerHTML = `
      <span class="avatar" style="background:${corInicial(API.user.nome)}">${esc(iniciais(API.user.nome))}</span>
      <div style="display:flex;flex-direction:column;line-height:1.1">
        <span class="userbox__name">${esc(API.user.nome)}</span>
      </div>
      <span class="userbox__role userbox__role--${API.user.role}">${API.user.role === 'admin' ? 'admin' : 'membro'}</span>
    `;
  } else {
    userBox.hidden = true;
    btnAuth.hidden = false;
  }
}

function renderPage() {
  const root = $('#app');
  const pag = state.route;
  if (!API.user && !['home', 'explorar', 'auth'].includes(pag)) {
    state.route = 'auth';
    return renderPage();
  }
  root.innerHTML = '';
  let page;
  switch (pag) {
    case 'home':         page = renderHome(); break;
    case 'explorar':     page = renderExplorar(); break;
    case 'meus-servicos':page = renderMeusServicos(); break;
    case 'publicar':     page = renderPublicar(); break;
    case 'contratos':    page = renderContratos(); break;
    case 'admin':        page = renderAdmin(); break;
    case 'conta':        page = renderConta(); break;
    case 'auth':         page = renderAuth(); break;
    default:             page = renderHome();
  }
  page.classList.add('page', 'is-active');
  root.appendChild(page);

  // dados
  if (pag === 'home') carregarHome();
  if (pag === 'explorar') carregarExplorar();
  if (pag === 'meus-servicos') carregarMeus();
  if (pag === 'contratos') carregarContratos();
  if (pag === 'admin') carregarAdmin();
  if (pag === 'conta' && API.user?.role === 'admin') carregarConteudoAdmin();
}

/* ---------------------------------- *
 *  Home
 * ---------------------------------- */
async function carregarHome() {
  try {
    const r = await api('/servicos/publicos');
    state.data.publicServicos = r.servicos;
    $('#footerStats').textContent = `${r.servicos.length} serviços ativos`;
    // Popula cards de destaque na home
    const grid = $$('.home-featured', $('#app'));
    if (grid.length) {
      const top = r.servicos.slice(0, 4);
      grid.forEach((g, i) => {
        const s = top[i];
        if (!s) { g.innerHTML = emptyHTML('Nenhum serviço ainda'); return; }
        g.innerHTML = serviceCardHTML(s);
        g.querySelector('.service-card').addEventListener('click', () => abrirModalServico(s));
      });
    }
    // stats
    const total = r.servicos.length;
    const cats = new Set(r.servicos.map(s => s.categoria)).size;
    const sellers = new Set(r.servicos.map(s => s.prestadorId)).size;
    const stats = $$('.home-stat', $('#app'));
    if (stats.length) {
      stats[0].textContent = total;
      stats[1].textContent = cats;
      stats[2].textContent = sellers;
    }
  } catch (e) {
    console.error(e);
  }
}

function renderHome() {
  return el(`
    <section class="hero">
      <div class="hero__left">
        <span class="hero__eyebrow">Plataforma ativa · dados salvos no próprio site</span>
        <h1 class="hero__title">Encontre quem faz o trabalho<br/>ou <em>ofereça</em> o seu.</h1>
        <p class="hero__lead">
          Um marketplace de serviços freelance com tudo dentro do próprio site:
          publique, contrate e acompanhe seus contratos — sem depender de serviços externos.
        </p>
        <div class="hero__cta">
          ${API.user
            ? `<a href="#" data-nav="${API.user.role === 'admin' ? 'admin' : 'publicar'}" class="btn btn--primary">${API.user.role === 'admin' ? 'Ir para o painel' : 'Publicar um serviço'}</a>`
            : `<a href="#" data-nav="auth" class="btn btn--primary">Começar agora</a>`}
          <a href="#" data-nav="explorar" class="btn btn--ghost">Explorar serviços</a>
        </div>
        <div class="hero__scroll">
          <div class="scroll-card">
            <div class="scroll-card__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
            </div>
            <h4>Publique seu serviço</h4>
            <p>Descreva o que você faz, o preço e a forma de pagamento.</p>
          </div>
          <div class="scroll-card">
            <div class="scroll-card__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
            </div>
            <h4>Contrate com confiança</h4>
            <p>Aprovação de serviços e contratos com status claro.</p>
          </div>
          <div class="scroll-card">
            <div class="scroll-card__icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8l3 3M19 5l-3 3M8 16l-3 3"/></svg>
            </div>
            <h4>Painel de administração</h4>
            <p>Aprovações, remoções, suspensões e visão completa.</p>
          </div>
        </div>
      </div>
      <div class="hero__right">
        <div class="stat-tile stat-tile--accent">
          <span class="stat-tile__label">Serviços ativos</span>
          <span class="stat-tile__value home-stat">0</span>
          <span class="stat-tile__hint">disponíveis agora</span>
        </div>
        <div class="stat-tile">
          <span class="stat-tile__label">Categorias</span>
          <span class="stat-tile__value home-stat">0</span>
          <span class="stat-tile__hint">áreas diferentes</span>
        </div>
        <div class="stat-tile">
          <span class="stat-tile__label">Prestadores</span>
          <span class="stat-tile__value home-stat">0</span>
          <span class="stat-tile__hint">pessoas oferecendo</span>
        </div>
        <div class="stat-tile">
          <span class="stat-tile__label">100% local</span>
          <span class="stat-tile__value" style="font-size:24px">✓</span>
          <span class="stat-tile__hint">dados no próprio site</span>
        </div>
      </div>
    </section>
    <section style="margin-top:32px">
      <div class="page-header">
        <div>
          <h2 class="page-header__title">Em destaque</h2>
          <p class="page-header__sub">Serviços aprovados por ordem mais recentes.</p>
        </div>
        <a href="#" data-nav="explorar" class="btn btn--ghost">Ver todos</a>
      </div>
      <div class="service-grid">
        <div class="home-featured"></div>
        <div class="home-featured"></div>
        <div class="home-featured"></div>
        <div class="home-featured"></div>
      </div>
    </section>
  `);
}

/* ---------------------------------- *
 *  Explorar
 * ---------------------------------- */
async function carregarExplorar() {
  try {
    const r = await api('/servicos/publicos');
    state.data.publicServicos = r.servicos;
    const grid = $('.service-grid', $('#app'));
    if (grid) grid.innerHTML = filtrarServicos(state.data.publicServicos)
      .map(s => serviceCardHTML(s)).join('')
      || emptyHTML('Nenhum serviço encontrado para esse filtro.');
    $$('.service-card', grid).forEach(card => {
      card.addEventListener('click', () => {
        const s = state.data.publicServicos.find(x => x.id === card.dataset.id);
        if (s) abrirModalServico(s);
      });
    });
  } catch (e) { console.error(e); }
}

function filtrarServicos(lista) {
  const { q, cat } = state.filtro;
  return lista.filter(s => {
    if (cat && s.categoria !== cat) return false;
    if (q) {
      const t = (s.titulo + ' ' + s.descricao + ' ' + (s.prestador?.nome || '')).toLowerCase();
      if (!t.includes(q.toLowerCase())) return false;
    }
    return true;
  });
}

function serviceCardHTML(s) {
  const c = categoriaPorId(s.categoria);
  const me = API.user?.id === s.prestadorId;
  return `
    <article class="service-card" data-id="${esc(s.id)}" style="--cat-color:${esc(c.cor)}">
      <div class="service-card__head">
        <span class="service-card__cat">${esc(c.nome)}</span>
        <span class="status-pill status-pill--aprovado">aprovado</span>
      </div>
      <h3 class="service-card__title">${esc(s.titulo)}</h3>
      <p class="service-card__desc">${esc(s.descricao)}</p>
      <div class="service-card__foot">
        <div class="service-card__price">
          <span class="service-card__price-label">${esc(s.formaPagamento || 'Preço')}</span>
          <span class="service-card__price-value">${moeda(s.preco)}</span>
        </div>
        <div class="service-card__seller">
          <span class="avatar avatar--sm" style="background:${corInicial(s.prestador?.nome || '?')}">${esc(iniciais(s.prestador?.nome))}</span>
          ${esc(s.prestador?.nome || 'Anônimo')}
        </div>
      </div>
      ${!me ? `<div class="service-card__actions">
        <button class="btn btn--primary btn--small" data-acao="contratar">Contratar</button>
      </div>` : ''}
    </article>
  `;
}

function emptyHTML(msg) {
  return `
    <div class="empty" style="grid-column:1/-1">
      <div class="empty__icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
      </div>
      <h4>Nada por aqui</h4>
      <p>${esc(msg)}</p>
    </div>
  `;
}

function renderExplorar() {
  const chips = ['<button class="chip is-active" data-cat="">Todas</button>']
    .concat(CATEGORIAS.map(c => `<button class="chip" data-cat="${esc(c.id)}">${esc(c.nome)}</button>`)).join('');
  return el(`
    <div class="page-header">
      <div>
        <h2 class="page-header__title">Explorar serviços</h2>
        <p class="page-header__sub">Todos os serviços aprovados por outros usuários da plataforma.</p>
      </div>
    </div>
    <div class="toolbar">
      <div class="search-box">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input type="search" id="searchInput" placeholder="Buscar por título, descrição ou prestador…" />
      </div>
      <div class="chips" id="chips">${chips}</div>
    </div>
    <div class="service-grid" id="serviceGrid"></div>
  `);
}

/* ---------------------------------- *
 *  Publicar serviço
 * ---------------------------------- */
function renderPublicar() {
  const cats = CATEGORIAS.map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('');
  return el(`
    <div class="page-header">
      <div>
        <h2 class="page-header__title">Publicar serviço</h2>
        <p class="page-header__sub">Depois de publicado, o serviço fica <strong>pendente</strong> até ser aprovado pela administração.</p>
      </div>
    </div>
    <form class="form-card" id="formPublicar" novalidate>
      <div class="field">
        <label for="fTitulo">Título do serviço</label>
        <input id="fTitulo" name="titulo" type="text" required minlength="4" placeholder="Ex.: Criação de logo para startups" />
        <div class="field__hint">Mínimo de 4 caracteres.</div>
      </div>
      <div class="form-row">
        <div class="field">
          <label for="fCat">Categoria</label>
          <select id="fCat" name="categoria">${cats}</select>
        </div>
        <div class="field">
          <label for="fPreco">Preço</label>
          <input id="fPreco" name="preco" type="number" min="0" step="0.01" placeholder="Ex.: 150.00" />
          <div class="field__hint">Valor em reais (BRL).</div>
        </div>
      </div>
      <div class="field">
        <label for="fForma">Forma de pagamento</label>
        <select id="fForma" name="formaPagamento">
          <option>Por hora</option>
          <option>Por projeto</option>
          <option>Mensal</option>
          <option>A combinar</option>
        </select>
      </div>
      <div class="field">
        <label for="fDesc">Descrição</label>
        <textarea id="fDesc" name="descricao" required minlength="10" placeholder="Explique o que você oferece, como trabalha, prazos, o que está incluso…"></textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" data-nav="meus-servicos">Cancelar</button>
        <button type="submit" class="btn btn--primary">Publicar serviço</button>
      </div>
    </form>
  `);
}

async function submitPublicar(e) {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/servicos', {
      method: 'POST',
      body: {
        titulo: f.titulo.value,
        categoria: f.categoria.value,
        descricao: f.descricao.value,
        preco: Number(f.preco.value || 0),
        formaPagamento: f.formaPagamento.value
      }
    });
    toast('Serviço publicado! Aguardando aprovação da administração.', 'success');
    navegar('meus-servicos');
  } catch (err) {
    toast(err.message || 'Erro ao publicar.', 'error');
  }
}

/* ---------------------------------- *
 *  Meus serviços (usuário)
 * ---------------------------------- */
async function carregarMeus() {
  try {
    const [s, c] = await Promise.all([api('/servicos/meus'), api('/contratos/meus')]);
    state.data.meusServicos = s.servicos;
    state.data.meusContratos = c.contratos;
    renderNav(); // para atualizar o badge
    const grid = $('#meusGrid');
    const cards = state.data.meusServicos.map(s => {
      const c = categoriaPorId(s.categoria);
      return `
        <article class="service-card" data-id="${esc(s.id)}" style="--cat-color:${esc(c.cor)}">
          <div class="service-card__head">
            <span class="service-card__cat">${esc(c.nome)}</span>
            <span class="status-pill status-pill--${esc(s.status)}">${esc(s.status)}</span>
          </div>
          <h3 class="service-card__title">${esc(s.titulo)}</h3>
          <p class="service-card__desc">${esc(s.descricao)}</p>
          <div class="service-card__foot">
            <div class="service-card__price">
              <span class="service-card__price-label">${esc(s.formaPagamento || 'Preço')}</span>
              <span class="service-card__price-value">${moeda(s.preco)}</span>
            </div>
            <div class="service-card__actions" style="margin-top:0">
              <button class="btn btn--subtle btn--small" data-acao="ver">Ver</button>
            </div>
          </div>
        </article>
      `;
    }).join('') || emptyHTML('Você ainda não publicou nenhum serviço.');
    grid.innerHTML = cards;
    $$('.service-card', grid).forEach(card => {
      card.addEventListener('click', () => {
        const s = state.data.meusServicos.find(x => x.id === card.dataset.id);
        if (s) abrirModalServico(s, { meu: true });
      });
    });
  } catch (e) { console.error(e); }
}

function renderMeusServicos() {
  return el(`
    <div class="page-header">
      <div>
        <h2 class="page-header__title">Meus serviços</h2>
        <p class="page-header__sub">Todos os serviços que você publicou, com o status atual.</p>
      </div>
      <div class="page-header__actions">
        <button class="btn btn--primary" data-nav="publicar">+ Publicar novo</button>
      </div>
    </div>
    <div class="service-grid" id="meusGrid"></div>
  `);
}

/* ---------------------------------- *
 *  Contratos (usuário)
 * ---------------------------------- */
function renderContratos() {
  return el(`
    <div class="page-header">
      <div>
        <h2 class="page-header__title">Meus contratos</h2>
        <p class="page-header__sub">Contratos em que você participa como prestador ou contratante.</p>
      </div>
    </div>
    <div class="table-wrap" id="contratosWrap"></div>
  `);
}

async function carregarContratos() {
  try {
    const r = await api('/contratos/meus');
    state.data.meusContratos = r.contratos;
    renderNav();
    const wrap = $('#contratosWrap');
    if (!r.contratos.length) {
      wrap.innerHTML = `<div class="empty" style="border:0;background:transparent">
        <div class="empty__icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg></div>
        <h4>Nenhum contrato ainda</h4>
        <p>Quando você contratar ou ser contratado, o contrato aparecerá aqui.</p>
      </div>`;
      return;
    }
    const rows = r.contratos.map(c => {
      const euPrestador = c.prestadorId === API.user.id;
      const outro = euPrestador ? c.contratante : c.prestador;
      const acoes = [];
      if (c.status === 'pendente' && euPrestador) {
        acoes.push(`<button class="btn btn--primary btn--small" data-acao="aceitar">Aceitar</button>`);
        acoes.push(`<button class="btn btn--danger btn--small" data-acao="recusar">Recusar</button>`);
      }
      if (c.status === 'aceito' && !euPrestador) {
        acoes.push(`<button class="btn btn--subtle btn--small" data-acao="concluir">Concluir</button>`);
      }
      return `
        <tr>
          <td>
            <div class="cell-strong">${esc(c.servico?.titulo || '—')}</div>
            <div class="cell-muted">Criado ${esc(dataRelativa(c.criadoEm))}</div>
          </td>
          <td>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="avatar avatar--sm" style="background:${corInicial(outro?.nome)}">${esc(iniciais(outro?.nome))}</span>
              ${esc(outro?.nome || '—')}
            </div>
            <div class="cell-muted">${euPrestador ? 'contratante' : 'prestador'}</div>
          </td>
          <td>
            <span class="cell-strong">${moeda(c.servico?.preco || 0)}</span>
            <div class="cell-muted">${esc(c.servico?.formaPagamento || '')}</div>
          </td>
          <td><span class="status-pill status-pill--${esc(c.status)}">${esc(c.status)}</span></td>
          <td>
            <div class="cell-actions">
              ${c.mensagem ? `<span class="cell-muted small" title="${esc(c.mensagem)}">✉️ ${esc(truncar(c.mensagem, 40))}</span>` : ''}
              ${acoes.join('')}
            </div>
          </td>
        </tr>
      `;
    }).join('');
    wrap.innerHTML = `
      <table class="data">
        <thead><tr><th>Serviço</th><th>Outro participante</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
    $$('#contratosWrap [data-acao]').forEach(b => b.addEventListener('click', e => {
      const tr = e.target.closest('tr');
      const id = tr.dataset.id;
      acaoContrato(id, b.dataset.acao);
    }));
    // fix: precisa do id no tr
    $$('#contratosWrap tbody tr').forEach((tr, i) => tr.dataset.id = r.contratos[i].id);
  } catch (e) { console.error(e); }
}

function truncar(s, n) { s = String(s); return s.length > n ? s.slice(0, n) + '…' : s; }

async function acaoContrato(id, acao) {
  try {
    await api(`/contratos/${id}/acao`, { method: 'POST', body: { acao } });
    const msgs = {
      aceitar: 'Contrato aceito.',
      recusar: 'Contrato recusado.',
      concluir: 'Contrato concluído.'
    };
    toast(msgs[acao] || 'OK', 'success');
    carregarContratos();
  } catch (err) {
    toast(err.message || 'Erro.', 'error');
  }
}

/* ---------------------------------- *
 *  Modal de serviço (detalhes + contratar)
 * ---------------------------------- */
function abrirModalServico(s, opts = {}) {
  const c = categoriaPorId(s.categoria);
  const me = opts.meu || (API.user?.id === s.prestadorId);
  const podeContratar = !me && s.status === 'aprovado';
  const backdrop = el(`
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal__head">
          <div>
            <h3 class="modal__title">${esc(s.titulo)}</h3>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">
              <span class="service-card__cat" style="--cat-color:${esc(c.cor)};display:inline-flex">${esc(c.nome)}</span>
              <span class="status-pill status-pill--${esc(s.status)}" style="margin-left:8px">${esc(s.status)}</span>
            </div>
          </div>
          <button class="modal__close" data-fechar aria-label="Fechar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div class="modal__body">
          <p class="muted" style="margin-top:0">${esc(s.descricao)}</p>
          <div class="service-detail__meta">
            <div class="meta-tile">
              <div class="meta-tile__label">Preço</div>
              <div class="meta-tile__value">${moeda(s.preco)}</div>
            </div>
            <div class="meta-tile">
              <div class="meta-tile__label">Forma</div>
              <div class="meta-tile__value">${esc(s.formaPagamento || '—')}</div>
            </div>
            <div class="meta-tile">
              <div class="meta-tile__label">Publicado</div>
              <div class="meta-tile__value">${esc(dataRelativa(s.criadoEm))}</div>
            </div>
          </div>
          <div class="service-detail__seller">
            <span class="avatar" style="background:${corInicial(s.prestador?.nome)}">${esc(iniciais(s.prestador?.nome))}</span>
            <div>
              <div class="cell-strong">${esc(s.prestador?.nome || 'Anônimo')}</div>
              <div class="cell-muted">Prestador do serviço</div>
            </div>
          </div>
          ${podeContratar ? `
            <div class="divider"></div>
            <div class="field">
              <label for="msgContrato">Mensagem para o prestador</label>
              <textarea id="msgContrato" placeholder="Conte o que você precisa, prazos, detalhes…"></textarea>
            </div>
          ` : ''}
        </div>
        <div class="modal__actions">
          <button class="btn btn--ghost" data-fechar>Fechar</button>
          ${podeContratar ? `<button class="btn btn--primary" data-contratar="${esc(s.id)}">Contratar</button>` : ''}
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(backdrop);
  backdrop.addEventListener('click', e => {
    if (e.target.id === 'modalBackdrop' || e.target.closest('[data-fechar]')) backdrop.remove();
  });
  const btn = backdrop.querySelector('[data-contratar]');
  if (btn) btn.addEventListener('click', async () => {
    const msg = backdrop.querySelector('#msgContrato').value;
    try {
      await api('/contratos', { method: 'POST', body: { servicoId: s.id, mensagem: msg } });
      toast('Contratação enviada! O prestador foi notificado.', 'success');
      backdrop.remove();
      if (!API.user) { /* nunca acontece */ }
      navegar('contratos');
    } catch (err) {
      toast(err.message || 'Erro ao contratar.', 'error');
    }
  });
}

/* ---------------------------------- *
 *  Autenticação
 * ---------------------------------- */
function renderAuth() {
  const isLogin = state.authTab === 'login';
  return el(`
    <div class="auth-wrap">
      <div class="auth-card">
        <aside class="auth-side">
          <div>
            <div class="auth-side__top">
              <span class="brand__mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 7h18l-1.5 12.5a2 2 0 0 1-2 1.5H6.5a2 2 0 0 1-2-1.5L3 7z"/>
                  <path d="M8 7V5a4 4 0 0 1 8 0v2"/>
                </svg>
              </span>
              <div>
                <div style="font-family:var(--font-display);font-weight:700;font-size:16px">OfertaLivre</div>
                <div class="cell-muted">marketplace freelance</div>
              </div>
            </div>
            <h2 class="auth-side__title">Um só lugar<br/>para oferecer e contratar.</h2>
            <p class="auth-side__lead">Crie sua conta e comece a publicar seus serviços ou contratar profissionais qualificados.</p>
          </div>
          <ul class="auth-side__list">
            <li>Publicação com aprovação da administração</li>
            <li>Contratos com status claro (pendente, aceito, concluído)</li>
            <li>Tudo salvo localmente no próprio site</li>
          </ul>
          <div class="auth-side__hint">
            💡 <strong>Conta de administrador:</strong> admin@marketplace.com · senha admin123
          </div>
        </aside>
        <div class="auth-form">
          <div class="tabs">
            <button class="tabs__btn ${isLogin ? 'is-active' : ''}" data-tab="login">Entrar</button>
            <button class="tabs__btn ${!isLogin ? 'is-active' : ''}" data-tab="registro">Criar conta</button>
          </div>
          <div id="authError" class="form-error" hidden></div>
          ${isLogin ? formLogin() : formRegistro()}
          <div class="auth-actions">
            <span class="auth-link">${isLogin ? 'Não tem conta?' : 'Já tem conta?'}</span>
            <a href="#" class="auth-link" data-switch="${isLogin ? 'registro' : 'login'}">${isLogin ? 'Cadastre-se' : 'Entrar'}</a>
          </div>
        </div>
      </div>
    </div>
  `);
}

function formLogin() {
  return `
    <form id="formLogin" novalidate>
      <div class="field">
        <label for="loginEmail">E-mail</label>
        <input id="loginEmail" name="email" type="email" autocomplete="email" required placeholder="voce@exemplo.com" />
      </div>
      <div class="field">
        <label for="loginSenha">Senha</label>
        <input id="loginSenha" name="senha" type="password" autocomplete="current-password" required placeholder="Sua senha" />
      </div>
      <button type="submit" class="btn btn--primary" style="width:100%;justify-content:center">Entrar</button>
    </form>
  `;
}

function formRegistro() {
  return `
    <form id="formRegistro" novalidate>
      <div class="field">
        <label for="regNome">Nome completo</label>
        <input id="regNome" name="nome" type="text" autocomplete="name" required placeholder="Seu nome" />
      </div>
      <div class="field">
        <label for="regEmail">E-mail</label>
        <input id="regEmail" name="email" type="email" autocomplete="email" required placeholder="voce@exemplo.com" />
      </div>
      <div class="field">
        <label for="regSenha">Senha</label>
        <input id="regSenha" name="senha" type="password" autocomplete="new-password" required minlength="6" placeholder="Mínimo 6 caracteres" />
      </div>
      <button type="submit" class="btn btn--primary" style="width:100%;justify-content:center">Criar conta</button>
    </form>
  `;
}

function mostrarErro(msg) {
  const e = $('#authError');
  if (!e) return;
  e.textContent = msg;
  e.hidden = false;
  e.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function submitAuth(e) {
  e.preventDefault();
  const form = e.target;
  const isLogin = form.id === 'formLogin';
  const body = isLogin
    ? { email: form.email.value, senha: form.senha.value }
    : { nome: form.nome.value, email: form.email.value, senha: form.senha.value };
  try {
    const r = await api(isLogin ? '/login' : '/registro', { method: 'POST', body });
    API.setSession(r.token, r.usuario);
    toast(isLogin ? 'Bem-vindo(a) de volta, ' + r.usuario.nome.split(' ')[0] + '!' : 'Conta criada com sucesso!', 'success');
    navegar(r.usuario.role === 'admin' ? 'admin' : 'home');
  } catch (err) {
    mostrarErro(err.message || 'Erro.');
  }
}

/* ---------------------------------- *
 *  Admin
 * ---------------------------------- */
function renderAdmin() {
  const tabs = [
    { id: 'servicos',   label: 'Serviços' },
    { id: 'contratos',  label: 'Contratos' },
    { id: 'usuarios',   label: 'Usuários' }
  ];
  return el(`
    <div class="page-header">
      <div>
        <h2 class="page-header__title">Painel de administração</h2>
        <p class="page-header__sub">Aprove serviços, acompanhe contratos e gerencie contas.</p>
      </div>
    </div>
    <div class="tabs-nav">
      ${tabs.map(t => `
        <button class="tabs-nav__btn ${state.adminTab === t.id ? 'is-active' : ''}" data-tab="${t.id}">
          ${esc(t.label)} <span class="count" data-count="${t.id}">–</span>
        </button>
      `).join('')}
    </div>
    <div id="adminPanel"></div>
  `);
}

async function carregarAdmin() {
  try {
    const [s, c, u] = await Promise.all([
      api('/admin/servicos'), api('/admin/contratos'), api('/admin/usuarios')
    ]);
    state.data.adminServicos = s.servicos;
    state.data.adminContratos = c.contratos;
    state.data.adminUsuarios = u.usuarios;
    const counts = {
      servicos: s.servicos.length,
      contratos: c.contratos.length,
      usuarios: u.usuarios.length
    };
    $$('[data-count]').forEach(el => el.textContent = counts[el.dataset.count] ?? '–');
    renderNav();
    renderConteudoAdmin();
  } catch (e) { console.error(e); }
}

function renderConteudoAdmin() {
  const panel = $('#adminPanel');
  if (!panel) return;
  if (state.adminTab === 'servicos') panel.innerHTML = adminServicosHTML();
  else if (state.adminTab === 'contratos') panel.innerHTML = adminContratosHTML();
  else if (state.adminTab === 'usuarios') panel.innerHTML = adminUsuariosHTML();
  $$('#adminPanel [data-acao]').forEach(b => b.addEventListener('click', e => {
    const tr = e.target.closest('tr, .list-item');
    const id = tr?.dataset.id;
    adminAcao(b.dataset.acao, id);
  }));
  $$('#adminPanel [data-toggle]').forEach(b => b.addEventListener('click', e => {
    const tr = e.target.closest('tr');
    toggleUsuario(tr.dataset.id, b.dataset.toggle);
  }));
}

function adminServicosHTML() {
  const rows = state.data.adminServicos.map(s => {
    const acoes = [];
    if (s.status !== 'aprovado') acoes.push(`<button class="btn btn--primary btn--small" data-acao="aprovar">Aprovar</button>`);
    acoes.push(`<button class="btn btn--danger btn--small" data-acao="remover">Remover</button>`);
    return `
      <tr data-id="${esc(s.id)}">
        <td>
          <div class="cell-strong">${esc(s.titulo)}</div>
          <div class="cell-muted">${esc(categoriaPorId(s.categoria).nome)} · ${esc(dataRelativa(s.criadoEm))}</div>
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="avatar avatar--sm" style="background:${corInicial(s.prestador?.nome)}">${esc(iniciais(s.prestador?.nome))}</span>
            <div>
              <div>${esc(s.prestador?.nome || '—')}</div>
              <div class="cell-muted">${esc(s.prestador?.email || '')}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="cell-strong">${moeda(s.preco)}</div>
          <div class="cell-muted">${esc(s.formaPagamento || '')}</div>
        </td>
        <td><span class="status-pill status-pill--${esc(s.status)}">${esc(s.status)}</span></td>
        <td><div class="cell-actions">${acoes.join('')}</div></td>
      </tr>
    `;
  }).join('');
  return `
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Serviço</th><th>Prestador</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="5"><div class="empty" style="border:0;background:transparent">Nenhum serviço publicado ainda.</div></td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function adminContratosHTML() {
  const rows = state.data.adminContratos.map(c => `
    <tr data-id="${esc(c.id)}">
      <td>
        <div class="cell-strong">${esc(c.servicoTitulo)}</div>
        <div class="cell-muted">${esc(dataRelativa(c.criadoEm))}</div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="avatar avatar--sm" style="background:${corInicial(c.prestador?.nome)}">${esc(iniciais(c.prestador?.nome))}</span>
          <div>
            <div>${esc(c.prestador?.nome || '—')}</div>
            <div class="cell-muted">prestador</div>
          </div>
        </div>
      </td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="avatar avatar--sm" style="background:${corInicial(c.contratante?.nome)}">${esc(iniciais(c.contratante?.nome))}</span>
          <div>
            <div>${esc(c.contratante?.nome || '—')}</div>
            <div class="cell-muted">contratante</div>
          </div>
        </div>
      </td>
      <td><span class="status-pill status-pill--${esc(c.status)}">${esc(c.status)}</span></td>
    </tr>
  `).join('');
  return `
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Serviço</th><th>Prestador</th><th>Contratante</th><th>Status</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="4"><div class="empty" style="border:0;background:transparent">Nenhum contrato ainda.</div></td></tr>`}</tbody>
      </table>
    </div>
  `;
}

function adminUsuariosHTML() {
  const rows = state.data.adminUsuarios.map(u => {
    const isMe = u.id === API.user.id;
    const suspensao = u.ativo === false;
    const acao = isMe
      ? `<span class="cell-muted">você</span>`
      : `<button class="row-toggle ${suspensao ? '' : 'is-on'}" data-toggle="${esc(u.id)}" title="${suspensao ? 'Reativar' : 'Suspender'}" aria-label="${suspensao ? 'Reativar' : 'Suspender'}"></button>`;
    return `
      <tr data-id="${esc(u.id)}">
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <span class="avatar" style="background:${corInicial(u.nome)}">${esc(iniciais(u.nome))}</span>
            <div>
              <div class="cell-strong">${esc(u.nome)}</div>
              <div class="cell-muted">${esc(u.email)}</div>
            </div>
          </div>
        </td>
        <td><span class="userbox__role userbox__role--${u.role}">${u.role}</span></td>
        <td>
          <span class="status-pill ${suspensao ? 'status-pill--removido' : 'status-pill--aprovado'}">${suspensao ? 'suspenso' : 'ativo'}</span>
        </td>
        <td class="cell-muted">${esc(new Date(u.criadoEm).toLocaleDateString('pt-BR'))}</td>
        <td><div class="cell-actions">${acao}</div></td>
      </tr>
    `;
  }).join('');
  return `
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>Usuário</th><th>Perfil</th><th>Status</th><th>Criado em</th><th>Ação</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="muted small" style="margin-top:10px">Ao suspender um usuário, ele não consegue mais entrar na plataforma até ser reativado.</p>
  `;
}

async function adminAcao(acao, id) {
  if (!id) return;
  try {
    if (acao === 'aprovar') {
      await api(`/admin/servicos/${id}/aprovar`, { method: 'POST' });
      toast('Serviço aprovado.', 'success');
    } else if (acao === 'remover') {
      if (!confirm('Remover este serviço permanentemente?')) return;
      await api(`/admin/servicos/${id}/remover`, { method: 'POST' });
      toast('Serviço removido.', 'success');
    }
    carregarAdmin();
  } catch (err) {
    toast(err.message || 'Erro.', 'error');
  }
}

async function toggleUsuario(id, toggle) {
  try {
    const r = await api(`/admin/usuarios/${id}/toggle`, { method: 'POST' });
    toast(r.usuario.ativo ? 'Usuário reativado.' : 'Usuário suspenso.', 'success');
    carregarAdmin();
  } catch (err) {
    toast(err.message || 'Erro.', 'error');
  }
}

function carregarConteudoAdmin() { renderConteudoAdmin(); }

/* ---------------------------------- *
 *  Minha conta
 * ---------------------------------- */
function renderConta() {
  return el(`
    <div class="page-header">
      <div>
        <h2 class="page-header__title">Minha conta</h2>
        <p class="page-header__sub">Dados do seu perfil e ações.</p>
      </div>
    </div>
    <div class="form-card" style="max-width:560px">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
        <span class="avatar" style="width:56px;height:56px;font-size:20px;background:${corInicial(API.user.nome)}">${esc(iniciais(API.user.nome))}</span>
        <div>
          <div style="font-family:var(--font-display);font-weight:700;font-size:18px">${esc(API.user.nome)}</div>
          <div class="cell-muted">${esc(API.user.email)}</div>
          <span class="userbox__role userbox__role--${API.user.role}" style="margin-top:6px;display:inline-block">${API.user.role === 'admin' ? 'administrador' : 'membro'}</span>
        </div>
      </div>
      <div class="divider"></div>
      <form id="formSenha">
        <div class="field">
          <label for="sAtual">Senha atual</label>
          <input id="sAtual" type="password" name="senhaAtual" autocomplete="current-password" required />
        </div>
        <div class="field">
          <label for="sNova">Nova senha</label>
          <input id="sNova" type="password" name="novaSenha" autocomplete="new-password" required minlength="6" />
          <div class="field__hint">Mínimo de 6 caracteres.</div>
        </div>
        <button type="submit" class="btn btn--primary">Alterar senha</button>
      </form>
      <div class="divider"></div>
      <button class="btn btn--danger" id="btnLogout">Sair da conta</button>
    </div>
  `);
}

async function submitSenha(e) {
  e.preventDefault();
  const f = e.target;
  try {
    await api('/conta/senha', { method: 'PATCH', body: { senhaAtual: f.senhaAtual.value, novaSenha: f.novaSenha.value } });
    toast('Senha alterada com sucesso.', 'success');
    f.reset();
  } catch (
