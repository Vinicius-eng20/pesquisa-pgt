const app = document.getElementById('app');
const areaUsuario = document.getElementById('area-usuario');

let estado = { usuario: null, aba: 'acervo' };

async function api(url, metodo = 'GET', corpo = null) {
  const opcoes = { method: metodo, headers: {} };
  if (corpo) {
    opcoes.headers['Content-Type'] = 'application/json';
    opcoes.body = JSON.stringify(corpo);
  }
  const resp = await fetch(url, opcoes);
  const dados = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(dados.erro || 'Erro inesperado. Tente novamente.');
  return dados;
}

function esc(t) {
  if (t === null || t === undefined) return '';
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtData(d) {
  if (!d) return '-';
  const dt = new Date(d.replace(' ', 'T') + (d.includes('Z') ? '' : 'Z'));
  return dt.toLocaleDateString('pt-BR');
}

function renderHeader() {
  if (estado.usuario) {
    areaUsuario.innerHTML = `
      <span>Olá, <strong>${esc(estado.usuario.nome)}</strong>${estado.usuario.papel === 'bibliotecario' ? ' 🛠️' : ''}</span>
      <button class="btn-sair btn-pequeno" onclick="sair()">Sair</button>
    `;
  } else {
    areaUsuario.innerHTML = '';
  }
}

async function sair() {
  await api('/api/logout', 'POST');
  estado.usuario = null;
  iniciar();
}

// ============ TELAS DE AUTENTICAÇÃO ============

function telaLogin() {
  renderHeader();
  app.innerHTML = `
    <div class="caixa caixa-login">
      <h2 class="secao">Entrar na sua conta</h2>
      <div id="msg"></div>
      <div class="campo"><label>E-mail</label><input type="email" id="login-email" placeholder="seu@email.com"></div>
      <div class="campo"><label>Senha</label><input type="password" id="login-senha" placeholder="Sua senha"></div>
      <button style="width:100%" onclick="fazerLogin()">Entrar</button>
      <div class="link-troca">Não tem conta? <a onclick="telaCadastro()">Cadastre-se</a></div>
    </div>
  `;
  document.getElementById('login-senha').addEventListener('keydown', e => { if (e.key === 'Enter') fazerLogin(); });
}

async function fazerLogin() {
  const msg = document.getElementById('msg');
  msg.innerHTML = '';
  try {
    const dados = await api('/api/login', 'POST', {
      email: document.getElementById('login-email').value,
      senha: document.getElementById('login-senha').value
    });
    estado.usuario = dados.usuario;
    estado.aba = dados.usuario.papel === 'bibliotecario' ? 'admin-acervo' : 'acervo';
    render();
  } catch (e) {
    msg.innerHTML = `<div class="erro">${esc(e.message)}</div>`;
  }
}

function telaCadastro() {
  app.innerHTML = `
    <div class="caixa caixa-login">
      <h2 class="secao">Criar conta de leitor</h2>
      <div id="msg"></div>
      <div class="campo"><label>Nome completo</label><input type="text" id="cad-nome" placeholder="Seu nome"></div>
      <div class="campo"><label>E-mail</label><input type="email" id="cad-email" placeholder="seu@email.com"></div>
      <div class="campo"><label>Senha</label><input type="password" id="cad-senha" placeholder="Mínimo 4 caracteres"></div>
      <button style="width:100%" onclick="fazerCadastro()">Criar conta</button>
      <div class="link-troca">Já tem conta? <a onclick="telaLogin()">Entrar</a></div>
    </div>
  `;
}

async function fazerCadastro() {
  const msg = document.getElementById('msg');
  msg.innerHTML = '';
  try {
    const dados = await api('/api/cadastro', 'POST', {
      nome: document.getElementById('cad-nome').value,
      email: document.getElementById('cad-email').value,
      senha: document.getElementById('cad-senha').value
    });
    estado.usuario = dados.usuario;
    estado.aba = 'acervo';
    render();
  } catch (e) {
    msg.innerHTML = `<div class="erro">${esc(e.message)}</div>`;
  }
}

// ============ ÁREA DO LEITOR ============

async function renderLeitor() {
  const abas = [
    { id: 'acervo', nome: '📖 Acervo' },
    { id: 'meus', nome: '📋 Meus Empréstimos' }
  ];
  app.innerHTML = `
    <div class="abas">${abas.map(a => `<button class="${estado.aba === a.id ? 'ativa' : ''}" onclick="mudarAba('${a.id}')">${a.nome}</button>`).join('')}</div>
    <div id="conteudo"></div>
  `;
  if (estado.aba === 'acervo') renderAcervo();
  else renderMeusEmprestimos();
}

function mudarAba(aba) {
  estado.aba = aba;
  render();
}

async function renderAcervo(busca = '') {
  const cont = document.getElementById('conteudo');
  cont.innerHTML = `
    <div class="barra-busca">
      <input type="text" id="campo-busca" placeholder="Buscar por título, autor ou categoria..." value="${esc(busca)}">
      <button onclick="buscarItens()">Buscar</button>
    </div>
    <div id="lista-itens"><div class="vazio">Carregando...</div></div>
  `;
  const campo = document.getElementById('campo-busca');
  campo.addEventListener('keydown', e => { if (e.key === 'Enter') buscarItens(); });

  try {
    const dados = await api('/api/itens' + (busca ? '?busca=' + encodeURIComponent(busca) : ''));
    const lista = document.getElementById('lista-itens');
    if (dados.itens.length === 0) {
      lista.innerHTML = '<div class="caixa vazio">Nenhum item encontrado.</div>';
      return;
    }
    lista.innerHTML = '<div class="grade-itens">' + dados.itens.map(i => `
      <div class="cartao-item">
        <span class="categoria">${esc(i.categoria || 'Geral')}</span>
        <h3>${esc(i.titulo)}</h3>
        <div class="autor">${esc(i.autor)}${i.ano ? ' • ' + i.ano : ''}</div>
        <div class="descricao">${esc(i.descricao)}</div>
        <div class="disp ${i.disponiveis > 0 ? 'ok' : 'esgotado'}">
          ${i.disponiveis > 0 ? `✔ ${i.disponiveis} disponível(is)` : '✖ Indisponível no momento'}
        </div>
        <button ${i.disponiveis === 0 ? 'disabled' : ''} onclick="pegarEmprestado(${i.id})">Pegar emprestado</button>
      </div>
    `).join('') + '</div>';
  } catch (e) {
    document.getElementById('lista-itens').innerHTML = `<div class="caixa erro">${esc(e.message)}</div>`;
  }
}

function buscarItens() {
  renderAcervo(document.getElementById('campo-busca').value.trim());
}

async function pegarEmprestado(itemId) {
  try {
    const dados = await api('/api/emprestar/' + itemId, 'POST');
    alert(dados.mensagem);
    renderAcervo();
  } catch (e) {
    alert(e.message);
  }
}

async function renderMeusEmprestimos() {
  const cont = document.getElementById('conteudo');
  cont.innerHTML = '<div class="caixa vazio">Carregando...</div>';
  try {
    const dados = await api('/api/meus-emprestimos');
    const ativos = dados.emprestimos.filter(e => e.status !== 'devolvido');
    const historico = dados.emprestimos.filter(e => e.status === 'devolvido');

    let html = '<div class="caixa"><h2 class="secao">Itens comigo</h2>';
    if (ativos.length === 0) {
      html += '<div class="vazio">Você não tem itens emprestados no momento.</div>';
    } else {
      html += '<div class="rolagem-tabela"><table><tr><th>Item</th><th>Pego em</th><th>Devolver até</th><th>Situação</th><th></th></tr>';
      ativos.forEach(e => {
        html += `<tr>
          <td><strong>${esc(e.titulo)}</strong><br><small>${esc(e.autor)}</small></td>
          <td>${fmtData(e.data_emprestimo)}</td>
          <td>${fmtData(e.data_prevista)}</td>
          <td><span class="tag ${e.status}">${e.status === 'atrasado' ? 'Atrasado' : 'Em dia'}</span></td>
          <td><button class="btn-sucesso btn-pequeno" onclick="devolverItem(${e.id})">Devolver</button></td>
        </tr>`;
      });
      html += '</table></div>';
    }
    html += '</div>';

    html += '<div class="caixa"><h2 class="secao">Histórico de devoluções</h2>';
    if (historico.length === 0) {
      html += '<div class="vazio">Nenhuma devolução registrada ainda.</div>';
    } else {
      html += '<div class="rolagem-tabela"><table><tr><th>Item</th><th>Pego em</th><th>Devolvido em</th></tr>';
      historico.forEach(e => {
        html += `<tr>
          <td><strong>${esc(e.titulo)}</strong><br><small>${esc(e.autor)}</small></td>
          <td>${fmtData(e.data_emprestimo)}</td>
          <td>${fmtData(e.data_devolucao)}</td>
        </tr>`;
      });
      html += '</table></div>';
    }
    html += '</div>';
    cont.innerHTML = html;
  } catch (e) {
    cont.innerHTML = `<div class="caixa erro">${esc(e.message)}</div>`;
  }
}

async function devolverItem(emprestimoId) {
  try {
    const dados = await api('/api/devolver/' + emprestimoId, 'POST');
    alert(dados.mensagem);
    renderMeusEmprestimos();
  } catch (e) {
    alert(e.message);
  }
}

// ============ ÁREA DO BIBLIOTECÁRIO ============

async function renderAdmin() {
  const abas = [
    { id: 'admin-acervo', nome: '📚 Acervo' },
    { id: 'admin-emprestimos', nome: '📋 Empréstimos' },
    { id: 'admin-leitores', nome: '👥 Leitores' }
  ];
  app.innerHTML = `
    <div id="resumo-admin"></div>
    <div class="abas">${abas.map(a => `<button class="${estado.aba === a.id ? 'ativa' : ''}" onclick="mudarAba('${a.id}')">${a.nome}</button>`).join('')}</div>
    <div id="conteudo"></div>
  `;
  renderResumo();
  if (estado.aba === 'admin-acervo') renderAdminAcervo();
  else if (estado.aba === 'admin-emprestimos') renderAdminEmprestimos('todos');
  else renderAdminLeitores();
}

async function renderResumo() {
  try {
    const r = await api('/api/admin/resumo');
    document.getElementById('resumo-admin').innerHTML = `
      <div class="resumo-cards">
        <div class="resumo-card"><div class="numero">${r.totalItens}</div><div class="rotulo">Itens no acervo</div></div>
        <div class="resumo-card"><div class="numero">${r.totalLeitores}</div><div class="rotulo">Leitores</div></div>
        <div class="resumo-card"><div class="numero">${r.emprestimosAtivos}</div><div class="rotulo">Empréstimos em dia</div></div>
        <div class="resumo-card alerta"><div class="numero">${r.emprestimosAtrasados}</div><div class="rotulo">Em atraso</div></div>
        <div class="resumo-card alerta"><div class="numero">${r.leitoresComAtraso}</div><div class="rotulo">Leitores com atraso</div></div>
      </div>
    `;
  } catch (e) {}
}

async function renderAdminAcervo() {
  const cont = document.getElementById('conteudo');
  cont.innerHTML = `
    <div class="caixa">
      <h2 class="secao" id="titulo-form">Cadastrar novo item</h2>
      <div id="msg-form"></div>
      <input type="hidden" id="item-id">
      <div class="form-grade">
        <div class="campo"><label>Título *</label><input type="text" id="item-titulo"></div>
        <div class="campo"><label>Autor</label><input type="text" id="item-autor"></div>
        <div class="campo"><label>Categoria</label><input type="text" id="item-categoria" placeholder="Ex: Romance, Infantil..."></div>
        <div class="campo"><label>Ano</label><input type="number" id="item-ano"></div>
        <div class="campo"><label>Quantidade de exemplares *</label><input type="number" id="item-quantidade" value="1" min="1"></div>
        <div class="campo largura-total"><label>Descrição</label><textarea id="item-descricao" rows="2"></textarea></div>
      </div>
      <div class="linha-botoes">
        <button class="btn-sucesso" onclick="salvarItem()">Salvar item</button>
        <button class="btn-neutro" onclick="limparFormItem()">Limpar</button>
      </div>
    </div>
    <div class="caixa">
      <h2 class="secao">Itens cadastrados</h2>
      <div id="lista-admin-itens"><div class="vazio">Carregando...</div></div>
    </div>
  `;
  carregarAdminItens();
}

async function carregarAdminItens() {
  try {
    const dados = await api('/api/admin/itens');
    const lista = document.getElementById('lista-admin-itens');
    const itens = dados.itens.filter(i => i.ativo);
    if (itens.length === 0) {
      lista.innerHTML = '<div class="vazio">Nenhum item cadastrado.</div>';
      return;
    }
    lista.innerHTML = '<div class="rolagem-tabela"><table><tr><th>Título</th><th>Autor</th><th>Categoria</th><th>Exemplares</th><th>Emprestados</th><th>Ações</th></tr>' +
      itens.map(i => `
        <tr>
          <td><strong>${esc(i.titulo)}</strong>${i.ano ? ' (' + i.ano + ')' : ''}</td>
          <td>${esc(i.autor)}</td>
          <td>${esc(i.categoria)}</td>
          <td>${i.quantidade}</td>
          <td>${i.emprestados}</td>
          <td>
            <div class="linha-botoes">
              <button class="btn-pequeno" onclick="editarItem(${i.id})">Editar</button>
              <button class="btn-perigo btn-pequeno" onclick="removerItem(${i.id}, '${esc(i.titulo).replace(/'/g, "\\'")}')">Remover</button>
            </div>
          </td>
        </tr>
      `).join('') + '</table></div>';
    window._itensAdmin = itens;
  } catch (e) {
    document.getElementById('lista-admin-itens').innerHTML = `<div class="erro">${esc(e.message)}</div>`;
  }
}

async function salvarItem() {
  const id = document.getElementById('item-id').value;
  const corpo = {
    titulo: document.getElementById('item-titulo').value,
    autor: document.getElementById('item-autor').value,
    categoria: document.getElementById('item-categoria').value,
    ano: document.getElementById('item-ano').value,
    descricao: document.getElementById('item-descricao').value,
    quantidade: document.getElementById('item-quantidade').value
  };
  const msg = document.getElementById('msg-form');
  msg.innerHTML = '';
  try {
    if (id) await api('/api/admin/itens/' + id, 'PUT', corpo);
    else await api('/api/admin/itens', 'POST', corpo);
    msg.innerHTML = `<div class="sucesso-msg">Item salvo com sucesso!</div>`;
    limparFormItem();
    carregarAdminItens();
    renderResumo();
  } catch (e) {
    msg.innerHTML = `<div class="erro">${esc(e.message)}</div>`;
  }
}

function limparFormItem() {
  document.getElementById('item-id').value = '';
  document.getElementById('item-titulo').value = '';
  document.getElementById('item-autor').value = '';
  document.getElementById('item-categoria').value = '';
  document.getElementById('item-ano').value = '';
  document.getElementById('item-descricao').value = '';
  document.getElementById('item-quantidade').value = '1';
  document.getElementById('titulo-form').textContent = 'Cadastrar novo item';
}

function editarItem(id) {
  const item = window._itensAdmin.find(i => i.id === id);
  if (!item) return;
  document.getElementById('item-id').value = item.id;
  document.getElementById('item-titulo').value = item.titulo;
  document.getElementById('item-autor').value = item.autor;
  document.getElementById('item-categoria').value = item.categoria;
  document.getElementById('item-ano').value = item.ano || '';
  document.getElementById('item-descricao').value = item.descricao;
  document.getElementById('item-quantidade').value = item.quantidade;
  document.getElementById('titulo-form').textContent = 'Editando: ' + item.titulo;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function removerItem(id, titulo) {
  if (!confirm(`Remover "${titulo}" do acervo?`)) return;
  try {
    await api('/api/admin/itens/' + id, 'DELETE');
    carregarAdminItens();
    renderResumo();
  } catch (e) {
    alert(e.message);
  }
}

async function renderAdminEmprestimos(filtro) {
  const cont = document.getElementById('conteudo');
  cont.innerHTML = `
    <div class="caixa">
      <h2 class="secao">Histórico de empréstimos</h2>
      <div class="abas" style="margin-bottom:14px">
        <button class="${filtro === 'todos' ? 'ativa' : ''}" onclick="renderAdminEmprestimos('todos')">Todos</button>
        <button class="${filtro === 'ativos' ? 'ativa' : ''}" onclick="renderAdminEmprestimos('ativos')">Em dia</button>
        <button class="${filtro === 'atrasados' ? 'ativa' : ''}" onclick="renderAdminEmprestimos('atrasados')">Atrasados</button>
        <button class="${filtro === 'devolvidos' ? 'ativa' : ''}" onclick="renderAdminEmprestimos('devolvidos')">Devolvidos</button>
      </div>
      <div id="lista-emp-admin"><div class="vazio">Carregando...</div></div>
    </div>
  `;
  try {
    const dados = await api('/api/admin/emprestimos?filtro=' + filtro);
    const lista = document.getElementById('lista-emp-admin');
    if (dados.emprestimos.length === 0) {
      lista.innerHTML = '<div class="vazio">Nenhum empréstimo encontrado.</div>';
      return;
    }
    lista.innerHTML = '<div class="rolagem-tabela"><table><tr><th>Leitor</th><th>Item</th><th>Pego em</th><th>Prazo</th><th>Devolução</th><th>Situação</th><th></th></tr>' +
      dados.emprestimos.map(e => `
        <tr>
          <td><strong>${esc(e.leitor_nome)}</strong><br><small>${esc(e.leitor_email)}</small></td>
          <td>${esc(e.titulo)}</td>
          <td>${fmtData(e.data_emprestimo)}</td>
          <td>${fmtData(e.data_prevista)}</td>
          <td>${e.data_devolucao ? fmtData(e.data_devolucao) : '-'}</td>
          <td><span class="tag ${e.status}">${e.status === 'atrasado' ? 'Atrasado' : e.status === 'ativo' ? 'Em dia' : 'Devolvido'}</span></td>
          <td>${e.status !== 'devolvido' ? `<button class="btn-sucesso btn-pequeno" onclick="devolverItemAdmin(${e.id}, '${filtro}')">Devolver</button>` : ''}</td>
        </tr>
      `).join('') + '</table></div>';
  } catch (e) {
    document.getElementById('lista-emp-admin').innerHTML = `<div class="erro">${esc(e.message)}</div>`;
  }
}

async function devolverItemAdmin(id, filtro) {
  try {
    await api('/api/devolver/' + id, 'POST');
    renderAdminEmprestimos(filtro);
    renderResumo();
  } catch (e) {
    alert(e.message);
  }
}

async function renderAdminLeitores() {
  const cont = document.getElementById('conteudo');
  cont.innerHTML = '<div class="caixa"><h2 class="secao">Leitores cadastrados</h2><div id="lista-leitores"><div class="vazio">Carregando...</div></div></div>';
  try {
    const dados = await api('/api/admin/leitores');
    const lista = document.getElementById('lista-leitores');
    if (dados.leitores.length === 0) {
      lista.innerHTML = '<div class="vazio">Nenhum leitor cadastrado ainda.</div>';
      return;
    }
    lista.innerHTML = '<div class="rolagem-tabela"><table><tr><th>Nome</th><th>E-mail</th><th>Empréstimos ativos</th><th>Em atraso</th><th>Situação</th><th>Ações</th></tr>' +
      dados.leitores.map(l => `
        <tr>
          <td><strong>${esc(l.nome)}</strong></td>
          <td>${esc(l.email)}</td>
          <td>${l.emprestimos_ativos}</td>
          <td>${l.atrasados > 0 ? `<span class="tag atrasado">${l.atrasados}</span>` : '0'}</td>
          <td><span class="tag ${l.bloqueado ? 'bloqueado' : 'liberado'}">${l.bloqueado ? 'Bloqueado' : 'Liberado'}</span></td>
          <td>
            ${l.bloqueado
              ? `<button class="btn-sucesso btn-pequeno" onclick="desbloquearLeitor(${l.id})">Desbloquear</button>`
              : `<button class="btn-perigo btn-pequeno" onclick="bloquearLeitor(${l.id})">Bloquear</button>`}
          </td>
        </tr>
      `).join('') + '</table></div>';
  } catch (e) {
    document.getElementById('lista-leitores').innerHTML = `<div class="erro">${esc(e.message)}</div>`;
  }
}

async function bloquearLeitor(id) {
  try {
    const d = await api(`/api/admin/leitores/${id}/bloquear`, 'POST');
    alert(d.mensagem);
    renderAdminLeitores();
  } catch (e) {
    alert(e.message);
  }
}

async function desbloquearLeitor(id) {
  try {
    const d = await api(`/api/admin/leitores/${id}/desbloquear`, 'POST');
    alert(d.mensagem);
    renderAdminLeitores();
  } catch (e) {
    alert(e.message);
  }
}

// ============ INICIALIZAÇÃO ============

function render() {
  renderHeader();
  if (!estado.usuario) telaLogin();
  else if (estado.usuario.papel === 'bibliotecario') renderAdmin();
  else renderLeitor();
}

async function iniciar() {
  try {
    const dados = await api('/api/me');
    estado.usuario = dados.usuario;
    if (estado.usuario && estado.usuario.papel === 'bibliotecario' && !estado.aba.startsWith('admin')) {
      estado.aba = 'admin-acervo';
    }
    if (estado.usuario && estado.usuario.papel === 'leitor' && estado.aba.startsWith('admin')) {
      estado.aba = 'acervo';
    }
  } catch (e) {
    estado.usuario = null;
  }
  render();
}

iniciar();
