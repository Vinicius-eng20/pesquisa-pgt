// ESTADO GLOBAL DA APLICAÇÃO
let usuarioAtual = null;
let eventosGlobais = [];
let todasInscricoesGlobais = [];
let vistaAtual = 'eventos';

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', async () => {
  await checarSessao();
  await carregarEventos();
});

// 1. CHECAGEM DE AUTENTICAÇÃO
async function checarSessao() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      usuarioAtual = data.user;
    } else {
      usuarioAtual = null;
    }
  } catch (err) {
    usuarioAtual = null;
  }
  atualizarInterfaceUsuario();
}

// 2. ATUALIZAR INTERFACE CONFORME O PAPEL DO USUÁRIO
function atualizarInterfaceUsuario() {
  const navDeslogado = document.getElementById('nav-deslogado');
  const navLogado = document.getElementById('nav-logado');
  const navParticipante = document.getElementById('nav-participante');
  const navOrganizador = document.getElementById('nav-organizador');
  const avisoUsuario = document.getElementById('aviso-usuario');

  if (usuarioAtual) {
    navDeslogado.classList.add('hidden');
    navLogado.classList.remove('hidden');

    document.getElementById('user-display-name').textContent = usuarioAtual.nome;
    document.getElementById('user-display-role').textContent =
      usuarioAtual.tipo === 'organizador' ? 'Organizador' : 'Participante';

    if (usuarioAtual.tipo === 'organizador') {
      navOrganizador.classList.remove('hidden');
      navParticipante.classList.add('hidden');
      avisoUsuario.innerHTML = `
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-crown text-amber-300"></i>
          <span>Painel de <strong>Organizador</strong>: você pode criar, editar eventos e confirmar presença dos inscritos.</span>
        </div>`;
    } else {
      navOrganizador.classList.add('hidden');
      navParticipante.classList.remove('hidden');
      avisoUsuario.innerHTML = `
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-circle-user text-indigo-300"></i>
          <span>Olá, <strong>${usuarioAtual.nome}</strong>! Escolha um evento abaixo para se inscrever.</span>
        </div>`;
    }
  } else {
    navDeslogado.classList.remove('hidden');
    navLogado.classList.add('hidden');
    navParticipante.classList.add('hidden');
    navOrganizador.classList.add('hidden');
    avisoUsuario.innerHTML = `
      <div class="flex items-center gap-2">
        <i class="fa-solid fa-info-circle text-indigo-200"></i>
        <span>Faça login ou crie uma conta grátis para se inscrever nos eventos.</span>
      </div>`;
  }
}

// 3. NAVEGAÇÃO ENTRE TELAS
function navegarPara(view) {
  vistaAtual = view;
  document.querySelectorAll('.view-section').forEach(el => el.classList.add('hidden'));

  const alvo = document.getElementById(`view-${view}`);
  if (alvo) alvo.classList.remove('hidden');

  if (view === 'eventos') {
    carregarEventos();
  } else if (view === 'minhas-inscricoes') {
    if (!usuarioAtual) {
      abrirModalAuth('login');
      return;
    }
    carregarMinhasInscricoes();
  } else if (view === 'gerenciar-inscritos') {
    if (!usuarioAtual || usuarioAtual.tipo !== 'organizador') {
      mostrarToast('Apenas organizadores podem acessar esta tela.', 'erro');
      navegarPara('eventos');
      return;
    }
    carregarTodasInscricoes();
  }
}

// 4. CARREGAR E RENDERIZAR EVENTOS
async function carregarEventos() {
  try {
    const res = await fetch('/api/events');
    const data = await res.json();
    eventosGlobais = data.eventos || [];
    renderizarCardsEventos(eventosGlobais);
  } catch (err) {
    mostrarToast('Erro ao carregar lista de eventos.', 'erro');
  }
}

function filtrarEventos() {
  const busca = (document.getElementById('filtro-busca').value || '').toLowerCase();
  const categoria = document.getElementById('filtro-categoria').value;

  const filtrados = eventosGlobais.filter(evt => {
    const matchBusca = evt.titulo.toLowerCase().includes(busca) || evt.local.toLowerCase().includes(busca);
    const matchCategoria = categoria === 'todos' || evt.categoria === categoria;
    return matchBusca && matchCategoria;
  });

  renderizarCardsEventos(filtrados);
}

function formatarData(dataISO) {
  if (!dataISO) return '';
  const d = new Date(dataISO);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function renderizarCardsEventos(lista) {
  const container = document.getElementById('grid-eventos');
  const vazio = document.getElementById('eventos-vazio');

  if (lista.length === 0) {
    container.innerHTML = '';
    vazio.classList.remove('hidden');
    return;
  }

  vazio.classList.add('hidden');
  container.innerHTML = lista
    .map(evt => {
      const cancelado = evt.status === 'cancelado';
      const esgotado = evt.vagasRestantes <= 0;
      const isOrg = usuarioAtual && usuarioAtual.tipo === 'organizador';

      let botaoAcao = '';

      if (isOrg) {
        botaoAcao = `
          <div class="flex gap-2 w-full mt-4">
            <button onclick="editarEvento('${evt.id}')" class="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1">
              <i class="fa-solid fa-pen-to-square"></i> Editar
            </button>
            <button onclick="alternarStatusEvento('${evt.id}')" class="flex-1 py-2 ${cancelado ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700' : 'bg-rose-50 hover:bg-rose-100 text-rose-700'} font-bold text-xs rounded-lg transition flex items-center justify-center gap-1">
              <i class="fa-solid ${cancelado ? 'fa-check' : 'fa-ban'}"></i> ${cancelado ? 'Reativar' : 'Cancelar Evento'}
            </button>
          </div>
        `;
      } else {
        if (cancelado) {
          botaoAcao = `
            <div class="w-full mt-4 py-2 bg-slate-100 text-slate-400 font-bold text-xs text-center rounded-lg cursor-not-allowed">
              Evento Cancelado
            </div>
          `;
        } else if (evt.estaInscrito) {
          botaoAcao = `
            <div class="w-full mt-4 space-y-2">
              <div class="py-2 bg-emerald-50 text-emerald-700 font-bold text-xs text-center rounded-lg border border-emerald-200 flex items-center justify-center gap-1">
                <i class="fa-solid fa-circle-check"></i> Você está inscrito! ${evt.presencaConfirmada ? '(Presença Confirmada)' : ''}
              </div>
              <button onclick="cancelarInscricao('${evt.id}')" class="w-full py-1.5 text-xs text-rose-600 hover:text-rose-800 hover:underline text-center">
                Cancelar minha inscrição
              </button>
            </div>
          `;
        } else if (esgotado) {
          botaoAcao = `
            <div class="w-full mt-4 py-2 bg-amber-50 text-amber-700 font-bold text-xs text-center rounded-lg border border-amber-200">
              Vagas Esgotadas
            </div>
          `;
        } else {
          botaoAcao = `
            <button onclick="inscreverNoEvento('${evt.id}')" class="w-full mt-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-sm transition flex items-center justify-center gap-1.5">
              <i class="fa-solid fa-ticket"></i> Inscrever-se Agora
            </button>
          `;
        }
      }

      return `
        <div class="card-evento bg-white rounded-2xl border border-slate-200 overflow-hidden flex flex-col justify-between p-5 relative ${cancelado ? 'opacity-70 bg-slate-50' : ''}">
          <div>
            <div class="flex justify-between items-start gap-2 mb-2">
              <span class="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700">
                ${evt.categoria}
              </span>
              ${
                cancelado
                  ? `<span class="badge-status bg-rose-100 text-rose-700"><i class="fa-solid fa-ban"></i> Cancelado</span>`
                  : esgotado
                  ? `<span class="badge-status bg-amber-100 text-amber-800"><i class="fa-solid fa-lock"></i> Esgotado</span>`
                  : `<span class="badge-status bg-emerald-100 text-emerald-800"><i class="fa-solid fa-check"></i> Aberto</span>`
              }
            </div>

            <h3 class="text-base font-bold text-slate-800 mt-2 mb-1 line-clamp-2">${evt.titulo}</h3>
            <p class="text-xs text-slate-500 mb-4 line-clamp-3">${evt.descricao || 'Sem descrição detalhada.'}</p>

            <div class="space-y-1.5 text-xs text-slate-600 border-t border-slate-100 pt-3">
              <div class="flex items-center gap-2">
                <i class="fa-regular fa-clock text-indigo-500 w-4"></i>
                <span>${formatarData(evt.data)}</span>
              </div>
              <div class="flex items-center gap-2">
                <i class="fa-solid fa-location-dot text-rose-500 w-4"></i>
                <span class="truncate">${evt.local}</span>
              </div>
              <div class="flex items-center gap-2">
                <i class="fa-solid fa-users text-slate-400 w-4"></i>
                <span><strong>${evt.totalInscritos}</strong> de <strong>${evt.vagas}</strong> vagas (${evt.vagasRestantes} restantes)</span>
              </div>
            </div>
          </div>

          <div>
            ${botaoAcao}
          </div>
        </div>
      `;
    })
    .join('');
}

// 5. INSCRIÇÃO E CANCELAMENTO DE INSCRIÇÃO
async function inscreverNoEvento(eventoId) {
  if (!usuarioAtual) {
    mostrarToast('Você precisa entrar na sua conta para se inscrever.', 'aviso');
    abrirModalAuth('login');
    return;
  }

  try {
    const res = await fetch(`/api/events/${eventoId}/inscrever`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await res.json();

    if (res.ok) {
      mostrarToast(data.mensagem, 'sucesso');
      await carregarEventos();
    } else {
      mostrarToast(data.error || 'Erro ao realizar inscrição', 'erro');
    }
  } catch (err) {
    mostrarToast('Falha na comunicação com o servidor.', 'erro');
  }
}

async function cancelarInscricao(eventoId) {
  if (!confirm('Deseja realmente cancelar sua inscrição neste evento?')) return;

  try {
    const res = await fetch(`/api/events/${eventoId}/cancelar-inscricao`, {
      method: 'DELETE'
    });
    const data = await res.json();

    if (res.ok) {
      mostrarToast(data.mensagem, 'sucesso');
      await carregarEventos();
      if (vistaAtual === 'minhas-inscricoes') {
        carregarMinhasInscricoes();
      }
    } else {
      mostrarToast(data.error || 'Erro ao cancelar inscrição', 'erro');
    }
  } catch (err) {
    mostrarToast('Falha na comunicação com o servidor.', 'erro');
  }
}

// 6. MINHAS INSCRIÇÕES (PARTICIPANTE)
async function carregarMinhasInscricoes() {
  try {
    const res = await fetch('/api/events/minhas-inscricoes');
    const data = await res.json();
    const inscricoes = data.inscricoes || [];

    const container = document.getElementById('lista-minhas-inscricoes');
    const vazio = document.getElementById('minhas-inscricoes-vazio');

    if (inscricoes.length === 0) {
      container.innerHTML = '';
      vazio.classList.remove('hidden');
      return;
    }

    vazio.classList.add('hidden');
    container.innerHTML = inscricoes
      .map(item => {
        const evt = item.evento;
        return `
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
            <div>
              <div class="flex justify-between items-start gap-2 mb-2">
                <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                  ${evt.categoria || 'Evento'}
                </span>
                ${
                  item.presencaConfirmada
                    ? `<span class="badge-status bg-emerald-100 text-emerald-800"><i class="fa-solid fa-circle-check"></i> Presença Confirmada</span>`
                    : `<span class="badge-status bg-blue-100 text-blue-800"><i class="fa-solid fa-clock"></i> Inscrição Ativa</span>`
                }
              </div>
              <h3 class="text-base font-bold text-slate-800 mb-1">${evt.titulo}</h3>
              <p class="text-xs text-slate-500 mb-3"><i class="fa-regular fa-calendar mr-1"></i> Data: <strong>${formatarData(evt.data)}</strong></p>
              <p class="text-xs text-slate-500 mb-3"><i class="fa-solid fa-location-dot mr-1 text-rose-500"></i> ${evt.local}</p>
            </div>
            <div class="border-t border-slate-100 pt-3 flex items-center justify-between">
              <span class="text-[11px] text-slate-400">Inscrito em: ${new Date(item.inscritoEm).toLocaleDateString('pt-BR')}</span>
              <button onclick="cancelarInscricao('${evt.id}')" class="px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition">
                Cancelar Inscrição
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    mostrarToast('Erro ao carregar suas inscrições.', 'erro');
  }
}

// 7. GERENCIAMENTO DE INSCRITOS & CHECK-IN (ORGANIZADOR)
async function carregarTodasInscricoes() {
  try {
    const res = await fetch('/api/events/todas-inscricoes');
    const data = await res.json();
    todasInscricoesGlobais = data.inscricoes || [];

    // Preenche seletor de eventos para filtro
    const select = document.getElementById('filtro-evento-presenca');
    const eventosMap = {};
    todasInscricoesGlobais.forEach(i => {
      eventosMap[i.eventoId] = i.eventoTitulo;
    });

    select.innerHTML = `<option value="todos">Todos os Eventos (${todasInscricoesGlobais.length} inscrições)</option>` +
      Object.keys(eventosMap).map(id => `<option value="${id}">${eventosMap[id]}</option>`).join('');

    renderizarTabelaInscritos();
  } catch (err) {
    mostrarToast('Erro ao carregar lista de presença.', 'erro');
  }
}

function renderizarTabelaInscritos() {
  const filtroId = document.getElementById('filtro-evento-presenca').value;
  const tbody = document.getElementById('tabela-inscritos-corpo');
  const vazia = document.getElementById('tabela-inscritos-vazia');

  const filtrados = todasInscricoesGlobais.filter(item => {
    return filtroId === 'todos' || item.eventoId === filtroId;
  });

  if (filtrados.length === 0) {
    tbody.innerHTML = '';
    vazia.classList.remove('hidden');
    return;
  }

  vazia.classList.add('hidden');
  tbody.innerHTML = filtrados
    .map(r => {
      return `
        <tr class="hover:bg-slate-50 transition">
          <td class="px-6 py-4">
            <div class="font-bold text-slate-800">${r.participanteNome}</div>
            <div class="text-xs text-slate-400">${r.participanteEmail}</div>
          </td>
          <td class="px-6 py-4">
            <div class="font-semibold text-slate-700">${r.eventoTitulo}</div>
            <div class="text-xs text-slate-400">${formatarData(r.eventoData)}</div>
          </td>
          <td class="px-6 py-4 text-xs text-slate-500">
            ${new Date(r.inscritoEm).toLocaleString('pt-BR')}
          </td>
          <td class="px-6 py-4 text-center">
            ${
              r.presencaConfirmada
                ? `<span class="badge-status bg-emerald-100 text-emerald-800"><i class="fa-solid fa-circle-check"></i> Presente</span>`
                : `<span class="badge-status bg-slate-100 text-slate-600"><i class="fa-regular fa-clock"></i> Pendente</span>`
            }
          </td>
          <td class="px-6 py-4 text-center">
            <button onclick="confirmarPresenca('${r.inscricaoId}')" class="px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-xs ${
              r.presencaConfirmada
                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }">
              <i class="fa-solid ${r.presencaConfirmada ? 'fa-xmark' : 'fa-check'} mr-1"></i>
              ${r.presencaConfirmada ? 'Desfazer Check-in' : 'Confirmar Presença'}
            </button>
          </td>
        </tr>
      `;
    })
    .join('');
}

async function confirmarPresenca(inscricaoId) {
  try {
    const res = await fetch(`/api/events/inscricoes/${inscricaoId}/confirmar-presenca`, {
      method: 'PATCH'
    });
    const data = await res.json();

    if (res.ok) {
      mostrarToast(data.mensagem, 'sucesso');
      await carregarTodasInscricoes();
    } else {
      mostrarToast(data.error || 'Erro ao atualizar presença', 'erro');
    }
  } catch (err) {
    mostrarToast('Falha ao comunicar com o servidor.', 'erro');
  }
}

// 8. CRUD DE EVENTOS (ORGANIZADOR)
function abrirModalEvento() {
  document.getElementById('modal-evento-titulo').textContent = 'Criar Novo Evento';
  document.getElementById('evento-id').value = '';
  document.getElementById('evento-titulo').value = '';
  document.getElementById('evento-descricao').value = '';
  document.getElementById('evento-categoria').value = 'Tecnologia';
  document.getElementById('evento-data').value = '';
  document.getElementById('evento-local').value = '';
  document.getElementById('evento-vagas').value = '50';
  document.getElementById('evento-erro').classList.add('hidden');
  document.getElementById('modal-evento').classList.remove('hidden');
}

function editarEvento(id) {
  const evt = eventosGlobais.find(e => e.id === id);
  if (!evt) return;

  document.getElementById('modal-evento-titulo').textContent = 'Editar Evento';
  document.getElementById('evento-id').value = evt.id;
  document.getElementById('evento-titulo').value = evt.titulo;
  document.getElementById('evento-descricao').value = evt.descricao || '';
  document.getElementById('evento-categoria').value = evt.categoria || 'Tecnologia';
  document.getElementById('evento-data').value = evt.data ? evt.data.slice(0, 16) : '';
  document.getElementById('evento-local').value = evt.local;
  document.getElementById('evento-vagas').value = evt.vagas;
  document.getElementById('evento-erro').classList.add('hidden');
  document.getElementById('modal-evento').classList.remove('hidden');
}

function fecharModalEvento() {
  document.getElementById('modal-evento').classList.add('hidden');
}

async function salvarEvento(e) {
  e.preventDefault();
  const id = document.getElementById('evento-id').value;
  const erroDiv = document.getElementById('evento-erro');
  erroDiv.classList.add('hidden');

  const payload = {
    titulo: document.getElementById('evento-titulo').value,
    descricao: document.getElementById('evento-descricao').value,
    categoria: document.getElementById('evento-categoria').value,
    data: document.getElementById('evento-data').value,
    local: document.getElementById('evento-local').value,
    vagas: document.getElementById('evento-vagas').value
  };

  const url = id ? `/api/events/${id}` : '/api/events';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok) {
      fecharModalEvento();
      mostrarToast(data.mensagem, 'sucesso');
      await carregarEventos();
    } else {
      erroDiv.textContent = data.error || 'Erro ao salvar evento.';
      erroDiv.classList.remove('hidden');
    }
  } catch (err) {
    erroDiv.textContent = 'Erro ao conectar ao servidor.';
    erroDiv.classList.remove('hidden');
  }
}

async function alternarStatusEvento(id) {
  try {
    const res = await fetch(`/api/events/${id}/toggle-status`, { method: 'PATCH' });
    const data = await res.json();
    if (res.ok) {
      mostrarToast(data.mensagem, 'sucesso');
      await carregarEventos();
    } else {
      mostrarToast(data.error || 'Erro ao alterar status', 'erro');
    }
  } catch (err) {
    mostrarToast('Falha na comunicação com o servidor.', 'erro');
  }
}

// 9. MODAIS E FORMULÁRIOS DE AUTENTICAÇÃO
function abrirModalAuth(modo = 'login') {
  trocarAbaAuth(modo);
  document.getElementById('modal-auth').classList.remove('hidden');
}

function fecharModalAuth() {
  document.getElementById('modal-auth').classList.add('hidden');
}

function trocarAbaAuth(modo) {
  const abaLogin = document.getElementById('aba-login');
  const abaCadastro = document.getElementById('aba-cadastro');
  const formLogin = document.getElementById('form-login');
  const formCadastro = document.getElementById('form-cadastro');

  if (modo === 'login') {
    abaLogin.className = 'flex-1 py-3 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600';
    abaCadastro.className = 'flex-1 py-3 text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-slate-600';
    formLogin.classList.remove('hidden');
    formCadastro.classList.add('hidden');
  } else {
    abaCadastro.className = 'flex-1 py-3 text-sm font-bold border-b-2 border-indigo-600 text-indigo-600';
    abaLogin.className = 'flex-1 py-3 text-sm font-bold border-b-2 border-transparent text-slate-400 hover:text-slate-600';
    formCadastro.classList.remove('hidden');
    formLogin.classList.add('hidden');
  }
}

async function submeterLogin(e) {
  e.preventDefault();
  const erroDiv = document.getElementById('login-erro');
  erroDiv.classList.add('hidden');

  const email = document.getElementById('login-email').value;
  const senha = document.getElementById('login-senha').value;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });
    const data = await res.json();

    if (res.ok) {
      usuarioAtual = data.user;
      fecharModalAuth();
      atualizarInterfaceUsuario();
      mostrarToast(`Bem-vindo de volta, ${usuarioAtual.nome}!`, 'sucesso');
      await carregarEventos();
    } else {
      erroDiv.textContent = data.error || 'Credenciais inválidas.';
      erroDiv.classList.remove('hidden');
    }
  } catch (err) {
    erroDiv.textContent = 'Erro ao tentar conectar ao servidor.';
    erroDiv.classList.remove('hidden');
  }
}

async function submeterCadastro(e) {
  e.preventDefault();
  const erroDiv = document.getElementById('cad-erro');
  erroDiv.classList.add('hidden');

  const nome = document.getElementById('cad-nome').value;
  const email = document.getElementById('cad-email').value;
  const senha = document.getElementById('cad-senha').value;
  const tipo = document.querySelector('input[name="cad-tipo"]:checked').value;

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha, tipo })
    });
    const data = await res.json();

    if (res.ok) {
      usuarioAtual = data.user;
      fecharModalAuth();
      atualizarInterfaceUsuario();
      mostrarToast('Conta criada com sucesso!', 'sucesso');
      await carregarEventos();
    } else {
      erroDiv.textContent = data.error || 'Erro ao realizar cadastro.';
      erroDiv.classList.remove('hidden');
    }
  } catch (err) {
    erroDiv.textContent = 'Erro ao tentar conectar ao servidor.';
    erroDiv.classList.remove('hidden');
  }
}

async function fazerLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    usuarioAtual = null;
    atualizarInterfaceUsuario();
    navegarPara('eventos');
    mostrarToast('Você saiu da sua conta.', 'aviso');
  } catch (err) {
    usuarioAtual = null;
    atualizarInterfaceUsuario();
  }
}

// 10. NOTIFICAÇÕES (TOAST)
function mostrarToast(mensagem, tipo = 'sucesso') {
  const toast = document.getElementById('toast');
  const msg = document.getElementById('toast-msg');
  const icon = document.getElementById('toast-icon');

  msg.textContent = mensagem;

  if (tipo === 'sucesso') {
    icon.className = 'fa-solid fa-circle-check text-emerald-400 text-lg';
  } else if (tipo === 'erro') {
    icon.className = 'fa-solid fa-circle-exclamation text-rose-400 text-lg';
  } else {
    icon.className = 'fa-solid fa-circle-info text-amber-400 text-lg';
  }

  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}
