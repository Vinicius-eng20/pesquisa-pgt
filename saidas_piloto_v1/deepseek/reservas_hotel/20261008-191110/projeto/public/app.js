// ---------- ESTADO ----------
let usuario = null;
let abaLogin = 'login';

// ---------- UTILITÁRIOS ----------
async function api(url, opcoes = {}) {
  const resp = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opcoes
  });
  let dados = null;
  try { dados = await resp.json(); } catch (e) {}
  if (!resp.ok) {
    throw new Error((dados && dados.erro) || 'Ocorreu um erro.');
  }
  return dados;
}

function el(id) { return document.getElementById(id); }

function escapar(txt) {
  if (txt === undefined || txt === null) return '';
  return String(txt)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatarData(data) {
  if (!data) return '';
  const [a, m, d] = data.split('-');
  return `${d}/${m}/${a}`;
}

function hoje() {
  return new Date().toISOString().split('T')[0];
}

function mostrarMensagem(texto, tipo = 'erro') {
  const box = el('mensagem');
  if (!box) return;
  box.textContent = texto;
  box.className = 'mensagem ' + (tipo === 'ok' ? 'ok' : 'erro');
  setTimeout(() => {
    if (box) box.className = 'mensagem oculto';
  }, 5000);
}

// ---------- INICIALIZAÇÃO ----------
async function iniciar() {
  try {
    usuario = await api('/api/eu');
  } catch (e) {
    usuario = null;
  }
  renderUsuario();
  renderConteudo();
}

function renderUsuario() {
  const area = el('area-usuario');
  if (usuario) {
    area.innerHTML = `
      <span>Olá, <strong>${escapar(usuario.nome)}</strong> (${usuario.tipo === 'gerente' ? 'Gerente' : 'Hóspede'})</span>
      <button class="secundario" id="btn-sair">Sair</button>
    `;
    el('btn-sair').onclick = async () => {
      await api('/api/logout', { method: 'POST' });
      usuario = null;
      renderUsuario();
      renderConteudo();
    };
  } else {
    area.innerHTML = '';
  }
}

// ---------- RENDER PRINCIPAL ----------
function renderConteudo() {
  const app = el('app');
  if (!usuario) {
    renderLogin(app);
  } else if (usuario.tipo === 'gerente') {
    renderGerente(app);
  } else {
    renderHospede(app);
  }
}

// ---------- LOGIN / REGISTRO ----------
function renderLogin(app) {
  app.innerHTML = `
    <div class="card centro">
      <div class="abas">
        <button id="aba-login" class="${abaLogin === 'login' ? 'ativa' : ''}">Entrar</button>
        <button id="aba-registrar" class="${abaLogin === 'registrar' ? 'ativa' : ''}">Criar conta</button>
      </div>
      <div id="mensagem" class="mensagem oculto"></div>
      <div id="form-area"></div>
      <p style="margin-top:18px; font-size:13px; color:#7a8899; text-align:center;">
        Área do gerente: gerente@hotel.com / admin123
      </p>
    </div>
  `;
  el('aba-login').onclick = () => { abaLogin = 'login'; renderLogin(app); };
  el('aba-registrar').onclick = () => { abaLogin = 'registrar'; renderLogin(app); };
  renderFormAuth();
}

function renderFormAuth() {
  const area = el('form-area');
  if (abaLogin === 'login') {
    area.innerHTML = `
      <label>Email</label>
      <input type="email" id="f-email" placeholder="seu@email.com" />
      <label>Senha</label>
      <input type="password" id="f-senha" placeholder="Sua senha" />
      <div class="form-acoes">
        <button id="f-enviar">Entrar</button>
      </div>
    `;
    el('f-enviar').onclick = async () => {
      try {
        const email = el('f-email').value.trim();
        const senha = el('f-senha').value;
        usuario = await api('/api/login', {
          method: 'POST',
          body: JSON.stringify({ email, senha })
        }).then(r => r.usuario);
        renderUsuario();
        renderConteudo();
      } catch (e) {
        mostrarMensagem(e.message, 'erro');
      }
    };
  } else {
    area.innerHTML = `
      <label>Nome completo</label>
      <input type="text" id="f-nome" placeholder="Seu nome" />
      <label>Email</label>
      <input type="email" id="f-email" placeholder="seu@email.com" />
      <label>Senha</label>
      <input type="password" id="f-senha" placeholder="Escolha uma senha" />
      <div class="form-acoes">
        <button id="f-enviar">Criar conta</button>
      </div>
    `;
    el('f-enviar').onclick = async () => {
      try {
        const nome = el('f-nome').value.trim();
        const email = el('f-email').value.trim();
        const senha = el('f-senha').value;
        usuario = await api('/api/registrar', {
          method: 'POST',
          body: JSON.stringify({ nome, email, senha })
        }).then(r => r.usuario);
        renderUsuario();
        renderConteudo();
      } catch (e) {
        mostrarMensagem(e.message, 'erro');
      }
    };
  }
}

// ================= HÓSPEDE =================
let abaHospede = 'buscar';

function renderHospede(app) {
  app.innerHTML = `
    <div class="abas">
      <button id="aba-buscar" class="${abaHospede === 'buscar' ? 'ativa' : ''}">Buscar quartos</button>
      <button id="aba-minhas" class="${abaHospede === 'minhas' ? 'ativa' : ''}">Minhas reservas</button>
    </div>
    <div id="mensagem" class="mensagem oculto"></div>
    <div id="conteudo-hospede"></div>
  `;
  el('aba-buscar').onclick = () => { abaHospede = 'buscar'; renderHospede(app); };
  el('aba-minhas').onclick = () => { abaHospede = 'minhas'; renderHospede(app); };
  if (abaHospede === 'buscar') renderBuscarQuartos();
  else renderMinhasReservas();
}

async function renderBuscarQuartos() {
  const area = el('conteudo-hospede');
  area.innerHTML = `
    <div class="card">
      <h2>Buscar quartos disponíveis</h2>
      <div class="form-linha">
        <div>
          <label>Data de entrada</label>
          <input type="date" id="busca-inicio" min="${hoje()}" />
        </div>
        <div>
          <label>Data de saída</label>
          <input type="date" id="busca-fim" min="${hoje()}" />
        </div>
        <div style="display:flex; align-items:flex-end;">
          <button id="btn-buscar" style="width:100%;">Buscar</button>
        </div>
      </div>
    </div>
    <div id="lista-quartos"></div>
  `;
  el('btn-buscar').onclick = buscarQuartos;
  await buscarQuartos();
}

async function buscarQuartos() {
  const area = el('lista-quartos');
  const inicio = el('busca-inicio').value;
  const fim = el('busca-fim').value;

  area.innerHTML = '<p class="vazio">Carregando...</p>';
  try {
    let url = '/api/disponiveis';
    if (inicio && fim) url += `?dataInicio=${inicio}&dataFim=${fim}`;
    const quartos = await api(url);
    if (quartos.length === 0) {
      area.innerHTML = '<div class="card vazio">Nenhum quarto disponível para estas datas.</div>';
      return;
    }
    const html = quartos.map(q => `
      <div class="quarto">
        <h3>Quarto ${escapar(q.numero)}</h3>
        <div class="tipo">${escapar(q.tipo)}</div>
        <div class="capacidade">👥 ${q.capacidade} pessoa(s)</div>
        <div class="desc">${escapar(q.descricao || '')}</div>
        <div class="preco">R$ ${Number(q.preco).toFixed(2)} <small>/ noite</small></div>
        <button data-reservar="${q.id}">Reservar</button>
      </div>
    `).join('');
    area.innerHTML = `<div class="grid">${html}</div>`;
    area.querySelectorAll('[data-reservar]').forEach(btn => {
      btn.onclick = () => reservarQuarto(Number(btn.dataset.reservar));
    });
  } catch (e) {
    area.innerHTML = `<div class="card"><div class="mensagem erro">${escapar(e.message)}</div></div>`;
  }
}

function reservarQuarto(quartoId) {
  const inicio = el('busca-inicio').value;
  const fim = el('busca-fim').value;
  if (!inicio || !fim) {
    mostrarMensagem('Escolha as datas de entrada e saída para reservar.', 'erro');
    return;
  }
  if (fim <= inicio) {
    mostrarMensagem('A data de saída deve ser depois da data de entrada.', 'erro');
    return;
  }
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px;z-index:100;';
  modal.innerHTML = `
    <div class="card" style="max-width:440px;width:100%;margin:0;">
      <h3>Confirmar reserva</h3>
      <p style="margin:10px 0; color:#37485c;">
        Quarto selecionado<br>
        <strong>Entrada:</strong> ${formatarData(inicio)}<br>
        <strong>Saída:</strong> ${formatarData(fim)}
      </p>
      <div id="mensagem-modal" class="mensagem oculto"></div>
      <div class="form-acoes">
        <button id="btn-confirmar">Confirmar reserva</button>
        <button class="secundario" id="btn-fechar">Cancelar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  el('btn-fechar').onclick = () => modal.remove();
  el('btn-confirmar').onclick = async () => {
    try {
      await api('/api/reservas', {
        method: 'POST',
        body: JSON.stringify({ quartoId, dataInicio: inicio, dataFim: fim })
      });
      modal.remove();
      mostrarMensagem('Reserva enviada! Aguarde a confirmação do gerente.', 'ok');
      abaHospede = 'minhas';
      renderHospede(el('app'));
    } catch (e) {
      const box = el('mensagem-modal');
      if (box) {
        box.textContent = e.message;
        box.className = 'mensagem erro';
      }
    }
  };
}

async function renderMinhasReservas() {
  const area = el('conteudo-hospede');
  area.innerHTML = '<p class="vazio">Carregando...</p>';
  try {
    const reservas = await api('/api/minhas-reservas');
    if (reservas.length === 0) {
      area.innerHTML = '<div class="card vazio">Você ainda não fez nenhuma reserva.</div>';
      return;
    }
    area.innerHTML = reservas.map(r => montarReserva(r, true)).join('');
    area.querySelectorAll('[data-cancelar]').forEach(btn => {
      btn.onclick = async () => {
        if (!confirm('Deseja realmente cancelar esta reserva?')) return;
        try {
          await api(`/api/reservas/${btn.dataset.cancelar}/cancelar`, { method: 'POST' });
          mostrarMensagem('Reserva cancelada.', 'ok');
          renderMinhasReservas();
        } catch (e) {
          mostrarMensagem(e.message, 'erro');
        }
      };
    });
  } catch (e) {
    area.innerHTML = `<div class="card"><div class="mensagem erro">${escapar(e.message)}</div></div>`;
  }
}

function montarReserva(r, podeCancelar) {
  const status = r.status;
  const labelStatus = {
    pendente: 'Pendente',
    confirmada: 'Confirmada',
    cancelada: 'Cancelada',
    recusada: 'Recusada'
  }[status] || status;

  const botoes = [];
  if (podeCancelar && (status === 'pendente' || status === 'confirmada')) {
    botoes.push(`<button class="perigo" data-cancelar="${r.id}">Cancelar reserva</button>`);
  }

  return `
    <div class="reserva ${status}">
      <div class="linha">
        <h3>Quarto ${escapar(r.quartoNumero)} &mdash; ${escapar(r.quartoTipo)}</h3>
        <span class="status ${status}">${labelStatus}</span>
      </div>
      <div class="dados">👤 ${escapar(r.usuarioNome)} (${escapar(r.usuarioEmail)})</div>
      <div class="dados">📅 Entrada: ${formatarData(r.dataInicio)} &nbsp;&nbsp; Saída: ${formatarData(r.dataFim)}</div>
      ${botoes.length ? `<div class="acoes">${botoes.join('')}</div>` : ''}
    </div>
  `;
}

// ================= GERENTE =================
let abaGerente = 'reservas';
let filtroStatus = 'todas';

function renderGerente(app) {
  app.innerHTML = `
    <div class="abas">
      <button id="aba-reservas" class="${abaGerente === 'reservas' ? 'ativa' : ''}">Reservas</button>
      <button id="aba-quartos" class="${abaGerente === 'quartos' ? 'ativa' : ''}">Quartos</button>
    </div>
    <div id="mensagem" class="mensagem oculto"></div>
    <div id="conteudo-gerente"></div>
  `;
  el('aba-reservas').onclick = () => { abaGerente = 'reservas'; renderGerente(app); };
  el('aba-quartos').onclick = () => { abaGerente = 'quartos'; renderGerente(app); };
  if (abaGerente === 'reservas') renderReservasGerente();
  else renderQuartosGerente();
}

async function renderReservasGerente() {
  const area = el('conteudo-gerente');
  area.innerHTML = '<p class="vazio">Carregando...</p>';
  try {
    const reservas = await api('/api/gerente/reservas');
    let lista = reservas;
    if (filtroStatus !== 'todas') {
      lista = reservas.filter(r => r.status === filtroStatus);
    }
    area.innerHTML = `
      <div class="card">
        <h2>Todas as reservas</h2>
        <label>Filtrar por status</label>
        <select id="filtro-status">
          <option value="todas" ${filtroStatus === 'todas' ? 'selected' : ''}>Todas</option>
          <option value="pendente" ${filtroStatus === 'pendente' ? 'selected' : ''}>Pendentes</option>
          <option value="confirmada" ${filtroStatus === 'confirmada' ? 'selected' : ''}>Confirmadas</option>
          <option value="cancelada" ${filtroStatus === 'cancelada' ? 'selected' : ''}>Canceladas</option>
          <option value="recusada" ${filtroStatus === 'recusada' ? 'selected' : ''}>Recusadas</option>
        </select>
      </div>
      <div id="lista-reservas"></div>
    `;
    el('filtro-status').onchange = (e) => {
      filtroStatus = e.target.value;
      renderReservasGerente();
    };

    const listaEl = el('lista-reservas');
    if (lista.length === 0) {
      listaEl.innerHTML = '<div class="card vazio">Nenhuma reserva encontrada.</div>';
      return;
    }
    listaEl.innerHTML = lista.map(r => {
      const status = r.status;
      const labelStatus = {
        pendente: 'Pendente', confirmada: 'Confirmada',
        cancelada: 'Cancelada', recusada: 'Recusada'
      }[status] || status;
      const botoes = [];
      if (status === 'pendente') {
        botoes.push(`<button class="sucesso" data-confirmar="${r.id}">Confirmar</button>`);
        botoes.push(`<button class="aviso" data-recusar="${r.id}">Recusar</button>`);
      }
      if (status === 'confirmada') {
        botoes.push(`<button class="perigo" data-cancelar-ger="${r.id}">Cancelar</button>`);
      }
      return `
        <div class="reserva ${status}">
          <div class="linha">
            <h3>Reserva #${r.id} &mdash; Quarto ${escapar(r.quartoNumero)} (${escapar(r.quartoTipo)})</h3>
            <span class="status ${status}">${labelStatus}</span>
          </div>
          <div class="dados">👤 ${escapar(r.usuarioNome)} (${escapar(r.usuarioEmail)})</div>
          <div class="dados">📅 Entrada: ${formatarData(r.dataInicio)} &nbsp;&nbsp; Saída: ${formatarData(r.dataFim)}</div>
          ${botoes.length ? `<div class="acoes">${botoes.join('')}</div>` : ''}
        </div>
      `;
    }).join('');

    listaEl.querySelectorAll('[data-confirmar]').forEach(b => {
      b.onclick = () => acaoReserva(b.dataset.confirmar, 'confirmar');
    });
    listaEl.querySelectorAll('[data-recusar]').forEach(b => {
      b.onclick = () => acaoReserva(b.dataset.recusar, 'recusar');
    });
    listaEl.querySelectorAll('[data-cancelar-ger]').forEach(b => {
      b.onclick = async () => {
        if (!confirm('Cancelar esta reserva confirmada?')) return;
        try {
          await api(`/api/reservas/${b.dataset.cancelarGer}/cancelar`, { method: 'POST' });
          mostrarMensagem('Reserva cancelada.', 'ok');
          renderReservasGerente();
        } catch (e) { mostrarMensagem(e.message, 'erro'); }
      };
    });
  } catch (e) {
    area.innerHTML = `<div class="card"><div class="mensagem erro">${escapar(e.message)}</div></div>`;
  }
}

async function acaoReserva(id, acao) {
  try {
    await api(`/api/gerente/reservas/${id}/${acao}`, { method: 'POST' });
    mostrarMensagem(acao === 'confirmar' ? 'Reserva confirmada!' : 'Reserva recusada.', 'ok');
    renderReservasGerente();
  } catch (e) {
    mostrarMensagem(e.message, 'erro');
  }
}

async function renderQuartosGerente() {
  const area = el('conteudo-gerente');
  area.innerHTML = '<p class="vazio">Carregando...</p>';
  try {
    const quartos = await api('/api/quartos');
    area.innerHTML = `
      <div class="card">
        <h2>Cadastrar novo quarto</h2>
        <div id="form-quarto-erro" class="mensagem oculto"></div>
        <div class="form-linha">
          <div>
            <label>Número</label>
            <input type="text" id="q-numero" placeholder="Ex: 401" />
          </div>
          <div>
            <label>Tipo</label>
            <input type="text" id="q-tipo" placeholder="Ex: Casal, Suíte..." />
          </div>
        </div>
        <div class="form-linha">
          <div>
            <label>Capacidade (pessoas)</label>
            <input type="number" id="q-capacidade" min="1" value="2" />
          </div>
          <div>
            <label>Preço por noite (R$)</label>
            <input type="number" id="q-preco" min="0" step="0.01" value="200" />
          </div>
        </div>
        <label>Descrição</label>
        <textarea id="q-descricao" rows="2" placeholder="Detalhes do quarto..."></textarea>
        <div class="form-acoes">
          <button id="btn-criar-quarto">Cadastrar quarto</button>
        </div>
      </div>

      <div class="card">
        <h2>Quartos cadastrados</h2>
        <div id="tabela-quartos"></div>
      </div>
    `;

    el('btn-criar-quarto').onclick = async () => {
      const box = el('form-quarto-erro');
      try {
        await api('/api/gerente/quartos', {
          method: 'POST',
          body: JSON.stringify({
            numero: el('q-numero').value.trim(),
            tipo: el('q-tipo').value.trim(),
            capacidade: el('q-capacidade').value,
            preco: el('q-preco').value,
            descricao: el('q-descricao').value.trim()
          })
        });
        mostrarMensagem('Quarto cadastrado com sucesso!', 'ok');
        renderQuartosGerente();
      } catch (e) {
        box.textContent = e.message;
        box.className = 'mensagem erro';
      }
    };

    renderTabelaQuartos(quartos);
  } catch (e) {
    area.innerHTML = `<div class="card"><div class="mensagem erro">${escapar(e.message)}</div></div>`;
  }
}

function renderTabelaQuartos(quartos) {
  const el2 = el('tabela-quartos');
  if (!quartos.length) {
    el2.innerHTML = '<p class="vazio">Nenhum quarto cadastrado.</p>';
    return;
  }
  el2.innerHTML = `
    <table class="tabela">
      <thead>
        <tr>
          <th>Número</th><th>Tipo</th><th>Capacidade</th><th>Preço</th><th>Ações</th>
        </tr>
      </thead>
      <tbody>
        ${quartos.map(q => `
          <tr>
            <td>${escapar(q.numero)}</td>
            <td>${escapar(q.tipo)}</td>
            <td>${q.capacidade}</td>
            <td>R$ ${Number(q.preco).toFixed(2)}</td>
            <td>
              <button class="secundario" data-editar="${q.id}">Editar</button>
              <button class="perigo" data-remover="${q.id}">Remover</button>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  el2.querySelectorAll('[data-editar]').forEach(b => {
    b.onclick = () => editarQuarto(Number(b.dataset.editar), quartos);
  });
  el2.querySelectorAll('[data-remover]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Remover este quarto?')) return;
      try {
        await api(`/api/gerente/quartos/${b.dataset.remover}`, { method: 'DELETE' });
        mostrarMensagem('Quarto removido.', 'ok');
        renderQuartosGerente();
      } catch (e) { mostrarMensagem(e.message, 'erro'); }
    };
  });
}

function editarQuarto(id, quartos) {
  const q = quartos.find(x => x.id === id);
  if (!q) return;
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:20px;z-index:100;';
  modal.innerHTML = `
    <div class="card" style="max-width:480px;width:100%;margin:0;">
      <h3>Editar quarto ${escapar(q.numero)}</h3>
      <div id="edit-erro" class="mensagem oculto"></div>
      <label>Número</label>
      <input type="text" id="e-numero" value="${escapar(q.numero)}" />
      <label>Tipo</label>
      <input type="text" id="e-tipo" value="${escapar(q.tipo)}" />
      <div class="form-linha">
        <div>
          <label>Capacidade</label>
          <input type="number" id="e-capacidade" min="1" value="${q.capacidade}" />
        </div>
        <div>
          <label>Preço (R$)</label>
          <input type="number" id="e-preco" min="0" step="0.01" value="${q.preco}" />
        </div>
      </div>
      <label>Descrição</label>
      <textarea id="e-descricao" rows="2">${escapar(q.descricao || '')}</textarea>
      <div class="form-acoes">
        <button class="sucesso" id="e-salvar">Salvar</button>
        <button class="secundario" id="e-fechar">Fechar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  el('e-fechar').onclick = () => modal.remove();
  el('e-salvar').onclick = async () => {
    const box = el('edit-erro');
    try {
      await api(`/api/gerente/quartos/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
          numero: el('e-numero').value.trim(),
          tipo: el('e-tipo').value.trim(),
          capacidade: el('e-capacidade').value,
          preco: el('e-preco').value,
          descricao: el('e-descricao').value.trim()
        })
      });
      modal.remove();
      mostrarMensagem('Quarto atualizado!', 'ok');
      renderQuartosGerente();
    } catch (e) {
      box.textContent = e.message;
      box.className = 'mensagem erro';
    }
  };
}

// ---------- START ----------
iniciar();
