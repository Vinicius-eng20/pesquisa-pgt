const app = document.getElementById('app');
let usuario = null;
let abaAtual = 'disponiveis';
let quartos = [];
let quartosDisponiveis = [];
let minhasReservas = [];
let todasReservas = [];
let msg = null;

async function api(url, metodo = 'GET', corpo = null) {
  const opcoes = { method: metodo, headers: { 'Content-Type': 'application/json' } };
  if (corpo) opcoes.body = JSON.stringify(corpo);
  const r = await fetch(url, opcoes);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'Erro');
  return d;
}

function aviso(texto, tipo = 'ok') { msg = { texto, tipo }; render(); }

function render() {
  if (!usuario) return renderLogin();
  if (usuario.tipo === 'gerente') return renderGerente();
  return renderHospede();
}

function renderCabecalho() {
  return `<header>
    <h1>🏨 Reservas de Hotel</h1>
    <div class="info">
      <span>${usuario.nome} (${usuario.tipo === 'gerente' ? 'Gerente' : 'Hóspede'})</span>
      <button class="secundario" onclick="logout()">Sair</button>
    </div>
  </header>`;
}

function renderMsg() {
  if (!msg) return '';
  const m = msg; msg = null;
  return `<div class="msg ${m.tipo}">${m.texto}</div>`;
}

function renderLogin() {
  app.innerHTML = `
  <header><h1>🏨 Reservas de Hotel</h1></header>
  <div class="container">
    <div class="card">
      <h2>Entrar</h2>
      ${renderMsg()}
      <label>Usuário</label>
      <input id="usuario_login" autocomplete="username">
      <label>Senha</label>
      <input id="senha_login" type="password" autocomplete="current-password">
      <button onclick="fazerLogin()">Entrar</button>
    </div>
    <div class="card">
      <h2>Criar conta de hóspede</h2>
      <label>Nome completo</label>
      <input id="nome_cad">
      <label>Usuário (mín. 3 caracteres)</label>
      <input id="usuario_cad" autocomplete="username">
      <label>Senha (mín. 6 caracteres)</label>
      <input id="senha_cad" type="password" autocomplete="new-password">
      <button onclick="fazerCadastro()">Cadastrar</button>
    </div>
  </div>`;
}

async function fazerLogin() {
  try {
    const usuario_ = document.getElementById('usuario_login').value.trim();
    const senha = document.getElementById('senha_login').value;
    const r = await api('/api/login', 'POST', { usuario: usuario_, senha });
    usuario = r.usuario;
    msg = { texto: 'Bem-vindo!', tipo: 'ok' };
    await carregarTudo();
    render();
  } catch (e) { aviso(e.message, 'erro'); }
}

async function fazerCadastro() {
  try {
    const nome = document.getElementById('nome_cad').value.trim();
    const usuario_ = document.getElementById('usuario_cad').value.trim();
    const senha = document.getElementById('senha_cad').value;
    const r = await api('/api/registrar', 'POST', { nome, usuario: usuario_, senha });
    usuario = r.usuario;
    msg = { texto: 'Conta criada!', tipo: 'ok' };
    await carregarTudo();
    render();
  } catch (e) { aviso(e.message, 'erro'); }
}

async function logout() {
  await api('/api/logout', 'POST');
  usuario = null;
  abaAtual = 'disponiveis';
  render();
}

async function carregarTudo() {
  quartos = await api('/api/quartos');
  if (usuario.tipo === 'gerente') {
    todasReservas = await api('/api/reservas');
  } else {
    minhasReservas = await api('/api/reservas/minhas');
  }
}

function trocarAba(a) { abaAtual = a; render(); }

function renderHospede() {
  const abas = `
    <div class="abas">
      <button class="${abaAtual === 'disponiveis' ? 'ativa' : ''}" onclick="trocarAba('disponiveis')">Buscar quartos</button>
      <button class="${abaAtual === 'minhas' ? 'ativa' : ''}" onclick="trocarAba('minhas')">Minhas reservas</button>
    </div>`;
  app.innerHTML = renderCabecalho() + `<div class="container">
    ${renderMsg()}
    ${abas}
    ${abaAtual === 'disponiveis' ? htmlBusca() : htmlMinhasReservas()}
  </div>`;
}

function htmlBusca() {
  let lista = '';
  if (quartosDisponiveis.length === 0) {
    lista = '<p class="vazio">Informe as datas e clique em "Buscar" para ver os quartos disponíveis.</p>';
  } else {
    lista = '<div class="grid">' + quartosDisponiveis.map(q => `
      <div class="quarto">
        <h3>Quarto ${q.numero}</h3>
        <div class="tipo">${q.tipo} • até ${q.capacidade} pessoa(s)</div>
        <div class="preco">R$ ${q.preco.toFixed(2)} / noite</div>
        <div class="tipo">${q.descricao || ''}</div>
        <button onclick="abrirReserva(${q.id})">Reservar</button>
      </div>`).join('') + '</div>';
  }
  return `<div class="card">
    <h2>Buscar quartos disponíveis</h2>
    <div class="flex-datas">
      <div><label>Entrada</label><input type="date" id="busca_entrada"></div>
      <div><label>Saída</label><input type="date" id="busca_saida"></div>
      <div><button onclick="buscar()">Buscar</button></div>
    </div>
  </div>
  <div class="card">
    <h2>Resultados</h2>
    ${lista}
  </div>`;
}

async function buscar() {
  try {
    const entrada = document.getElementById('busca_entrada').value;
    const saida = document.getElementById('busca_saida').value;
    if (!entrada || !saida) return aviso('Informe as datas', 'erro');
    quartosDisponiveis = await api(`/api/quartos/disponiveis?entrada=${entrada}&saida=${saida}`);
    render();
  } catch (e) { aviso(e.message, 'erro'); }
}

function abrirReserva(quartoId) {
  const q = quartosDisponiveis.find(x => x.id === quartoId);
  const entrada = document.getElementById('busca_entrada').value;
  const saida = document.getElementById('busca_saida').value;
  const diarias = Math.max(1, Math.round((new Date(saida) - new Date(entrada)) / 86400000));
  const total = diarias * q.preco;
  if (!confirm(`Confirmar reserva do Quarto ${q.numero}?\nEntrada: ${entrada}\nSaída: ${saida}\n${diarias} noite(s)\nTotal: R$ ${total.toFixed(2)}`)) return;
  api('/api/reservas', 'POST', { quarto_id: q.id, data_entrada: entrada, data_saida: saida })
    .then(async () => {
      msg = { texto: 'Reserva solicitada! Aguarde a confirmação do gerente.', tipo: 'ok' };
      await carregarTudo();
      abaAtual = 'minhas';
      render();
    })
    .catch(e => aviso(e.message, 'erro'));
}

function htmlMinhasReservas() {
  if (minhasReservas.length === 0) return `<div class="card"><h2>Minhas reservas</h2><p class="vazio">Você ainda não tem reservas.</p></div>`;
  return `<div class="card"><h2>Minhas reservas</h2>` + minhasReservas.map(r => `
    <div class="reserva">
      <div class="linha"><strong>Quarto ${r.quarto_numero} (${r.quarto_tipo})</strong>
        <span class="status ${r.status}">${r.status}</span></div>
      <div class="linha"><span>Entrada: ${r.data_entrada}</span><span>Saída: ${r.data_saida}</span></div>
      ${(r.status === 'pendente' || r.status === 'confirmada') ?
        `<div class="acoes"><button class="perigo" onclick="cancelarReserva(${r.id})">Cancelar reserva</button></div>` : ''}
    </div>`).join('') + `</div>`;
}

async function cancelarReserva(id) {
  if (!confirm('Tem certeza que deseja cancelar esta reserva?')) return;
  try {
    await api(`/api/reservas/${id}/cancelar`, 'POST');
    msg = { texto: 'Reserva cancelada.', tipo: 'ok' };
    await carregarTudo();
    render();
  } catch (e) { aviso(e.message, 'erro'); }
}

function renderGerente() {
  const abas = `
    <div class="abas">
      <button class="${abaAtual === 'reservas' ? 'ativa' : ''}" onclick="trocarAba('reservas')">Reservas</button>
      <button class="${abaAtual === 'quartos' ? 'ativa' : ''}" onclick="trocarAba('quartos')">Quartos</button>
    </div>`;
  app.innerHTML = renderCabecalho() + `<div class="container">
    ${renderMsg()}
    ${abas}
    ${abaAtual === 'quartos' ? htmlGerenciarQuartos() : htmlTodasReservas()}
  </div>`;
}

function htmlTodasReservas() {
  if (todasReservas.length === 0) return `<div class="card"><h2>Reservas de todos os hóspedes</h2><p class="vazio">Nenhuma reserva ainda.</p></div>`;
  return `<div class="card"><h2>Reservas de todos os hóspedes</h2>` + todasReservas.map(r => `
    <div class="reserva">
      <div class="linha"><strong>Quarto ${r.quarto_numero} (${r.quarto_tipo})</strong>
        <span class="status ${r.status}">${r.status}</span></div>
      <div class="linha"><span>Hóspede: ${r.hospede_nome} (${r.hospede_usuario})</span></div>
      <div class="linha"><span>Entrada: ${r.data_entrada}</span><span>Saída: ${r.data_saida}</span></div>
      <div class="acoes">
        ${r.status === 'pendente' ? `
          <button class="sucesso" onclick="mudarStatus(${r.id}, 'confirmada')">Confirmar</button>
          <button class="perigo" onclick="mudarStatus(${r.id}, 'recusada')">Recusar</button>` : ''}
        ${r.status === 'confirmada' ? `<button class="perigo" onclick="mudarStatus(${r.id}, 'cancelada')">Cancelar</button>` : ''}
      </div>
    </div>`).join('') + `</div>`;
}

async function mudarStatus(id, status) {
  try {
    await api(`/api/reservas/${id}/status`, 'POST', { status });
    msg = { texto: `Reserva ${status}.`, tipo: 'ok' };
    await carregarTudo();
    render();
  } catch (e) { aviso(e.message, 'erro'); }
}

function htmlGerenciarQuartos() {
  return `<div class="card">
    <h2>Novo quarto</h2>
    <div class="grid">
      <div><label>Número</label><input id="q_numero"></div>
      <div><label>Tipo</label><input id="q_tipo" placeholder="Solteiro, Casal, Família..."></div>
      <div><label>Capacidade</label><input id="q_capacidade" type="number" min="1"></div>
      <div><label>Preço (R$ / noite)</label><input id="q_preco" type="number" step="0.01" min="0"></div>
    </div>
    <label>Descrição</label>
    <input id="q_descricao">
    <button onclick="criarQuarto()">Cadastrar quarto</button>
  </div>
  <div class="card">
    <h2>Quartos cadastrados</h2>
    <div class="grid">` + quartos.map(q => `
      <div class="quarto">
        <h3>Quarto ${q.numero} ${q.ativo ? '' : '(inativo)'}</h3>
        <div class="tipo">${q.tipo} • até ${q.capacidade} pessoa(s)</div>
        <div class="preco">R$ ${q.preco.toFixed(2)} / noite</div>
        <div class="tipo">${q.descricao || ''}</div>
        <div class="acoes">
          <button class="secundario" onclick="editarQuarto(${q.id})">Editar</button>
          <button class="perigo" onclick="removerQuarto(${q.id})">Remover</button>
        </div>
      </div>`).join('') + `</div>
  </div>`;
}

async function criarQuarto() {
  try {
    const numero = document.getElementById('q_numero').value.trim();
    const tipo = document.getElementById('q_tipo').value.trim();
    const capacidade = parseInt(document.getElementById('q_capacidade').value);
    const preco = parseFloat(document.getElementById('q_preco').value);
    const descricao = document.getElementById('q_descricao').value.trim();
    if (!numero || !tipo || !capacidade || isNaN(preco)) return aviso('Preencha os campos', 'erro');
    await api('/api/quartos', 'POST', { numero, tipo, capacidade, preco, descricao });
    msg = { texto: 'Quarto cadastrado.', tipo: 'ok' };
    await carregarTudo();
    render();
  } catch (e) { aviso(e.message, 'erro'); }
}

async function editarQuarto(id) {
  const q = quartos.find(x => x.id === id);
  const numero = prompt('Número do quarto:', q.numero);
  if (numero === null) return;
  const tipo = prompt('Tipo:', q.tipo);
  if (tipo === null) return;
  const capacidade = prompt('Capacidade:', q.capacidade);
  if (capacidade === null) return;
  const preco = prompt('Preço por noite:', q.preco);
  if (preco === null) return;
  const descricao = prompt('Descrição:', q.descricao || '');
  if (descricao === null) return;
  const ativo = confirm('Quarto está ativo? OK = sim, Cancelar = não');
  try {
    await api(`/api/quartos/${id}`, 'PUT', {
      numero, tipo, capacidade: parseInt(capacidade), preco: parseFloat(preco), descricao, ativo
    });
    msg = { texto: 'Quarto atualizado.', tipo: 'ok' };
    await carregarTudo();
    render();
  } catch (e) { aviso(e.message, 'erro'); }
}

async function removerQuarto(id) {
  if (!confirm('Remover este quarto?')) return;
  try {
    await api(`/api/quartos/${id}`, 'DELETE');
    msg = { texto: 'Quarto removido.', tipo: 'ok' };
    await carregarTudo();
    render();
  } catch (e) { aviso(e.message, 'erro'); }
}

(async function iniciar() {
  try {
    const r = await api('/api/sessao');
    usuario = r.usuario;
    if (usuario) await carregarTudo();
  } catch (e) {}
  render();
})();
</｜DSML｜ parameter>
</｜DSML｜ invoke>
</｜DSML｜ calls>
