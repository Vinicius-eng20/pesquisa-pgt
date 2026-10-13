let usuarioAtual = null;

// ---------- Utilidades ----------
async function api(url, opcoes = {}) {
  const cfg = { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opcoes };
  if (cfg.body && typeof cfg.body !== 'string') cfg.body = JSON.stringify(cfg.body);
  const r = await fetch(url, cfg);
  let dados = null;
  try { dados = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error((dados && dados.erro) || 'Erro na requisição');
  return dados;
}

function fmtData(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR');
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

// ---------- Login / Cadastro ----------
document.getElementById('aba-entrar').onclick = () => {
  document.getElementById('aba-entrar').classList.add('ativa');
  document.getElementById('aba-cadastrar').classList.remove('ativa');
  document.getElementById('form-login').style.display = '';
  document.getElementById('form-cadastro').style.display = 'none';
};
document.getElementById('aba-cadastrar').onclick = () => {
  document.getElementById('aba-cadastrar').classList.add('ativa');
  document.getElementById('aba-entrar').classList.remove('ativa');
  document.getElementById('form-login').style.display = 'none';
  document.getElementById('form-cadastro').style.display = '';
};

document.getElementById('form-login').onsubmit = async (e) => {
  e.preventDefault();
  const err = document.getElementById('login-erro');
  err.textContent = '';
  try {
    const u = await api('/api/login', { method: 'POST', body: {
      usuario: document.getElementById('login-usuario').value,
      senha: document.getElementById('login-senha').value
    }});
    entrarApp(u);
  } catch (ex) { err.textContent = ex.message; }
};

document.getElementById('form-cadastro').onsubmit = async (e) => {
  e.preventDefault();
  const err = document.getElementById('cad-erro');
  const ok = document.getElementById('cad-ok');
  err.textContent = ''; ok.textContent = '';
  try {
    await api('/api/registrar', { method: 'POST', body: {
      nome: document.getElementById('cad-nome').value,
      usuario: document.getElementById('cad-usuario').value,
      senha: document.getElementById('cad-senha').value
    }});
    ok.textContent = 'Conta criada! Faça login.';
    document.getElementById('form-cadastro').reset();
    document.getElementById('aba-entrar').click();
  } catch (ex) { err.textContent = ex.message; }
};

document.getElementById('btn-sair').onclick = async () => {
  await api('/api/logout', { method: 'POST' });
  usuarioAtual = null;
  document.getElementById('tela-app').style.display = 'none';
  document.getElementById('tela-login').style.display = '';
};

async function entrarApp(u) {
  usuarioAtual = u;
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('tela-app').style.display = '';
  document.getElementById('nome-usuario').textContent = u.nome;
  const papel = document.getElementById('papel-usuario');
  papel.textContent = u.papel === 'bibliotecario' ? 'Bibliotecário' : 'Leitor';
  document.querySelectorAll('.so-bibliotecario').forEach(el => {
    el.style.display = u.papel === 'bibliotecario' ? '' : 'none';
  });
  trocarView('acervo');
  carregarAcervo();
}

// ---------- Navegação ----------
document.querySelectorAll('.menu-btn').forEach(btn => {
  btn.onclick = () => trocarView(btn.dataset.view);
});

function trocarView(nome) {
  document.querySelectorAll('.menu-btn').forEach(b => {
    b.classList.toggle('ativa', b.dataset.view === nome);
  });
  document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
  document.getElementById('view-' + nome).style.display = '';
  if (nome === 'acervo') carregarAcervo();
  if (nome === 'meus') carregarMeus();
  if (nome === 'gerenciar') carregarAdmin();
  if (nome === 'leitores') carregarLeitores();
  if (nome === 'historico') carregarHistorico();
}

// ---------- Acervo ----------
let timerBusca = null;
document.getElementById('busca').oninput = () => {
  clearTimeout(timerBusca);
  timerBusca = setTimeout(carregarAcervo, 250);
};

async function carregarAcervo() {
  const busca = document.getElementById('busca').value;
  const itens = await api('/api/itens?busca=' + encodeURIComponent(busca));
  const div = document.getElementById('lista-acervo');
  if (!itens.length) { div.innerHTML = '<p>Nenhum item encontrado.</p>'; return; }
  div.innerHTML = itens.map(i => `
    <div class="card">
      <h4>${esc(i.titulo)}</h4>
      <div class="info">${esc(i.autor)} — ${esc(i.categoria)}${i.ano ? ' (' + i.ano + ')' : ''}</div>
      <div class="status ${i.disponivel ? 'ok' : 'indisponivel'}">${i.disponivel ? 'Disponível' : 'Indisponível'}</div>
      ${usuarioAtual.papel === 'leitor' && i.disponivel ?
        `<div class="acoes"><button class="btn-emprestar" onclick="emprestar(${i.id})">Pegar emprestado</button></div>` : ''}
    </div>
  `).join('');
}

async function emprestar(id) {
  try {
    await api('/api/emprestimos', { method: 'POST', body: { itemId: id } });
    alert('Empréstimo realizado! Prazo: 14 dias.');
    carregarAcervo();
  } catch (e) { alert(e.message); }
}

// ---------- Meus empréstimos ----------
async function carregarMeus() {
  const lista = await api('/api/meus-emprestimos');
  const div = document.getElementById('lista-meus');
  if (!lista.length) { div.innerHTML = '<p>Você ainda não pegou nenhum item.</p>'; return; }
  const hoje = new Date();
  div.innerHTML = `
    <table class="tabela">
      <thead><tr><th>Item</th><th>Emprestado</th><th>Prazo</th><th>Status</th><th></th></tr></thead>
      <tbody>${lista.map(e => {
        const atrasado = !e.devolvido && new Date(e.prazo) < hoje;
        const status = e.devolvido ? 'Devolvido' : (atrasado ? 'Atrasado' : 'Em andamento');
        const classe = e.devolvido ? 'ok' : (atrasado ? 'atrasado' : 'ok');
        return `<tr>
          <td>${esc(e.itemTitulo)}</td>
          <td>${fmtData(e.dataEmprestimo)}</td>
          <td>${fmtData(e.prazo)}</td>
          <td><span class="status ${classe}">${status}</span></td>
          <td>${!e.devolvido ? `<button class="btn-devolver" onclick="devolver(${e.id})">Devolver</button>` : ''}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

async function devolver(id) {
  try {
    await api('/api/emprestimos/' + id + '/devolver', { method: 'POST' });
    alert('Devolução registrada!');
    carregarMeus();
  } catch (e) { alert(e.message); }
}

// ---------- Admin: acervo ----------
let editandoId = null;

document.getElementById('btn-salvar-item').onclick = async () => {
  const err = document.getElementById('item-erro');
  err.textContent = '';
  const body = {
    titulo: document.getElementById('item-titulo').value,
    autor: document.getElementById('item-autor').value,
    categoria: document.getElementById('item-categoria').value,
    ano: document.getElementById('item-ano').value
  };
  try {
    if (editandoId) {
      await api('/api/itens/' + editandoId, { method: 'PUT', body });
    } else {
      await api('/api/itens', { method: 'POST', body });
    }
    cancelarEdicao();
    carregarAdmin();
  } catch (e) { err.textContent = e.message; }
};

document.getElementById('btn-cancelar-edicao').onclick = cancelarEdicao;

function cancelarEdicao() {
  editandoId = null;
  document.getElementById('titulo-form-item').textContent = 'Cadastrar novo item';
  document.getElementById('item-titulo').value = '';
  document.getElementById('item-autor').value = '';
  document.getElementById('item-categoria').value = '';
  document.getElementById('item-ano').value = '';
  document.getElementById('btn-cancelar-edicao').style.display = 'none';
  document.getElementById('btn-salvar-item').textContent = 'Salvar';
}

function editarItem(id) {
  api('/api/itens').then(itens => {
    const i = itens.find(x => x.id === id);
    if (!i) return;
    editandoId = id;
    document.getElementById('titulo-form-item').textContent = 'Editar item';
    document.getElementById('item-titulo').value = i.titulo;
    document.getElementById('item-autor').value = i.autor;
    document.getElementById('item-categoria').value = i.categoria;
    document.getElementById('item-ano').value = i.ano || '';
    document.getElementById('btn-cancelar-edicao').style.display = '';
    document.getElementById('btn-salvar-item').textContent = 'Atualizar';
  });
}

async function excluirItem(id) {
  if (!confirm('Remover este item do acervo?')) return;
  try {
    await api('/api/itens/' + id, { method: 'DELETE' });
    carregarAdmin();
  } catch (e) { alert(e.message); }
}

async function carregarAdmin() {
  const itens = await api('/api/itens');
  const div = document.getElementById('lista-admin');
  if (!itens.length) { div.innerHTML = '<p>Nenhum item cadastrado.</p>'; return; }
  div.innerHTML = itens.map(i => `
    <div class="card">
      <h4>${esc(i.titulo)}</h4>
      <div class="info">${esc(i.autor)} — ${esc(i.categoria)}${i.ano ? ' (' + i.ano + ')' : ''}</div>
      <div class="status ${i.disponivel ? 'ok' : 'indisponivel'}">${i.disponivel ? 'Disponível' : 'Emprestado'}</div>
      <div class="acoes">
        <button class="btn-editar" onclick="editarItem(${i.id})">Editar</button>
        <button class="btn-excluir" onclick="excluirItem(${i.id})">Excluir</button>
      </div>
    </div>
  `).join('');
}

// ---------- Admin: leitores ----------
async function carregarLeitores() {
  const leitores = await api('/api/leitores');
  const div = document.getElementById('lista-leitores');
  if (!leitores.length) { div.innerHTML = '<p>Nenhum leitor cadastrado.</p>'; return; }
  div.innerHTML = `
    <table class="tabela">
      <thead><tr><th>Nome</th><th>Usuário</th><th>Empréstimos ativos</th><th>Situação</th></tr></thead>
      <tbody>${leitores.map(l => `<tr>
        <td>${esc(l.nome)}</td>
        <td>${esc(l.usuario)}</td>
        <td>${l.ativos}</td>
        <td>${l.atrasados > 0 ? `<span class="status atrasado">Bloqueado (${l.atrasados} em atraso)</span>` : `<span class="status ok">Regular</span>`}</td>
      </tr>`).join('')}</tbody>
    </table>`;
}

// ---------- Admin: histórico ----------
async function carregarHistorico() {
  const lista = await api('/api/emprestimos');
  const div = document.getElementById('lista-historico');
  if (!lista.length) { div.innerHTML = '<p>Nenhum empréstimo registrado.</p>'; return; }
  const hoje = new Date();
  div.innerHTML = `
    <table class="tabela">
      <thead><tr><th>Leitor</th><th>Item</th><th>Emprestado</th><th>Prazo</th><th>Devolvido</th><th>Status</th></tr></thead>
      <tbody>${lista.map(e => {
        const atrasado = !e.devolvido && new Date(e.prazo) < hoje;
        const status = e.devolvido ? 'Devolvido' : (atrasado ? 'Atrasado' : 'Em andamento');
        const classe = e.devolvido ? 'ok' : (atrasado ? 'atrasado' : 'ok');
        return `<tr>
          <td>${esc(e.usuarioNome)}</td>
          <td>${esc(e.itemTitulo)}</td>
          <td>${fmtData(e.dataEmprestimo)}</td>
          <td>${fmtData(e.prazo)}</td>
          <td>${e.devolvido ? fmtData(e.dataDevolucao) : '—'}</td>
          <td><span class="status ${classe}">${status}</span></td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;
}

// ---------- Inicialização ----------
(async () => {
  try {
    const u = await api('/api/eu');
    entrarApp(u);
  } catch (e) {
    document.getElementById('tela-login').style.display = '';
  }
})();

---
