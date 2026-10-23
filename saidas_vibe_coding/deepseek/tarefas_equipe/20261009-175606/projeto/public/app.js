const app = document.getElementById('app');
let estadoAtual = { usuario: null, tarefas: [], usuarios: [], filtro: 'todas', aberturas: null };

async function api(url, opts) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.erro || 'Erro');
  return data;
}

async function iniciar() {
  try {
    const eu = await api('/api/eu');
    if (eu.logado) {
      estadoAtual.usuario = eu;
      await carregarDados();
      renderApp();
    } else renderLogin();
  } catch (e) { renderLogin(); }
}

async function carregarDados() {
  estadoAtual.tarefas = await api('/api/tarefas');
  if (estadoAtual.usuario.papel === 'gerente') {
    estadoAtual.usuarios = await api('/api/usuarios');
  }
}

function renderLogin() {
  app.innerHTML = `
    <div class="tela-auth">
      <div class="card-auth">
        <h1>Gestão de Tarefas</h1>
        <p class="sub">Entre ou crie sua conta</p>
        <div class="tabs">
          <button id="tab-login" class="ativo">Entrar</button>
          <button id="tab-reg">Criar conta</button>
        </div>
        <div id="form-area"></div>
      </div>
    </div>`;
  document.getElementById('tab-login').onclick = () => trocarForm('login');
  document.getElementById('tab-reg').onclick = () => trocarForm('reg');
  trocarForm('login');
}

function trocarForm(tipo) {
  document.getElementById('tab-login').classList.toggle('ativo', tipo === 'login');
  document.getElementById('tab-reg').classList.toggle('ativo', tipo === 'reg');
  const area = document.getElementById('form-area');
  if (tipo === 'login') {
    area.innerHTML = `
      <input id="email" type="email" placeholder="Email">
      <input id="senha" type="password" placeholder="Senha">
      <div id="msg-erro" class="erro"></div>
      <button class="principal" id="btn-entrar">Entrar</button>
      <p class="info">Se você é o gerente e ainda não configurou:<br>gerente@equipe.com / admin123</p>`;
    document.getElementById('btn-entrar').onclick = async () => {
      try {
        await api('/api/login', { method: 'POST', body: JSON.stringify({
          email: document.getElementById('email').value,
          senha: document.getElementById('senha').value
        })});
        await iniciar();
      } catch (e) { document.getElementById('msg-erro').textContent = e.message; }
    };
  } else {
    area.innerHTML = `
      <input id="nome" placeholder="Nome completo">
      <input id="email" type="email" placeholder="Email">
      <input id="senha" type="password" placeholder="Senha (mín. 4 caracteres)">
      <select id="papel">
        <option value="membro">Sou membro da equipe</option>
        <option value="gerente">Sou gerente</option>
      </select>
      <div id="msg-erro" class="erro"></div>
      <button class="principal" id="btn-criar">Criar conta</button>`;
    document.getElementById('btn-criar').onclick = async () => {
      try {
        await api('/api/registrar', { method: 'POST', body: JSON.stringify({
          nome: document.getElementById('nome').value,
          email: document.getElementById('email').value,
          senha: document.getElementById('senha').value,
          papel: document.getElementById('papel').value
        })});
        await iniciar();
      } catch (e) { document.getElementById('msg-erro').textContent = e.message; }
    };
  }
}

function renderApp() {
  const u = estadoAtual.usuario;
  app.innerHTML = `
    <header class="topo">
      <h1>📋 Tarefas da Equipe</h1>
      <div class="user-info">
        <span>${u.papel === 'gerente' ? '👔 Gerente' : '👤 Membro'}</span>
        <b>${escapeHtml(u.nome)}</b>
        <button class="btn-sair" id="btn-sair">Sair</button>
      </div>
    </header>
    <main>
      <div class="painel">
        <h2>${u.papel === 'gerente' ? 'Todas as tarefas da equipe' : 'Minhas tarefas'}</h2>
        <button class="btn-nova" id="btn-nova">+ Nova tarefa</button>
        <div class="filtros" id="filtros"></div>
        <div id="lista"></div>
      </div>
    </main>
    <div id="modal-area"></div>`;

  document.getElementById('btn-sair').onclick = async () => {
    await api('/api/logout', { method: 'POST' });
    location.reload();
  };
  document.getElementById('btn-nova').onclick = abrirModalNova;
  renderFiltros();
  renderLista();
}

function renderFiltros() {
  const f = document.getElementById('filtros');
  const opcoes = [['todas','Todas'],['pendente','Pendentes'],['em_andamento','Em andamento'],['concluida','Concluídas']];
  f.innerHTML = opcoes.map(([v,l]) => `<button data-f="${v}" class="${estadoAtual.filtro === v ? 'ativo':''}">${l}</button>`).join('');
  f.querySelectorAll('button').forEach(b => b.onclick = () => { estadoAtual.filtro = b.dataset.f; renderFiltros(); renderLista(); });
}

function renderLista() {
  const lista = document.getElementById('lista');
  let t = estadoAtual.tarefas;
  if (estadoAtual.filtro !== 'todas') t = t.filter(x => x.status === estadoAtual.filtro);
  if (t.length === 0) {
    lista.innerHTML = `<div class="vazio">Nenhuma tarefa encontrada.</div>`;
    return;
  }
  const ehGerente = estadoAtual.usuario.papel === 'gerente';
  lista.innerHTML = t.map(tarefa => {
    const statusLabel = { pendente: 'Pendente', em_andamento: 'Em andamento', concluida: 'Concluída' }[tarefa.status];
    return `
    <div class="tarefa ${tarefa.status === 'concluida' ? 'concluida' : ''}">
      <div class="linha-topo">
        <h3>${escapeHtml(tarefa.titulo)}</h3>
        <span class="badge ${tarefa.status}">${statusLabel}</span>
      </div>
      ${tarefa.descricao ? `<div class="desc">${escapeHtml(tarefa.descricao)}</div>` : ''}
      <div class="meta">
        ${ehGerente ? `<span>👤 ${tarefa.membro_nome ? escapeHtml(tarefa.membro_nome) : 'Não atribuída'}</span>` : ''}
        <span>📅 ${new Date(tarefa.criado_em).toLocaleDateString('pt-BR')}</span>
      </div>
      <div class="acoes">
        <select data-status="${tarefa.id}">
          <option value="pendente" ${tarefa.status==='pendente'?'selected':''}>Pendente</option>
          <option value="em_andamento" ${tarefa.status==='em_andamento'?'selected':''}>Em andamento</option>
          <option value="concluida" ${tarefa.status==='concluida'?'selected':''}>Concluída</option>
        </select>
        ${ehGerente ? `<button data-editar="${tarefa.id}">✏️ Editar</button><button class="btn-excluir" data-excluir="${tarefa.id}">🗑️ Excluir</button>` : ''}
      </div>
    </div>`;
  }).join('');

  lista.querySelectorAll('[data-status]').forEach(sel => {
    sel.onchange = async () => {
      try {
        await api('/api/tarefas/' + sel.dataset.status, { method: 'PUT', body: JSON.stringify({ status: sel.value }) });
        await carregarDados(); renderLista();
      } catch (e) { alert(e.message); }
    };
  });
  lista.querySelectorAll('[data-editar]').forEach(b => b.onclick = () => abrirModalEditar(+b.dataset.editar));
  lista.querySelectorAll('[data-excluir]').forEach(b => b.onclick = async () => {
    if (!confirm('Excluir esta tarefa?')) return;
    await api('/api/tarefas/' + b.dataset.excluir, { method: 'DELETE' });
    await carregarDados(); renderLista();
  });
}

function abrirModalNova() {
  const ehGerente = estadoAtual.usuario.papel === 'gerente';
  const modal = document.getElementById('modal-area');
  modal.innerHTML = `
    <div class="modal-fundo">
      <div class="modal">
        <h2>Nova tarefa</h2>
        <label>Título</label>
        <input id="m-titulo" placeholder="Ex: Enviar relatório">
        <label>Descrição</label>
        <textarea id="m-desc" placeholder="Detalhes da tarefa..."></textarea>
        ${ehGerente ? `
          <label>Atribuir a</label>
          <select id="m-membro">
            <option value="">— Sem atribuição —</option>
            ${estadoAtual.usuarios.map(u => `<option value="${u.id}">${escapeHtml(u.nome)}</option>`).join('')}
          </select>` : ''}
        <div class="botoes">
          <button class="cancelar" id="m-cancelar">Cancelar</button>
          <button class="salvar" id="m-salvar">Criar tarefa</button>
        </div>
      </div>
    </div>`;
  document.getElementById('m-cancelar').onclick = () => modal.innerHTML = '';
  document.getElementById('m-salvar').onclick = async () => {
    try {
      const body = {
        titulo: document.getElementById('m-titulo').value,
        descricao: document.getElementById('m-desc').value
      };
      if (ehGerente) {
        const mid = document.getElementById('m-membro').value;
        body.membro_id = mid ? +mid : null;
      }
      await api('/api/tarefas', { method: 'POST', body: JSON.stringify(body) });
      modal.innerHTML = '';
      await carregarDados(); renderLista();
    } catch (e) { alert(e.message); }
  };
}

function abrirModalEditar(id) {
  const t = estadoAtual.tarefas.find(x => x.id === id);
  if (!t) return;
  const modal = document.getElementById('modal-area');
  modal.innerHTML = `
    <div class="modal-fundo">
      <div class="modal">
        <h2>Editar tarefa</h2>
        <label>Título</label>
        <input id="m-titulo" value="${escapeHtml(t.titulo)}">
        <label>Descrição</label>
        <textarea id="m-desc">${escapeHtml(t.descricao || '')}</textarea>
        <label>Status</label>
        <select id="m-status">
          <option value="pendente" ${t.status==='pendente'?'selected':''}>Pendente</option>
          <option value="em_andamento" ${t.status==='em_andamento'?'selected':''}>Em andamento</option>
          <option value="concluida" ${t.status==='concluida'?'selected':''}>Concluída</option>
        </select>
        <label>Atribuir a</label>
        <select id="m-membro">
          <option value="">— Sem atribuição —</option>
          ${estadoAtual.usuarios.map(u => `<option value="${u.id}" ${t.membro_id === u.id ? 'selected':''}>${escapeHtml(u.nome)}</option>`).join('')}
        </select>
        <div class="botoes">
          <button class="cancelar" id="m-cancelar">Cancelar</button>
          <button class="salvar" id="m-salvar">Salvar</button>
        </div>
      </div>
    </div>`;
  document.getElementById('m-cancelar').onclick = () => modal.innerHTML = '';
  document.getElementById('m-salvar').onclick = async () => {
    try {
      const mid = document.getElementById('m-membro').value;
      await api('/api/tarefas/' + id, { method: 'PUT', body: JSON.stringify({
        titulo: document.getElementById('m-titulo').value,
        descricao: document.getElementById('m-desc').value,
        status: document.getElementById('m-status').value,
        membro_id: mid ? +mid : null
      })});
      modal.innerHTML = '';
      await carregarDados(); renderLista();
    } catch (e) { alert(e.message); }
  };
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

iniciar();
