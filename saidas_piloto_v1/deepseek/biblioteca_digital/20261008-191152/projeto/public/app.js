const app = document.getElementById('app');
let usuario = null;

async function api(url, opts = {}) {
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.erro || 'Erro na operação.');
  return data;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

function msg(texto, tipo = 'erro') {
  const el = document.createElement('div');
  el.className = 'msg ' + tipo;
  el.textContent = texto;
  return el;
}

// ============ LOGIN / CADASTRO ============
let modoCadastro = false;

function renderLogin() {
  app.innerHTML = `
    <div class="login-box">
      <h1>📚 Biblioteca Digital</h1>
      <div id="msg-area"></div>
      <h2 style="font-size:16px;margin-bottom:16px;color:#2c5282">
        ${modoCadastro ? 'Criar conta' : 'Entrar'}
      </h2>
      ${modoCadastro ? `
        <label>Nome completo</label>
        <input id="nome" type="text" placeholder="Seu nome">
      ` : ''}
      <label>Email</label>
      <input id="email" type="email" placeholder="seu@email.com">
      <label>Senha</label>
      <input id="senha" type="password" placeholder="••••••">
      ${modoCadastro ? `
        <label>Tipo de conta</label>
        <select id="papel">
          <option value="leitor">Leitor</option>
          <option value="bibliotecario">Bibliotecário</option>
        </select>
      ` : ''}
      <button style="width:100%" id="btn-entrar">
        ${modoCadastro ? 'Cadastrar' : 'Entrar'}
      </button>
      <div class="toggle-auth">
        ${modoCadastro ? 'Já tem conta?' : 'Não tem conta?'}
        <a id="toggle">${modoCadastro ? 'Entrar' : 'Cadastre-se'}</a>
      </div>
      <div class="hint">Bibliotecário padrão: admin@biblioteca.com / admin123</div>
    </div>
  `;
  document.getElementById('toggle').onclick = () => { modoCadastro = !modoCadastro; renderLogin(); };
  document.getElementById('btn-entrar').onclick = async () => {
    const area = document.getElementById('msg-area');
    area.innerHTML = '';
    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    try {
      let data;
      if (modoCadastro) {
        const nome = document.getElementById('nome').value;
        const papel = document.getElementById('papel').value;
        data = await api('/api/cadastro', { method: 'POST', body: { nome, email, senha, papel } });
      } else {
        data = await api('/api/login', { method: 'POST', body: { email, senha } });
      }
      usuario = data.usuario;
      renderApp();
    } catch (e) {
      area.appendChild(msg(e.message));
    }
  };
}

// ============ APP PRINCIPAL ============
let abaAtiva = 'acervo';

function renderApp() {
  const isBib = usuario.papel === 'bibliotecario';
  const abas = isBib
    ? [['acervo','Acervo'], ['gerenciar','Gerenciar Itens'], ['historico','Histórico'], ['usuarios','Leitores']]
    : [['acervo','Acervo'], ['meus','Meus Empréstimos']];

  if (!abas.find(a => a[0] === abaAtiva)) abaAtiva = 'acervo';

  app.innerHTML = `
    <header>
      <h1>📚 Biblioteca Digital</h1>
      <div class="user-info">
        <span>${esc(usuario.nome)} (${isBib ? 'Bibliotecário' : 'Leitor'})</span>
        <button class="small secondary" id="logout">Sair</button>
      </div>
    </header>
    <div class="container">
      <div class="tabs">
        ${abas.map(([id,label]) => `<div class="tab ${abaAtiva===id?'active':''}" data-aba="${id}">${label}</div>`).join('')}
      </div>
      <div id="conteudo"></div>
    </div>
  `;
  document.getElementById('logout').onclick = async () => {
    await api('/api/logout', { method: 'POST' });
    usuario = null;
    abaAtiva = 'acervo';
    renderLogin();
  };
  document.querySelectorAll('.tab').forEach(t => {
    t.onclick = () => { abaAtiva = t.dataset.aba; renderApp(); };
  });
  carregarAba();
}

function carregarAba() {
  if (abaAtiva === 'acervo') renderAcervo();
  else if (abaAtiva === 'meus') renderMeusEmprestimos();
  else if (abaAtiva === 'gerenciar') renderGerenciar();
  else if (abaAtiva === 'historico') renderHistorico();
  else if (abaAtiva === 'usuarios') renderUsuarios();
}

// ============ ACERVO ============
async function renderAcervo() {
  const c = document.getElementById('conteudo');
  c.innerHTML = `
    <div class="card">
      <h2>Buscar no acervo</h2>
      <div class="row">
        <input id="busca" type="text" placeholder="Título, autor ou categoria...">
        <button id="btn-buscar">Buscar</button>
        <button class="secondary" id="btn-limpar">Limpar</button>
      </div>
    </div>
    <div class="card">
      <h2>Itens disponíveis</h2>
      <div id="lista-itens" class="grid"><div class="empty">Carregando...</div></div>
    </div>
  `;
  const carregar = async (busca = '') => {
    const lista = document.getElementById('lista-itens');
    try {
      const itens = await api('/api/itens' + (busca ? '?busca=' + encodeURIComponent(busca) : ''));
      if (!itens.length) { lista.innerHTML = '<div class="empty">Nenhum item encontrado.</div>'; return; }
      lista.innerHTML = itens.map(it => `
        <div class="item">
          <span class="badge ${it.disponivel ? 'ok' : 'no'}">${it.disponivel ? 'Disponível' : 'Emprestado'}</span>
          <h3>${esc(it.titulo)}</h3>
          <div class="meta">${esc(it.autor)} • ${esc(it.categoria)}${it.ano ? ' • ' + it.ano : ''}</div>
          ${it.disponivel ? `<button class="small" data-emp="${it.id}">Pegar emprestado</button>` : ''}
        </div>
      `).join('');
      lista.querySelectorAll('[data-emp]').forEach(b => {
        b.onclick = async () => {
          try {
            await api('/api/emprestimos', { method: 'POST', body: { item_id: Number(b.dataset.emp) } });
            alert('Empréstimo realizado! Devolução em 14 dias.');
            carregar(document.getElementById('busca').value);
          } catch (e) { alert(e.message); }
        };
      });
    } catch (e) { lista.innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  };
  document.getElementById('btn-buscar').onclick = () => carregar(document.getElementById('busca').value);
  document.getElementById('busca').onkeydown = e => { if (e.key === 'Enter') carregar(e.target.value); };
  document.getElementById('btn-limpar').onclick = () => { document.getElementById('busca').value = ''; carregar(''); };
  carregar();
}

// ============ MEUS EMPRÉSTIMOS ============
async function renderMeusEmprestimos() {
  const c = document.getElementById('conteudo');
  c.innerHTML = `<div class="card"><h2>Meus Empréstimos</h2><div id="lista"><div class="empty">Carregando...</div></div></div>`;
  try {
    const lista = await api('/api/meus-emprestimos');
    const el = document.getElementById('lista');
    if (!lista.length) { el.innerHTML = '<div class="empty">Você não tem empréstimos.</div>'; return; }
    const hoje = new Date().toISOString().slice(0, 10);
    el.innerHTML = `
      <table>
        <thead><tr><th>Título</th><th>Autor</th><th>Empréstimo</th><th>Devolução prevista</th><th>Status</th><th></th></tr></thead>
        <tbody>
        ${lista.map(e => {
          let status;
          if (e.data_devolucao) status = `<span class="badge ok">Devolvido em ${e.data_devolucao}</span>`;
          else if (e.data_prevista < hoje) status = '<span class="badge no">Em atraso</span>';
          else status = '<span class="badge warn">Em andamento</span>';
          return `<tr>
            <td>${esc(e.titulo)}</td>
            <td>${esc(e.autor)}</td>
            <td>${e.data_emprestimo}</td>
            <td>${e.data_prevista}</td>
            <td>${status}</td>
            <td>${!e.data_devolucao ? `<button class="small" data-dev="${e.id}">Devolver</button>` : ''}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    `;
    el.querySelectorAll('[data-dev]').forEach(b => {
      b.onclick = async () => {
        if (!confirm('Confirmar devolução?')) return;
        try {
          await api(`/api/emprestimos/${b.dataset.dev}/devolver`, { method: 'POST' });
          renderMeusEmprestimos();
        } catch (e) { alert(e.message); }
      };
    });
  } catch (e) {
    document.getElementById('lista').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// ============ GERENCIAR ITENS (bibliotecário) ============
async function renderGerenciar() {
  const c = document.getElementById('conteudo');
  c.innerHTML = `
    <div class="card">
      <h2 id="form-titulo">Novo Item</h2>
      <div id="msg-area"></div>
      <input type="hidden" id="edit-id">
      <label>Título</label>
      <input id="f-titulo" type="text">
      <label>Autor</label>
      <input id="f-autor" type="text">
      <label>Categoria</label>
      <input id="f-categoria" type="text">
      <label>Ano (opcional)</label>
      <input id="f-ano" type="number">
      <div class="row">
        <button id="btn-salvar">Salvar</button>
        <button class="secondary" id="btn-cancelar" style="display:none">Cancelar edição</button>
      </div>
    </div>
    <div class="card">
      <h2>Itens cadastrados</h2>
      <div id="lista"><div class="empty">Carregando...</div></div>
    </div>
  `;
  const limparForm = () => {
    ['f-titulo','f-autor','f-categoria','f-ano'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('edit-id').value = '';
    document.getElementById('form-titulo').textContent = 'Novo Item';
    document.getElementById('btn-cancelar').style.display = 'none';
  };
  const carregar = async () => {
    const lista = await api('/api/itens');
    const el = document.getElementById('lista');
    if (!lista.length) { el.innerHTML = '<div class="empty">Nenhum item cadastrado.</div>'; return; }
    el.innerHTML = `
      <table>
        <thead><tr><th>Título</th><th>Autor</th><th>Categoria</th><th>Ano</th><th>Status</th><th></th></tr></thead>
        <tbody>
        ${lista.map(it => `<tr>
          <td>${esc(it.titulo)}</td>
          <td>${esc(it.autor)}</td>
          <td>${esc(it.categoria)}</td>
          <td>${it.ano || '-'}</td>
          <td><span class="badge ${it.disponivel?'ok':'no'}">${it.disponivel?'Disponível':'Emprestado'}</span></td>
          <td>
            <button class="small secondary" data-edit="${it.id}">Editar</button>
            <button class="small danger" data-del="${it.id}">Remover</button>
          </td>
        </tr>`).join('')}
        </tbody>
      </table>
    `;
    el.querySelectorAll('[data-edit]').forEach(b => {
      b.onclick = () => {
        const it = lista.find(x => x.id == b.dataset.edit);
        document.getElementById('f-titulo').value = it.titulo;
        document.getElementById('f-autor').value = it.autor;
        document.getElementById('f-categoria').value = it.categoria;
        document.getElementById('f-ano').value = it.ano || '';
        document.getElementById('edit-id').value = it.id;
        document.getElementById('form-titulo').textContent = 'Editar Item';
        document.getElementById('btn-cancelar').style.display = 'inline-block';
        window.scrollTo(0, 0);
      };
    });
    el.querySelectorAll('[data-del]').forEach(b => {
      b.onclick = async () => {
        if (!confirm('Remover este item?')) return;
        try {
          await api('/api/itens/' + b.dataset.del, { method: 'DELETE' });
          carregar();
        } catch (e) { alert(e.message); }
      };
    });
  };
  document.getElementById('btn-cancelar').onclick = limparForm;
  document.getElementById('btn-salvar').onclick = async () => {
    const area = document.getElementById('msg-area');
    area.innerHTML = '';
    const body = {
      titulo: document.getElementById('f-titulo').value,
      autor: document.getElementById('f-autor').value,
      categoria: document.getElementById('f-categoria').value,
      ano: document.getElementById('f-ano').value || null
    };
    const id = document.getElementById('edit-id').value;
    try {
      if (id) await api('/api/itens/' + id, { method: 'PUT', body });
      else await api('/api/itens', { method: 'POST', body });
      limparForm();
      carregar();
    } catch (e) { area.appendChild(msg(e.message)); }
  };
  carregar();
}

// ============ HISTÓRICO (bibliotecário) ============
async function renderHistorico() {
  const c = document.getElementById('conteudo');
  c.innerHTML = `<div class="card"><h2>Histórico de Empréstimos</h2><div id="lista"><div class="empty">Carregando...</div></div></div>`;
  try {
    const lista = await api('/api/emprestimos');
    const el = document.getElementById('lista');
    if (!lista.length) { el.innerHTML = '<div class="empty">Nenhum empréstimo registrado.</div>'; return; }
    const hoje = new Date().toISOString().slice(0, 10);
    el.innerHTML = `
      <table>
        <thead><tr><th>Leitor</th><th>Título</th><th>Empréstimo</th><th>Prevista</th><th>Devolução</th><th>Status</th></tr></thead>
        <tbody>
        ${lista.map(e => {
          let status;
          if (e.data_devolucao) status = '<span class="badge ok">Devolvido</span>';
          else if (e.data_prevista < hoje) status = '<span class="badge no">Em atraso</span>';
          else status = '<span class="badge warn">Em andamento</span>';
          return `<tr>
            <td>${esc(e.leitor)}<br><small style="color:#718096">${esc(e.leitor_email)}</small></td>
            <td>${esc(e.titulo)}</td>
            <td>${e.data_emprestimo}</td>
            <td>${e.data_prevista}</td>
            <td>${e.data_devolucao || '-'}</td>
            <td>${status}</td>
          </tr>`;
        }).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    document.getElementById('lista').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// ============ LEITORES (bibliotecário) ============
async function renderUsuarios() {
  const c = document.getElementById('conteudo');
  c.innerHTML = `<div class="card"><h2>Leitores e situação</h2><div id="lista"><div class="empty">Carregando...</div></div></div>`;
  try {
    const lista = await api('/api/usuarios');
    const el = document.getElementById('lista');
    el.innerHTML = `
      <table>
        <thead><tr><th>Nome</th><th>Email</th><th>Papel</th><th>Empréstimos ativos</th><th>Atrasos</th><th>Situação</th></tr></thead>
        <tbody>
        ${lista.map(u => `
          <tr>
            <td>${esc(u.nome)}</td>
            <td>${esc(u.email)}</td>
            <td>${u.papel === 'bibliotecario' ? 'Bibliotecário' : 'Leitor'}</td>
            <td>${u.ativos}</td>
            <td>${u.atrasados}</td>
            <td>${u.atrasados > 0
              ? '<span class="badge no">Bloqueado para novos empréstimos</span>'
              : '<span class="badge ok">Liberado</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    document.getElementById('lista').innerHTML = `<div class="empty">${esc(e.message)}</div>`;
  }
}

// ============ INICIALIZAÇÃO ============
(async function init() {
  try {
    const data = await api('/api/eu');
    if (data.usuario) { usuario = data.usuario; renderApp(); }
    else renderLogin();
  } catch { renderLogin(); }
})();
