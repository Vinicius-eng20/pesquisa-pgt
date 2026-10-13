// ESTADO GLOBAL DO APLICATIVO
let usuarioAtual = null;
let tokenAtual = localStorage.getItem('freelahub_token') || null;
let servicosCache = [];
let filtroCategoriaAtiva = 'todas';
let modoAuth = 'login'; // 'login' ou 'cadastro'

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', async () => {
  if (tokenAtual) {
    await carregarSessaoUsuario();
  } else {
    atualizarNavbar();
  }
  await carregarMarketplace();
});

// GESTÃO DE SESSÃO E USUÁRIO
async function carregarSessaoUsuario() {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${tokenAtual}` }
    });

    if (res.ok) {
      const data = await res.json();
      usuarioAtual = data.usuario;
      atualizarNavbar();
    } else {
      fazerLogout(false);
    }
  } catch (error) {
    console.error('Erro ao verificar sessão:', error);
    fazerLogout(false);
  }
}

function fazerLogout(notificar = true) {
  tokenAtual = null;
  usuarioAtual = null;
  localStorage.removeItem('freelahub_token');
  atualizarNavbar();
  navegarPara('marketplace');
  if (notificar) mostrarToast('Você saiu da sua conta.', 'info');
}

function atualizarNavbar() {
  const areaDeslogado = document.getElementById('area-deslogado');
  const areaLogado = document.getElementById('area-logado');
  const authElements = document.querySelectorAll('.auth-obrigatoria');
  const adminElements = document.querySelectorAll('.admin-obrigatorio');

  if (usuarioAtual) {
    areaDeslogado.classList.add('hidden');
    areaLogado.classList.remove('hidden');

    document.getElementById('user-avatar-letra').textContent = usuarioAtual.nome.charAt(0).toUpperCase();
    document.getElementById('user-display-nome').textContent = usuarioAtual.nome;
    document.getElementById('menu-user-nome').textContent = usuarioAtual.nome;
    document.getElementById('menu-user-email').textContent = usuarioAtual.email;

    const badge = document.getElementById('menu-user-badge');
    badge.textContent = usuarioAtual.papel === 'admin' ? 'Administrador' : 'Freelancer / Cliente';
    badge.className = usuarioAtual.papel === 'admin'
      ? 'inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800'
      : 'inline-block mt-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-600';

    authElements.forEach(el => el.classList.remove('hidden'));

    if (usuarioAtual.papel === 'admin') {
      adminElements.forEach(el => el.classList.remove('hidden'));
    } else {
      adminElements.forEach(el => el.classList.add('hidden'));
    }
  } else {
    areaDeslogado.classList.remove('hidden');
    areaLogado.classList.add('hidden');
    authElements.forEach(el => el.classList.add('hidden'));
    adminElements.forEach(el => el.classList.add('hidden'));
  }
}

function toggleMenuUsuario() {
  const menu = document.getElementById('dropdown-usuario');
  menu.classList.toggle('hidden');
}

// Fechar menu de usuário ao clicar fora
document.addEventListener('click', (e) => {
  const menu = document.getElementById('dropdown-usuario');
  const botao = document.getElementById('user-display-nome');
  if (menu && !menu.contains(e.target) && botao && !botao.contains(e.target)) {
    menu.classList.add('hidden');
  }
});

// NAVEGAÇÃO ENTRE TELAS
function navegarPara(secao) {
  const secoes = ['marketplace', 'meus-servicos', 'meus-contratos', 'admin'];
  secoes.forEach(s => {
    const el = document.getElementById(`view-${s}`);
    const navBtn = document.getElementById(`nav-btn-${s}`);
    if (el) el.classList.add('hidden');
    if (navBtn) {
      navBtn.classList.remove('bg-indigo-50', 'text-indigo-600', 'font-semibold');
      navBtn.classList.add('text-slate-600');
    }
  });

  const telaAlvo = document.getElementById(`view-${secao}`);
  const navBtnAlvo = document.getElementById(`nav-btn-${secao}`);
  if (telaAlvo) telaAlvo.classList.remove('hidden');
  if (navBtnAlvo) {
    navBtnAlvo.classList.add('bg-indigo-50', 'text-indigo-600', 'font-semibold');
    navBtnAlvo.classList.remove('text-slate-600');
  }

  // Ações ao entrar em cada aba
  if (secao === 'marketplace') {
    carregarMarketplace();
  } else if (secao === 'meus-servicos') {
    if (!usuarioAtual) { abrirModalAuth('login'); return; }
    carregarMeusServicos();
  } else if (secao === 'meus-contratos') {
    if (!usuarioAtual) { abrirModalAuth('login'); return; }
    carregarMeusContratos();
  } else if (secao === 'admin') {
    if (!usuarioAtual || usuarioAtual.papel !== 'admin') {
      mostrarToast('Acesso restrito ao administrador.', 'erro');
      navegarPara('marketplace');
      return;
    }
    carregarPainelAdmin();
  }
}

// ================= MARKETPLACE =================
async function carregarMarketplace() {
  try {
    const res = await fetch('/api/servicos');
    servicosCache = await res.json();
    renderizarServicosMarketplace(servicosCache);
  } catch (error) {
    mostrarToast('Erro ao carregar serviços.', 'erro');
  }
}

function renderizarServicosMarketplace(servicos) {
  const grid = document.getElementById('grid-servicos');
  grid.innerHTML = '';

  if (servicos.length === 0) {
    grid.innerHTML = `
      <div class="col-span-full py-16 text-center text-slate-400">
        <svg class="w-12 h-12 mx-auto mb-3 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
        <p class="text-base font-semibold text-slate-600">Nenhum serviço encontrado nesta categoria.</p>
        <p class="text-xs text-slate-400 mt-1">Tente pesquisar outro termo ou seja o primeiro a publicar!</p>
      </div>
    `;
    return;
  }

  servicos.forEach(servico => {
    const card = document.createElement('div');
    card.className = "bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm hover:shadow-md transition flex flex-col justify-between";
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between mb-3">
          <span class="badge bg-indigo-50 text-indigo-700">${servico.categoria}</span>
          <span class="text-xs text-slate-400 font-medium">Prazo: ${servico.prazo_dias} dia(s)</span>
        </div>
        <h3 class="font-bold text-slate-900 text-lg leading-snug line-clamp-2">${servico.titulo}</h3>
        <p class="text-slate-600 text-xs mt-2 line-clamp-3 leading-relaxed">${servico.descricao}</p>
      </div>

      <div class="pt-5 mt-4 border-t border-slate-100 flex items-center justify-between">
        <div>
          <span class="text-[11px] text-slate-400 block font-medium">Por ${servico.prestador_nome}</span>
          <span class="text-xl font-extrabold text-slate-900">R$ ${servico.preco.toFixed(2)}</span>
        </div>
        <button onclick="abrirModalContratar(${servico.id})" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition shadow-sm">
          Ver & Contratar
        </button>
      </div>
    `;
    grid.appendChild(card);
  });
}

function selecionarCategoria(cat) {
  filtroCategoriaAtiva = cat;
  document.querySelectorAll('.btn-categoria').forEach(btn => {
    if (btn.textContent.trim().toLowerCase() === cat.toLowerCase() || (cat === 'todas' && btn.textContent.trim() === 'Todas')) {
      btn.className = 'btn-categoria px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-indigo-600 text-white transition';
    } else {
      btn.className = 'btn-categoria px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap bg-slate-100 text-slate-600 hover:bg-slate-200 transition';
    }
  });
  filtrarServicos();
}

function filtrarServicos() {
  const termo = document.getElementById('filtro-busca').value.toLowerCase().trim();
  const filtrados = servicosCache.filter(s => {
    const bateuCategoria = filtroCategoriaAtiva === 'todas' || s.categoria === filtroCategoriaAtiva;
    const bateuBusca = !termo || s.titulo.toLowerCase().includes(termo) || s.descricao.toLowerCase().includes(termo);
    return bateuCategoria && bateuBusca;
  });
  renderizarServicosMarketplace(filtrados);
}

// ================= MEUS SERVIÇOS =================
async function carregarMeusServicos() {
  try {
    const res = await fetch('/api/meus-servicos', {
      headers: { 'Authorization': `Bearer ${tokenAtual}` }
    });
    const servicos = await res.json();
    const container = document.getElementById('lista-meus-servicos');
    container.innerHTML = '';

    if (servicos.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400 bg-white rounded-2xl border border-slate-200">
          <p class="font-semibold text-slate-700">Você ainda não publicou nenhum serviço.</p>
          <p class="text-xs text-slate-400 mt-1">Publique o que você sabe fazer e receba contratações diretamente na plataforma!</p>
          <button onclick="abrirModalNovoServico()" class="mt-4 bg-indigo-600 text-white text-xs font-bold px-4 py-2 rounded-xl">
            Criar Primeiro Serviço
          </button>
        </div>
      `;
      return;
    }

    servicos.forEach(s => {
      let statusBadge = '';
      if (s.status === 'aprovado') statusBadge = '<span class="badge bg-emerald-50 text-emerald-700">✓ Aprovado e Ativo</span>';
      else if (s.status === 'pendente') statusBadge = '<span class="badge bg-amber-50 text-amber-700">⏳ Aguardando Aprovação</span>';
      else statusBadge = '<span class="badge bg-rose-50 text-rose-700">✕ Rejeitado</span>';

      const card = document.createElement('div');
      card.className = "bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between";
      card.innerHTML = `
        <div>
          <div class="flex items-center justify-between mb-2">
            ${statusBadge}
            <span class="text-xs font-bold text-indigo-600">R$ ${s.preco.toFixed(2)}</span>
          </div>
          <h4 class="font-bold text-slate-900 text-base mb-1">${s.titulo}</h4>
          <p class="text-xs text-slate-500 line-clamp-2">${s.descricao}</p>
        </div>
        <div class="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
          <span class="text-xs text-slate-400">Prazo: ${s.prazo_dias} dias</span>
          <button onclick="excluirMeuServico(${s.id})" class="text-xs font-semibold text-rose-600 hover:text-rose-800 transition">
            Excluir Serviço
          </button>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (error) {
    mostrarToast('Erro ao carregar seus serviços.', 'erro');
  }
}

async function excluirMeuServico(id) {
  if (!confirm('Deseja realmente remover este serviço da plataforma?')) return;
  try {
    const res = await fetch(`/api/meus-servicos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenAtual}` }
    });
    const data = await res.json();
    if (res.ok) {
      mostrarToast(data.mensagem, 'sucesso');
      carregarMeusServicos();
    } else {
      mostrarToast(data.erro, 'erro');
    }
  } catch (e) {
    mostrarToast('Erro ao remover serviço.', 'erro');
  }
}

// ================= MEUS CONTRATOS =================
let contratosCache = { contratadosPorMim: [], meusTrabalhos: [] };

async function carregarMeusContratos() {
  try {
    const res = await fetch('/api/meus-contratos', {
      headers: { 'Authorization': `Bearer ${tokenAtual}` }
    });
    contratosCache = await res.json();
    renderizarContratos();
  } catch (error) {
    mostrarToast('Erro ao obter contratos.', 'erro');
  }
}

function alternarTabContrato(tipo) {
  const btnContratados = document.getElementById('tab-contratados-btn');
  const btnTrabalhos = document.getElementById('tab-trabalhos-btn');
  const cContratados = document.getElementById('tab-conteudo-contratados');
  const cTrabalhos = document.getElementById('tab-conteudo-trabalhos');

  if (tipo === 'contratados') {
    btnContratados.className = 'pb-3 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 transition';
    btnTrabalhos.className = 'pb-3 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition';
    cContratados.classList.remove('hidden');
    cTrabalhos.classList.add('hidden');
  } else {
    btnTrabalhos.className = 'pb-3 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600 transition';
    btnContratados.className = 'pb-3 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-800 transition';
    cTrabalhos.classList.remove('hidden');
    cContratados.classList.add('hidden');
  }
}

function renderizarContratos() {
  // 1. Contratados por mim
  const containerContratados = document.getElementById('lista-contratados');
  containerContratados.innerHTML = '';
  if (contratosCache.contratadosPorMim.length === 0) {
    containerContratados.innerHTML = '<p class="text-sm text-slate-400 py-8 text-center bg-white rounded-2xl border border-slate-200">Você ainda não contratou nenhum serviço.</p>';
  } else {
    contratosCache.contratadosPorMim.forEach(c => {
      containerContratados.appendChild(gerarCardContrato(c, 'cliente'));
    });
  }

  // 2. Trabalhos para mim
  const containerTrabalhos = document.getElementById('lista-trabalhos');
  containerTrabalhos.innerHTML = '';
  if (contratosCache.meusTrabalhos.length === 0) {
    containerTrabalhos.innerHTML = '<p class="text-sm text-slate-400 py-8 text-center bg-white rounded-2xl border border-slate-200">Ninguém contratou seus serviços ainda.</p>';
  } else {
    contratosCache.meusTrabalhos.forEach(c => {
      containerTrabalhos.appendChild(gerarCardContrato(c, 'prestador'));
    });
  }
}

function gerarCardContrato(c, tipo) {
  const card = document.createElement('div');
  card.className = "bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4";

  let statusBadge = '';
  if (c.status === 'em_andamento') statusBadge = '<span class="badge bg-blue-50 text-blue-700">⏳ Em Andamento</span>';
  else if (c.status === 'concluido') statusBadge = '<span class="badge bg-emerald-50 text-emerald-700">✓ Concluído</span>';
  else statusBadge = '<span class="badge bg-rose-50 text-rose-700">✕ Cancelado</span>';

  const rotuloPessoa = tipo === 'cliente' ? 'Prestador' : 'Cliente';

  let botoesAcao = '';
  if (c.status === 'em_andamento') {
    botoesAcao = `
      <div class="flex items-center space-x-2">
        <button onclick="mudarStatusContrato(${c.id}, 'concluido')" class="text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg transition shadow-sm">
          Marcar Concluído
        </button>
        <button onclick="mudarStatusContrato(${c.id}, 'cancelado')" class="text-xs font-semibold text-rose-600 hover:bg-rose-50 px-2 py-1.5 rounded-lg transition">
          Cancelar
        </button>
      </div>
    `;
  }

  card.innerHTML = `
    <div>
      <div class="flex items-center space-x-2 mb-1.5">
        <span class="text-xs font-mono font-bold text-slate-400">Contrato #${c.id}</span>
        ${statusBadge}
        <span class="text-xs text-slate-400">• ${new Date(c.criado_em).toLocaleDateString('pt-BR')}</span>
      </div>
      <h4 class="text-base font-bold text-slate-900">${c.servico_titulo}</h4>
      <p class="text-xs text-slate-600 mt-1"><strong>${rotuloPessoa}:</strong> ${c.outro_nome} (${c.outro_email} ${c.outro_telefone ? '• ' + c.outro_telefone : ''})</p>
      <p class="text-xs text-slate-500 mt-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100"><strong>Pedido:</strong> ${c.detalhes_pedido || 'Sem instruções específicas.'}</p>
    </div>

    <div class="flex flex-row md:flex-col items-center md:items-end justify-between border-t md:border-t-0 pt-3 md:pt-0 border-slate-100 gap-2">
      <span class="text-lg font-black text-indigo-600">R$ ${c.valor.toFixed(2)}</span>
      ${botoesAcao}
    </div>
  `;
  return card;
}

async function mudarStatusContrato(id, status) {
  const confirmacao = status === 'concluido' ? 'Confirmar conclusão deste trabalho?' : 'Deseja realmente cancelar este contrato?';
  if (!confirm(confirmacao)) return;

  try {
    const res = await fetch(`/api/contratos/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAtual}`
      },
      body: JSON.stringify({ status })
    });

    const data = await res.json();
    if (res.ok) {
      mostrarToast(data.mensagem, 'sucesso');
      carregarMeusContratos();
    } else {
      mostrarToast(data.erro, 'erro');
    }
  } catch (error) {
    mostrarToast('Erro ao atualizar contrato.', 'erro');
  }
}

// ================= PAINEL DO ADMINISTRADOR =================
function alternarSubTabAdmin(sub) {
  ['servicos', 'usuarios', 'contratos'].forEach(s => {
    document.getElementById(`adm-painel-${s}`).classList.add('hidden');
    const tabBtn = document.getElementById(`adm-tab-${s}`);
    tabBtn.className = 'pb-3 text-sm font-bold border-b-2 border-transparent text-slate-500 hover:text-slate-900';
  });

  document.getElementById(`adm-painel-${sub}`).classList.remove('hidden');
  document.getElementById(`adm-tab-${sub}`).className = 'pb-3 text-sm font-bold border-b-2 border-amber-600 text-amber-700';
}

async function carregarPainelAdmin() {
  try {
    // 1. Estatísticas
    const resStats = await fetch('/api/admin/estatisticas', {
      headers: { 'Authorization': `Bearer ${tokenAtual}` }
    });
    const stats = await resStats.json();
    const statsContainer = document.getElementById('admin-cards-estatisticas');
    statsContainer.innerHTML = `
      <div class="bg-white p-3 rounded-xl border border-amber-200">
        <p class="text-[10px] uppercase font-bold text-slate-400">Usuários</p>
        <p class="text-lg font-black text-slate-800">${stats.totalUsuarios}</p>
      </div>
      <div class="bg-white p-3 rounded-xl border border-amber-200">
        <p class="text-[10px] uppercase font-bold text-slate-400">Serviços</p>
        <p class="text-lg font-black text-slate-800">${stats.totalServicos}</p>
      </div>
      <div class="bg-white p-3 rounded-xl border border-amber-200">
        <p class="text-[10px] uppercase font-bold text-amber-600">Pendentes</p>
        <p class="text-lg font-black text-amber-600">${stats.pendentes}</p>
      </div>
      <div class="bg-white p-3 rounded-xl border border-amber-200">
        <p class="text-[10px] uppercase font-bold text-emerald-600">Volume</p>
        <p class="text-lg font-black text-emerald-600">R$ ${stats.volumeTotal.toFixed(0)}</p>
      </div>
    `;

    // 2. Tabela Serviços
    const resServ = await fetch('/api/admin/servicos', {
      headers: { 'Authorization': `Bearer ${tokenAtual}` }
    });
    const servicos = await resServ.json();
    const tbodyServicos = document.getElementById('adm-tabela-servicos');
    tbodyServicos.innerHTML = '';
    servicos.forEach(s => {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-50 transition";
      let statusHtml = '';
      if (s.status === 'aprovado') statusHtml = '<span class="badge bg-emerald-50 text-emerald-700">Aprovado</span>';
      else if (s.status === 'pendente') statusHtml = '<span class="badge bg-amber-100 text-amber-800 animate-pulse font-bold">Pendente</span>';
      else statusHtml = '<span class="badge bg-rose-50 text-rose-700">Rejeitado</span>';

      tr.innerHTML = `
        <td class="px-5 py-4 font-medium text-slate-900">
          <div>${s.titulo}</div>
          <div class="text-xs text-slate-400">${s.categoria}</div>
        </td>
        <td class="px-5 py-4 text-xs">
          <div class="font-semibold text-slate-700">${s.prestador_nome}</div>
          <div class="text-slate-400">${s.prestador_email}</div>
        </td>
        <td class="px-5 py-4 font-bold text-slate-900">R$ ${s.preco.toFixed(2)}</td>
        <td class="px-5 py-4">${statusHtml}</td>
        <td class="px-5 py-4 text-right space-x-1 whitespace-nowrap">
          ${s.status !== 'aprovado' ? `<button onclick="alterarStatusServicoAdmin(${s.id}, 'aprovado')" class="text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg">Aprovar</button>` : ''}
          ${s.status !== 'rejeitado' ? `<button onclick="alterarStatusServicoAdmin(${s.id}, 'rejeitado')" class="text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-2.5 py-1 rounded-lg">Reprovar</button>` : ''}
          <button onclick="excluirServicoAdmin(${s.id})" class="text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg">Excluir</button>
        </td>
      `;
      tbodyServicos.appendChild(tr);
    });

    // 3. Tabela Usuários
    const resUsers = await fetch('/api/admin/usuarios', {
      headers: { 'Authorization': `Bearer ${tokenAtual}` }
    });
    const usuarios = await resUsers.json();
    const tbodyUsers = document.getElementById('adm-tabela-usuarios');
    tbodyUsers.innerHTML = '';
    usuarios.forEach(u => {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-50 transition";
      const statusUser = u.suspenso === 1 
        ? '<span class="badge bg-rose-50 text-rose-700">Suspenso</span>' 
        : '<span class="badge bg-emerald-50 text-emerald-700">Ativo</span>';

      tr.innerHTML = `
        <td class="px-5 py-4">
          <div class="font-bold text-slate-900">${u.nome}</div>
          <div class="text-xs text-slate-400">${u.email}</div>
        </td>
        <td class="px-5 py-4 text-xs text-slate-600">${u.telefone || 'Não informado'}</td>
        <td class="px-5 py-4 text-xs font-semibold uppercase">${u.papel}</td>
        <td class="px-5 py-4">${statusUser}</td>
        <td class="px-5 py-4 text-right">
          ${u.papel !== 'admin' ? `
            <button onclick="toggleSuspensaoUsuario(${u.id})" class="text-xs font-bold px-3 py-1 rounded-lg transition ${u.suspenso === 1 ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-rose-100 text-rose-700 hover:bg-rose-200'}">
              ${u.suspenso === 1 ? 'Reativar Conta' : 'Suspender Conta'}
            </button>
          ` : '<span class="text-xs text-slate-400 italic">Administrador</span>'}
        </td>
      `;
      tbodyUsers.appendChild(tr);
    });

    // 4. Tabela Todos os Contratos
    const resContratos = await fetch('/api/admin/contratos', {
      headers: { 'Authorization': `Bearer ${tokenAtual}` }
    });
    const contratos = await resContratos.json();
    const tbodyContratos = document.getElementById('adm-tabela-contratos');
    tbodyContratos.innerHTML = '';
    contratos.forEach(c => {
      const tr = document.createElement('tr');
      tr.className = "hover:bg-slate-50 transition";
      tr.innerHTML = `
        <td class="px-5 py-4 text-xs font-mono">#${c.id}</td>
        <td class="px-5 py-4 text-sm font-semibold text-slate-900">${c.servico_titulo}</td>
        <td class="px-5 py-4 text-xs">
          <div class="font-semibold text-slate-800">${c.cliente_nome}</div>
          <div class="text-slate-400">${c.cliente_email}</div>
        </td>
        <td class="px-5 py-4 text-xs">
          <div class="font-semibold text-slate-800">${c.prestador_nome}</div>
          <div class="text-slate-400">${c.prestador_email}</div>
        </td>
        <td class="px-5 py-4 font-bold text-slate-900">R$ ${c.valor.toFixed(2)}</td>
        <td class="px-5 py-4 text-xs font-bold uppercase">${c.status}</td>
      `;
      tbodyContratos.appendChild(tr);
    });

  } catch (error) {
    mostrarToast('Erro ao atualizar painel administrativo.', 'erro');
  }
}

async function alterarStatusServicoAdmin(id, status) {
  try {
    const res = await fetch(`/api/admin/servicos/${id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAtual}`
      },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (res.ok) {
      mostrarToast(data.mensagem, 'sucesso');
      carregarPainelAdmin();
    } else {
      mostrarToast(data.erro, 'erro');
    }
  } catch (e) {
    mostrarToast('Erro ao atualizar status do serviço.', 'erro');
  }
}

async function excluirServicoAdmin(id) {
  if (!confirm('Deseja realmente excluir este serviço da plataforma? Esta ação é definitiva.')) return;
  try {
    const res = await fetch(`/api/admin/servicos/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${tokenAtual}` }
    });
    const data = await res.json();
    if (res.ok) {
      mostrarToast(data.mensagem, 'sucesso');
      carregarPainelAdmin();
    } else {
      mostrarToast(data.erro, 'erro');
    }
  } catch (e) {
    mostrarToast('Erro ao excluir serviço.', 'erro');
  }
}

async function toggleSuspensaoUsuario(id) {
  if (!confirm('Deseja alterar a suspensão deste usuário?')) return;
  try {
    const res = await fetch(`/api/admin/usuarios/${id}/suspensao`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${tokenAtual}` }
    });
    const data = await res.json();
    if (res.ok) {
      mostrarToast(data.mensagem, 'sucesso');
      carregarPainelAdmin();
    } else {
      mostrarToast(data.erro, 'erro');
    }
  } catch (e) {
    mostrarToast('Erro ao atualizar usuário.', 'erro');
  }
}

// ================= MODAIS & AÇÕES DE FORMULÁRIO =================
function abrirModalAuth(modo = 'login') {
  modoAuth = modo;
  const modal = document.getElementById('modal-auth');
  const titulo = document.getElementById('auth-titulo');
  const sub = document.getElementById('auth-subtitulo');
  const btnSubmit = document.getElementById('auth-btn-submit');
  const toggleTexto = document.getElementById('auth-toggle-texto');
  const toggleBtn = document.getElementById('auth-toggle-btn');
  const campoNome = document.getElementById('campo-auth-nome');
  const extras = document.getElementById('campos-auth-extras');

  if (modo === 'cadastro') {
    titulo.textContent = 'Crie sua conta';
    sub.textContent = 'Comece a prestar ou contratar serviços agora mesmo.';
    btnSubmit.textContent = 'Finalizar Cadastro';
    toggleTexto.textContent = 'Já possui uma conta?';
    toggleBtn.textContent = 'Faça login';
    campoNome.classList.remove('hidden');
    extras.classList.remove('hidden');
  } else {
    titulo.textContent = 'Acesse sua conta';
    sub.textContent = 'Entre com seu e-mail e senha cadastrados.';
    btnSubmit.textContent = 'Entrar na Conta';
    toggleTexto.textContent = 'Não possui uma conta?';
    toggleBtn.textContent = 'Cadastre-se grátis';
    campoNome.classList.add('hidden');
    extras.classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

function fecharModalAuth() {
  document.getElementById('modal-auth').classList.add('hidden');
}

function alternarModoAuth() {
  abrirModalAuth(modoAuth === 'login' ? 'cadastro' : 'login');
}

async function enviarAutenticacao(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const senha = document.getElementById('auth-senha').value;

  const endpoint = modoAuth === 'cadastro' ? '/api/auth/cadastro' : '/api/auth/login';
  const body = { email, senha };

  if (modoAuth === 'cadastro') {
    body.nome = document.getElementById('auth-nome').value;
    body.telefone = document.getElementById('auth-telefone').value;
    body.bio = document.getElementById('auth-bio').value;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if (res.ok) {
      tokenAtual = data.token;
      localStorage.setItem('freelahub_token', tokenAtual);
      usuarioAtual = data.usuario;
      atualizarNavbar();
      fecharModalAuth();
      mostrarToast(`Bem-vindo, ${usuarioAtual.nome}!`, 'sucesso');
      document.getElementById('form-auth').reset();
    } else {
      mostrarToast(data.erro, 'erro');
    }
  } catch (error) {
    mostrarToast('Falha na conexão com o servidor.', 'erro');
  }
}

// Novo Serviço
function abrirModalNovoServico() {
  if (!usuarioAtual) {
    abrirModalAuth('login');
    return;
  }
  document.getElementById('modal-novo-servico').classList.remove('hidden');
}

function fecharModalNovoServico() {
  document.getElementById('modal-novo-servico').classList.add('hidden');
}

async function enviarNovoServico(e) {
  e.preventDefault();
  const servico = {
    titulo: document.getElementById('servico-titulo').value,
    categoria: document.getElementById('servico-categoria').value,
    preco: parseFloat(document.getElementById('servico-preco').value),
    prazo_dias: parseInt(document.getElementById('servico-prazo').value, 10),
    descricao: document.getElementById('servico-descricao').value
  };

  try {
    const res = await fetch('/api/servicos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAtual}`
      },
      body: JSON.stringify(servico)
    });

    const data = await res.json();
    if (res.ok) {
      fecharModalNovoServico();
      document.getElementById('form-novo-servico').reset();
      mostrarToast(data.mensagem, 'sucesso');
      navegarPara('meus-servicos');
    } else {
      mostrarToast(data.erro, 'erro');
    }
  } catch (error) {
    mostrarToast('Erro ao criar serviço.', 'erro');
  }
}

// Contratação
async function abrirModalContratar(servicoId) {
  try {
    const res = await fetch(`/api/servicos/${servicoId}`);
    const servico = await res.json();

    document.getElementById('contratar-servico-id').value = servico.id;
    document.getElementById('contratar-categoria').textContent = servico.categoria;
    document.getElementById('contratar-titulo').textContent = servico.titulo;
    document.getElementById('contratar-prestador-nome').textContent = servico.prestador_nome;
    document.getElementById('contratar-prestador-contato').textContent = servico.prestador_email + (servico.prestador_telefone ? ` • ${servico.prestador_telefone}` : '');
    document.getElementById('contratar-preco').textContent = `R$ ${servico.preco.toFixed(2)}`;
    document.getElementById('contratar-prazo').textContent = `Prazo estimado: ${servico.prazo_dias} dias`;
    document.getElementById('contratar-descricao').textContent = servico.descricao;

    document.getElementById('modal-contratar').classList.remove('hidden');
  } catch (error) {
    mostrarToast('Erro ao carregar detalhes do serviço.', 'erro');
  }
}

function fecharModalContratar() {
  document.getElementById('modal-contratar').classList.add('hidden');
}

async function confirmarContratacao(e) {
  e.preventDefault();
  if (!usuarioAtual) {
    fecharModalContratar();
    abrirModalAuth('login');
    return;
  }

  const servico_id = parseInt(document.getElementById('contratar-servico-id').value, 10);
  const detalhes_pedido = document.getElementById('contratar-instrucoes').value;

  try {
    const res = await fetch('/api/contratos', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenAtual}`
      },
      body: JSON.stringify({ servico_id, detalhes_pedido })
    });

    const data = await res.json();
    if (res.ok) {
      fecharModalContratar();
      document.getElementById('form-confirmar-contrato').reset();
      mostrarToast(data.mensagem, 'sucesso');
      navegarPara('meus-contratos');
    } else {
      mostrarToast(data.erro, 'erro');
    }
  } catch (error) {
    mostrarToast('Erro ao firmar contrato.', 'erro');
  }
}

// Notificações Toast
function mostrarToast(mensagem, tipo = 'sucesso') {
  const toast = document.getElementById('toast');
  const toastCor = document.getElementById('toast-cor');
  const icone = document.getElementById('toast-icone');
  const msgEl = document.getElementById('toast-mensagem');

  msgEl.textContent = mensagem;

  if (tipo === 'sucesso') {
    toastCor.className = 'flex items-center space-x-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium bg-emerald-600 text-white border-emerald-500';
    icone.textContent = '✓';
  } else if (tipo === 'erro') {
    toastCor.className = 'flex items-center space-x-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium bg-rose-600 text-white border-rose-500';
    icone.textContent = '✕';
  } else {
    toastCor.className = 'flex items-center space-x-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium bg-slate-800 text-white border-slate-700';
    icone.textContent = 'ℹ';
  }

  toast.classList.remove('translate-y-24', 'opacity-0', 'pointer-events-none');

  setTimeout(() => {
    toast.classList.add('translate-y-24', 'opacity-0', 'pointer-events-none');
  }, 4000);
}
