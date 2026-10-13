// ---------- Estado ----------
let usuario = null;
let view = 'eventos';           // view atual
let eventos = [];
let minhasInscricoes = [];
let meusEventos = [];
let eventoEditando = null;
let eventoInscricoes = null;

// ---------- Helpers ----------
async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || 'Erro');
  return data;
}

function toast(msg, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + (tipo === 'erro' ? 'erro' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 3000);
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function dataFmt(d) {
  if (!d) return 'Data a definir';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function badgeStatus(s) {
  if (s === 'confirmada') return '<span class="badge badge-confirmada">Confirmada</span>';
  if (s === 'cancelada') return '<span class="badge badge-cancelada">Cancelada</span>';
  if (s === 'pendente') return '<span class="badge badge-pendente">Pendente</span>';
  return '';
}

// ---------- Roteamento simples ----------
window.addEventListener('hashchange', render);

function renderNav() {
  const nav = document.getElementById('nav');
  if (!usuario) {
    nav.innerHTML = '';
    return;
  }
  let html = `<span class="usuario-info">👤 ${esc(usuario.nome)} <small>(${usuario.tipo})</small></span>`;
  if (usuario.tipo === 'participante') {
    html += `<button onclick="irPara('eventos')">Eventos</button>`;
    html += `<button onclick="irPara('minhas')">Minhas Inscrições</button>`;
  } else {
    html += `<button onclick="irPara('painel')">Painel</button>`;
    html += `<button onclick="irPara('criar')">Novo Evento</button>`;
  }
  html += `<button onclick="logout()">Sair</button>`;
  nav.innerHTML = html;
}

function irPara(v) {
  view = v;
  eventoEditando = null;
  eventoInscricoes = null;
  render();
}

async function carregarEventos() {
  const d = await api('/api/eventos');
  eventos = d.eventos || [];
}

async function carregarMinhas() {
  const d = await api('/api/minhas-inscricoes');
  minhasInscricoes = d.inscricoes || [];
}

async function carregarMeusEventos() {
  // organizador vê eventos próprios; reutilizamos a lista de eventos gerais e filtramos
  // mas o backend só devolve eventos ativos de todos; então fazemos uma query específica:
  const all = await api('/api/eventos');
  eventos = all.eventos || [];
  meusEventos = eventos.filter(e => usuario && e.organizador_id === usuario.id);
}

async function carregarTudo() {
  if (!usuario) return;
  if (usuario.tipo === 'participante') {
    await Promise.all([carregarEventos(), carregarMinhas()]);
  } else {
    await carregarMeusEventos();
  }
}

// ---------- Login / Registro ----------
function telaLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="card login-box">
      <h1>Entrar</h1>
      <p class="sub">Acesse sua conta para ver e gerenciar inscrições.</p>
      <div id="msg"></div>
      <form onsubmit="fazerLogin(event)">
        <div class="form-group">
          <label>E-mail</label>
          <input type="email" name="email" required />
        </div>
        <div class="form-group">
          <label>Senha</label>
          <input type="password" name="senha" required />
        </div>
        <button class="btn btn-primario btn-bloco" type="submit">Entrar</button>
      </form>
      <p class="sub" style="margin-top:16px;text-align:center">
        Não tem conta? <a href="javascript:irPara('registro')" style="color:var(--azul);font-weight:600">Cadastre-se</a>
      </p>
    </div>
  `;
}

function telaRegistro() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="card login-box">
      <h1>Criar conta</h1>
      <p class="sub">Escolha seu tipo de conta.</p>
      <div id="msg"></div>
      <form onsubmit="fazerRegistro(event)">
        <div class="form-group">
          <label>Nome completo</label>
          <input type="text" name="nome" required />
        </div>
        <div class="form-group">
          <label>E-mail</label>
          <input type="email" name="email" required />
        </div>
        <div class="form-group">
          <label>Senha (mínimo 6 caracteres)</label>
          <input type="password" name="senha" minlength="6" required />
        </div>
        <div class="form-group">
          <label>Eu sou</label>
          <select name="tipo" required>
            <option value="participante">Participante — quero me inscrever em eventos</option>
            <option value="organizador">Organizador — quero criar eventos</option>
          </select>
        </div>
        <button class="btn btn-primario btn-bloco" type="submit">Criar conta</button>
      </form>
      <p class="sub" style="margin-top:16px;text-align:center">
        Já tem conta? <a href="javascript:irPara('login')" style="color:var(--azul);font-weight:600">Entrar</a>
      </p>
    </div>
  `;
}

async function fazerLogin(ev) {
  ev.preventDefault();
  const f = ev.target;
  const msg = document.getElementById('msg');
  msg.innerHTML = '';
  try {
    const d = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email: f.email.value, senha: f.senha.value })
    });
    usuario = d.usuario;
    toast('Bem-vindo, ' + usuario.nome + '!');
    irPara(usuario.tipo === 'participante' ? 'eventos' : 'painel');
  } catch (e) {
    msg.innerHTML = `<div class="erro-msg">${esc(e.message)}</div>`;
  }
}

async function fazerRegistro(ev) {
  ev.preventDefault();
  const f = ev.target;
  const msg = document.getElementById('msg');
  msg.innerHTML = '';
  try {
    const d = await api('/api/registrar', {
      method: 'POST',
      body: JSON.stringify({
        nome: f.nome.value,
        email: f.email.value,
        senha: f.senha.value,
        tipo: f.tipo.value
      })
    });
    usuario = d.usuario;
    toast('Conta criada com sucesso!');
    irPara(usuario.tipo === 'participante' ? 'eventos' : 'painel');
  } catch (e) {
    msg.innerHTML = `<div class="erro-msg">${esc(e.message)}</div>`;
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  usuario = null;
  irPara('login');
}

// ---------- Participante: eventos ----------
function telaEventos() {
  const app = document.getElementById('app');
  let html = `<h1>Eventos disponíveis</h1>
    <p class="sub">Escolha um evento e faça sua inscrição. Você pode cancelar quando quiser.</p>`;

  if (!eventos.length) {
    html += `<div class="card"><div class="vazio">Nenhum evento disponível no momento.</div></div>`;
  } else {
    html += '<div class="grid-eventos">';
    for (const e of eventos) {
      const st = e.minha_inscricao;
      let botao = '';
      if (st === 'cancelada') {
        botao = `<button class="btn btn-primario btn-bloco" onclick="inscrever(${e.id})">Inscrever-se novamente</button>`;
      } else if (st) {
        botao = `<span class="badge badge-info">Você está inscrito</span> ${badgeStatus(st)}`;
      } else {
        botao = `<button class="btn btn-primario btn-bloco" onclick="inscrever(${e.id})">Inscrever-se</button>`;
      }
      const vagas = e.vagas > 0 ? `${e.total_inscritos}/${e.vagas} inscritos` : `${e.total_inscritos} inscritos`;
      html += `
        <div class="evento-card">
          <div class="evento-titulo">${esc(e.titulo)}</div>
          <div class="evento-meta">
            <span>📅 ${esc(dataFmt(e.data))}</span>
            <span>📍 ${esc(e.local || 'Local a definir')}</span>
            <span>👥 ${vagas}</span>
            <span>Organizador: ${esc(e.organizador_nome)}</span>
          </div>
          <div class="evento-desc">${esc(e.descricao || '')}</div>
          <div style="margin-top:auto">${botao}</div>
        </div>
      `;
    }
    html += '</div>';
  }
  app.innerHTML = html;
}

async function inscrever(eventoId) {
  try {
    await api('/api/inscricoes', { method: 'POST', body: JSON.stringify({ evento_id: eventoId }) });
    toast('Inscrição realizada! Aguarde confirmação.');
    await carregarTudo();
    render();
  } catch (e) {
    toast(e.message, 'erro');
  }
}

// ---------- Participante: minhas inscrições ----------
function telaMinhas() {
  const app = document.getElementById('app');
  let html = `<h1>Minhas inscrições</h1>
    <p class="sub">Acompanhe o status das suas inscrições e cancele se precisar.</p>`;

  if (!minhasInscricoes.length) {
    html += `<div class="card"><div class="vazio">Você ainda não se inscreveu em nenhum evento.</div></div>`;
    app.innerHTML = html;
    return;
  }

  html += '<div class="card"><div class="lista">';
  for (const i of minhasInscricoes) {
    const podeCancelar = i.status !== 'cancelada';
    const canceladoEvento = i.cancelado ? '<span class="badge badge-cancelada">Evento cancelado</span>' : '';
    html += `
      <div class="item-lista">
        <div class="info">
          <strong>${esc(i.titulo)} ${canceladoEvento}</strong>
          <small>📅 ${esc(dataFmt(i.data))} · 📍 ${esc(i.local || 'Local a definir')} · Organizador: ${esc(i.organizador_nome)}</small>
          <small>Status: ${badgeStatus(i.status)}</small>
        </div>
        <div class="acoes">
          ${podeCancelar ? `<button class="btn btn-vermelho" onclick="cancelarInscricao(${i.id})">Cancelar inscrição</button>` : ''}
        </div>
      </div>
    `;
  }
  html += '</div></div>';
  app.innerHTML = html;
}

async function cancelarInscricao(id) {
  if (!confirm('Deseja realmente cancelar esta inscrição?')) return;
  try {
    await api('/api/inscricoes/' + id, { method: 'DELETE' });
    toast('Inscrição cancelada.');
    await carregarTudo();
    render();
  } catch (e) {
    toast(e.message, 'erro');
  }
}

// ---------- Organizador: painel ----------
function telaPainel() {
  const app = document.getElementById('app');
  let html = `<h1>Painel do organizador</h1>
    <p class="sub">Gerencie seus eventos e confirme inscrições.</p>
    <div class="tabs">
      <button class="tab ativa" onclick="irPara('painel')">Meus eventos</button>
      <button class="tab" onclick="irPara('criar')">+ Novo evento</button>
    </div>`;

  if (!meusEventos.length) {
    html += `<div class="card"><div class="vazio">Você ainda não criou eventos.<br><br>
      <button class="btn btn-primario" onclick="irPara('criar')">Criar primeiro evento</button></div></div>`;
  } else {
    html += '<div class="card"><div class="lista">';
    for (const e of meusEventos) {
      html += `
        <div class="item-lista">
          <div class="info">
            <strong>${esc(e.titulo)}</strong>
            <small>📅 ${esc(dataFmt(e.data))} · 📍 ${esc(e.local || 'Local a definir')}</small>
            <small>👥 ${e.total_inscritos}${e.vagas > 0 ? '/' + e.vagas : ''} inscritos</small>
          </div>
          <div class="acoes">
            <button class="btn btn-cinza" onclick="verInscricoes(${e.id})">Ver inscritos</button>
            <button class="btn btn-primario" onclick="editarEvento(${e.id})">Editar</button>
            <button class="btn btn-vermelho" onclick="cancelarEvento(${e.id})">Cancelar</button>
          </div>
        </div>
      `;
    }
    html += '</div></div>';
  }
  app.innerHTML = html;
}

// ---------- Organizador: criar/editar ----------
function telaCriarEditar() {
  const app = document.getElementById('app');
  const ev = eventoEditando;
  app.innerHTML = `
    <h1>${ev ? 'Editar evento' : 'Criar novo evento'}</h1>
    <p class="sub">${ev ? 'Atualize as informações do evento.' : 'Preencha os dados para publicar um evento.'}</p>
    <div class="card">
      <div id="msg"></div>
      <form onsubmit="salvarEvento(event)">
        <div class="form-group">
          <label>Título do evento *</label>
          <input type="text" name="titulo" required value="${ev ? esc(ev.titulo) : ''}" />
        </div>
        <div class="form-group">
          <label>Descrição</label>
          <textarea name="descricao">${ev ? esc(ev.descricao || '') : ''}</textarea>
        </div>
        <div class="form-group">
          <label>Local</label>
          <input type="text" name="local" value="${ev ? esc(ev.local || '') : ''}" />
        </div>
        <div class="form-group">
          <label>Data</label>
          <input type="date" name="data" value="${ev ? esc(ev.data || '') : ''}" />
        </div>
        <div class="form-group">
          <label>Número de vagas (0 = ilimitado)</label>
          <input type="number" name="vagas" min="0" value="${ev ? esc(ev.vagas || 0) : 0}" />
        </div>
        <div class="acoes">
          <button type="submit" class="btn btn-primario">${ev ? 'Salvar alterações' : 'Publicar evento'}</button>
          <button type="button" class="btn btn-cinza" onclick="irPara('painel')">Voltar</button>
        </div>
      </form>
    </div>
  `;
}

async function salvarEvento(ev) {
  ev.preventDefault();
  const f = ev.target;
  const dados = {
    titulo: f.titulo.value,
    descricao: f.descricao.value,
    local: f.local.value,
    data: f.data.value,
    vagas: Number(f.vagas.value) || 0
  };
  try {
    if (eventoEditando) {
      await api('/api/eventos/' + eventoEditando.id, { method: 'PUT', body: JSON.stringify(dados) });
      toast('Evento atualizado!');
    } else {
      await api('/api/eventos', { method: 'POST', body: JSON.stringify(dados) });
      toast('Evento publicado!');
    }
    eventoEditando = null;
    irPara('painel');
  } catch (e) {
    document.getElementById('msg').innerHTML = `<div class="erro-msg">${esc(e.message)}</div>`;
  }
}

function editarEvento(id) {
  const e = meusEventos.find(x => x.id === id);
  if (!e) return;
  eventoEditando = e;
  view = 'criar';
  render();
}

async function cancelarEvento(id) {
  if (!confirm('Cancelar este evento? Os participantes não poderão mais se inscrever.')) return;
  try {
    await api('/api/eventos/' + id, { method: 'DELETE' });
    toast('Evento cancelado.');
    await carregarTudo();
    irPara('painel');
  } catch (e) {
    toast(e.message, 'erro');
  }
}

async function verInscricoes(eventoId) {
  try {
    const d = await api('/api/eventos/' + eventoId + '/inscricoes');
    eventoInscricoes = { eventoId, lista: d.inscricoes };
    view = 'inscricoes';
    render();
  } catch (e) {
    toast(e.message, 'erro');
  }
}

function telaInscricoes() {
  const app = document.getElementById('app');
  const ev = meusEventos.find(x => x.id === eventoInscricoes.eventoId);
  let html = `<h1>Inscritos: ${ev ? esc(ev.titulo) : ''}</h1>
    <p class="sub">Confirme a presença dos participantes.</p>
    <button class="btn btn-cinza" onclick="irPara('painel')" style="margin-bottom:16px">← Voltar</button>`;

  if (!eventoInscricoes.lista.length) {
    html += `<div class="card"><div class="vazio">Ninguém se inscreveu ainda.</div></div>`;
  } else {
    html += '<div class="card"><div class="lista">';
    for (const i of eventoInscricoes.lista) {
      html += `
        <div class="item-lista">
          <div class="info">
            <strong>${esc(i.nome)}</strong>
            <small>${esc(i.email)}</small>
            <small>Status: ${badgeStatus(i.status)}</small>
          </div>
          <div class="acoes">
            ${i.status !== 'confirmada' ? `<button class="btn btn-verde" onclick="confirmarInscricao(${i.id})">Confirmar presença</button>` : '<span class="badge badge-confirmada">Confirmado</span>'}
          </div>
        </div>
      `;
    }
    html += '</div></div>';
  }
  app.innerHTML = html;
}

async function confirmarInscricao(id) {
  try {
    await api('/api/inscricoes/' + id + '/confirmar', { method: 'POST' });
    toast('Presença confirmada!');
    await verInscricoes(eventoInscricoes.eventoId);
  } catch (e) {
    toast(e.message, 'erro');
  }
}

// ---------- Render ----------
async function render() {
  renderNav();
  if (!usuario) {
    if (view === 'registro') telaRegistro();
    else telaLogin();
    return;
  }

  // garante dados atualizados
  try { await carregarTudo(); } catch (e) { /* ignora */ }

  if (usuario.tipo === 'participante') {
    if (view === 'minhas') telaMinhas();
    else telaEventos();
  } else {
    if (view === 'criar') telaCriarEditar();
    else if (view === 'inscricoes' && eventoInscricoes) telaInscricoes();
    else telaPainel();
  }
}

// ---------- Inicialização ----------
(async function init() {
  try {
    const d = await api('/api/eu');
    usuario = d.usuario;
  } catch (e) { usuario = null; }
  render();
})();
