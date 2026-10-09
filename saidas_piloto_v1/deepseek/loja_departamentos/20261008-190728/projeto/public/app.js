let usuarioAtual = null;
let carrinho = JSON.parse(localStorage.getItem('carrinho') || '[]');
let categoriaAtual = '';
let termoBusca = '';

function salvarCarrinho() {
  localStorage.setItem('carrinho', JSON.stringify(carrinho));
  atualizarBotaoCarrinho();
}

function atualizarBotaoCarrinho() {
  const total = carrinho.reduce((s, i) => s + i.quantidade, 0);
  const btn = document.getElementById('btnCarrinho');
  if (btn) btn.textContent = '🛒 Carrinho (' + total + ')';
}

function toast(msg, tipo) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ativo ' + (tipo || '');
  setTimeout(() => t.className = 'toast ' + (tipo || ''), 3000);
}

async function api(url, options) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.erro || 'Erro na requisição');
  return data;
}

async function carregarUsuario() {
  try {
    const d = await api('/api/eu');
    usuarioAtual = d.usuario;
  } catch { usuarioAtual = null; }
  renderizarHeader();
}

function renderizarHeader() {
  const acoes = document.getElementById('headerAcoes');
  let html = '<button onclick="abrirCarrinho()" id="btnCarrinho">🛒 Carrinho (0)</button>';
  if (usuarioAtual) {
    html += '<button onclick="irPara(\'meus-pedidos\')">Meus Pedidos</button>';
    if (usuarioAtual.is_admin) html += '<button class="destaque" onclick="irPara(\'admin\')">Painel Admin</button>';
    html += '<span style="padding:0 8px">Olá, ' + usuarioAtual.nome.split(' ')[0] + '</span>';
    html += '<button onclick="logout()">Sair</button>';
  } else {
    html += '<button class="destaque" onclick="abrirLogin()">Entrar / Cadastrar</button>';
  }
  acoes.innerHTML = html;
  atualizarBotaoCarrinho();
}

async function carregarCategorias() {
  try {
    const cats = await api('/api/categorias');
    const menu = document.getElementById('menuCategorias');
    let html = '<button onclick="filtrarCategoria(\'\')" class="' + (categoriaAtual === '' ? 'ativo' : '') + '">Todos</button>';
    for (const c of cats) {
      html += '<button onclick="filtrarCategoria(\'' + c + '\')" class="' + (categoriaAtual === c ? 'ativo' : '') + '">' + c + '</button>';
    }
    menu.innerHTML = html;
  } catch {}
}

function filtrarCategoria(c) {
  categoriaAtual = c;
  termoBusca = '';
  document.getElementById('campoBusca').value = '';
  carregarCategorias();
  irPara('home');
}

function buscarProdutos() {
  termoBusca = document.getElementById('campoBusca').value.trim();
  categoriaAtual = '';
  carregarCategorias();
  irPara('home');
}

async function renderHome() {
  const app = document.getElementById('app');
  app.innerHTML = '<h1>Produtos</h1><div id="listaProdutos" class="grid-produtos"></div>';
  let url = '/api/produtos?';
  if (categoriaAtual) url += 'categoria=' + encodeURIComponent(categoriaAtual) + '&';
  if (termoBusca) url += 'busca=' + encodeURIComponent(termoBusca) + '&';
  try {
    const produtos = await api(url);
    const lista = document.getElementById('listaProdutos');
    if (!produtos.length) {
      lista.innerHTML = '<p>Nenhum produto encontrado.</p>';
      return;
    }
    lista.innerHTML = produtos.map(p => {
      const img = p.imagem ? '<img src="' + p.imagem + '" alt="' + p.nome + '">' : '📦';
      const semEstoque = p.estoque <= 0;
      return '<div class="card-produto">' +
        '<div class="imagem">' + img + '</div>' +
        '<div class="info">' +
        '<div class="categoria">' + p.categoria + '</div>' +
        '<div class="nome">' + p.nome + '</div>' +
        '<div class="descricao">' + (p.descricao || '') + '</div>' +
        '<div class="preco">R$ ' + p.preco.toFixed(2).replace('.', ',') + '</div>' +
        '<div class="estoque">' + (semEstoque ? 'Sem estoque' : 'Estoque: ' + p.estoque) + '</div>' +
        '<button ' + (semEstoque ? 'disabled' : '') + ' onclick="adicionarAoCarrinho(' + p.id + ')">' +
        (semEstoque ? 'Indisponível' : 'Adicionar ao Carrinho') + '</button>' +
        '</div></div>';
    }).join('');
  } catch (e) {
    document.getElementById('listaProdutos').innerHTML = '<p>Erro ao carregar produtos.</p>';
  }
}

async function adicionarAoCarrinho(produtoId) {
  try {
    const produtos = await api('/api/produtos');
    const p = produtos.find(x => x.id === produtoId);
    if (!p) return;
    const item = carrinho.find(i => i.produto_id === produtoId);
    if (item) {
      if (item.quantidade >= p.estoque) { toast('Estoque insuficiente', 'erro'); return; }
      item.quantidade++;
    } else {
      if (p.estoque <= 0) { toast('Sem estoque', 'erro'); return; }
      carrinho.push({ produto_id: p.id, nome: p.nome, preco: p.preco, quantidade: 1 });
    }
    salvarCarrinho();
    toast('Adicionado ao carrinho!', 'sucesso');
  } catch (e) { toast(e.message, 'erro'); }
}

function abrirCarrinho() {
  renderizarCarrinho();
  document.getElementById('modalCarrinho').classList.add('ativo');
}

function renderizarCarrinho() {
  const el = document.getElementById('carrinhoConteudo');
  if (!carrinho.length) {
    el.innerHTML = '<div class="carrinho-vazio">Seu carrinho está vazio.</div>';
    return;
  }
  let html = carrinho.map((i, idx) =>
    '<div class="item-carrinho">' +
    '<div class="info"><h4>' + i.nome + '</h4><p>R$ ' + i.preco.toFixed(2).replace('.', ',') + '</p></div>' +
    '<div class="qtd">' +
    '<button onclick="alterarQtd(' + idx + ', -1)">−</button>' +
    '<span>' + i.quantidade + '</span>' +
    '<button onclick="alterarQtd(' + idx + ', 1)">+</button>' +
    '</div>' +
    '<strong>R$ ' + (i.preco * i.quantidade).toFixed(2).replace('.', ',') + '</strong>' +
    '<button class="btn btn-perigo" onclick="removerItem(' + idx + ')" style="padding:6px 10px">✕</button>' +
    '</div>'
  ).join('');
  const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
  html += '<div class="carrinho-total"><span>Total:</span><span>R$ ' + total.toFixed(2).replace('.', ',') + '</span></div>';
  html += '<div style="margin-top:15px"><label>Endereço de entrega:</label><input type="text" id="enderecoEntrega" placeholder="Rua, número, cidade" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:6px;margin-top:5px"></div>';
  html += '<button class="btn btn-primario" style="width:100%;margin-top:15px;padding:14px" onclick="finalizarPedido()">Finalizar Pedido</button>';
  el.innerHTML = html;
}

function alterarQtd(idx, delta) {
  carrinho[idx].quantidade += delta;
  if (carrinho[idx].quantidade < 1) carrinho.splice(idx, 1);
  salvarCarrinho();
  renderizarCarrinho();
}

function removerItem(idx) {
  carrinho.splice(idx, 1);
  salvarCarrinho();
  renderizarCarrinho();
}

async function finalizarPedido() {
  if (!usuarioAtual) {
    fecharModal('modalCarrinho');
    toast('Faça login para finalizar', 'erro');
    abrirLogin();
    return;
  }
  const endereco = document.getElementById('enderecoEntrega').value.trim();
  if (!endereco) { toast('Informe o endereço', 'erro'); return; }
  try {
    const itens = carrinho.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade }));
    await api('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itens, endereco })
    });
    carrinho = [];
    salvarCarrinho();
    fecharModal('modalCarrinho');
    toast('Pedido realizado com sucesso!', 'sucesso');
    irPara('meus-pedidos');
  } catch (e) { toast(e.message, 'erro'); }
}

async function renderMeusPedidos() {
  const app = document.getElementById('app');
  app.innerHTML = '<h1>Meus Pedidos</h1><div id="listaPedidos"></div>';
  try {
    const pedidos = await api('/api/meus-pedidos');
    const el = document.getElementById('listaPedidos');
    if (!pedidos.length) { el.innerHTML = '<p>Você ainda não fez nenhum pedido.</p>'; return; }
    el.innerHTML = pedidos.map(p => {
      const itens = p.itens.map(i => '<li>' + i.quantidade + 'x ' + i.nome_produto + ' — R$ ' + (i.preco_unitario * i.quantidade).toFixed(2).replace('.', ',') + '</li>').join('');
      return '<div class="pedido-card">' +
        '<div class="pedido-header">' +
        '<h3>Pedido #' + p.id + '</h3>' +
        '<span class="badge ' + p.status + '">' + p.status + '</span>' +
        '</div>' +
        '<p><strong>Data:</strong> ' + new Date(p.criado_em).toLocaleString('pt-BR') + '</p>' +
        '<p><strong>Endereço:</strong> ' + (p.endereco || '-') + '</p>' +
        '<ul style="margin:10px 0 10px 20px">' + itens + '</ul>' +
        '<p><strong>Total: R$ ' + p.total.toFixed(2).replace('.', ',') + '</strong></p>' +
        '</div>';
    }).join('');
  } catch (e) { document.getElementById('listaPedidos').innerHTML = '<p>' + e.message + '</p>'; }
}

async function renderAdmin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <h1>Painel do Administrador</h1>
    <div class="abas" style="max-width:400px;margin-bottom:20px">
      <button id="tabProd" class="ativo" onclick="mudarAbaAdmin('produtos')">Produtos</button>
      <button id="tabPed" onclick="mudarAbaAdmin('pedidos')">Pedidos</button>
      <button id="tabCli" onclick="mudarAbaAdmin('clientes')">Clientes</button>
    </div>
    <div id="adminConteudo"></div>
  `;
  mudarAbaAdmin('produtos');
}

function mudarAbaAdmin(aba) {
  document.querySelectorAll('.abas button').forEach(b => b.classList.remove('ativo'));
  if (aba === 'produtos') document.getElementById('tabProd').classList.add('ativo');
  if (aba === 'pedidos') document.getElementById('tabPed').classList.add('ativo');
  if (aba === 'clientes') document.getElementById('tabCli').classList.add('ativo');
  if (aba === 'produtos') adminProdutos();
  if (aba === 'pedidos') adminPedidos();
  if (aba === 'clientes') adminClientes();
}

async function adminProdutos() {
  const el = document.getElementById('adminConteudo');
  el.innerHTML = `
    <div class="painel">
      <h2 id="tituloFormProd">Novo Produto</h2>
      <form id="formProduto" onsubmit="salvarProduto(event)">
        <input type="hidden" id="prodId">
        <div class="form-linha">
          <div class="form-grupo"><label>Nome *</label><input type="text" id="prodNome" required></div>
          <div class="form-grupo"><label>Categoria *</label><input type="text" id="prodCategoria" required></div>
        </div>
        <div class="form-grupo" style="margin-bottom:15px"><label>Descrição</label><textarea id="prodDescricao"></textarea></div>
        <div class="form-linha">
          <div class="form-grupo"><label>Preço (R$) *</label><input type="number" step="0.01" min="0" id="prodPreco" required></div>
          <div class="form-grupo"><label>Estoque</label><input type="number" min="0" id="prodEstoque" value="0"></div>
        </div>
        <div class="form-grupo" style="margin-bottom:15px"><label>Imagem (opcional)</label><input type="file" id="prodImagem" accept="image/*"></div>
        <button type="submit" class="btn btn-primario">Salvar</button>
        <button type="button" class="btn btn-secundario" onclick="limparFormProduto()">Cancelar</button>
      </form>
    </div>
    <div class="painel">
      <h2>Produtos Cadastrados</h2>
      <div style="overflow-x:auto"><table class="tabela" id="tabelaProdutos"></table></div>
    </div>
  `;
  await carregarTabelaProdutos();
}

async function carregarTabelaProdutos() {
  try {
    const produtos = await api('/api/produtos');
    const t = document.getElementById('tabelaProdutos');
    if (!produtos.length) { t.innerHTML = '<tr><td>Nenhum produto.</td></tr>'; return; }
    t.innerHTML = '<thead><tr><th>ID</th><th>Imagem</th><th>Nome</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Ações</th></tr></thead><tbody>' +
      produtos.map(p => '<tr>' +
        '<td>' + p.id + '</td>' +
        '<td>' + (p.imagem ? '<img src="' + p.imagem + '" style="width:50px;height:50px;object-fit:cover;border-radius:4px">' : '📦') + '</td>' +
        '<td>' + p.nome + '</td>' +
        '<td>' + p.categoria + '</td>' +
        '<td>R$ ' + p.preco.toFixed(2).replace('.', ',') + '</td>' +
        '<td>' + p.estoque + '</td>' +
        '<td class="acoes">' +
        '<button class="btn btn-primario" style="padding:6px 12px" onclick="editarProduto(' + p.id + ')">Editar</button>' +
        '<button class="btn btn-perigo" style="padding:6px 12px" onclick="excluirProduto(' + p.id + ')">Excluir</button>' +
        '</td></tr>').join('') + '</tbody>';
  } catch (e) { toast(e.message, 'erro'); }
}

async function editarProduto(id) {
  const produtos = await api('/api/produtos');
  const p = produtos.find(x => x.id === id);
  if (!p) return;
  document.getElementById('prodId').value = p.id;
  document.getElementById('prodNome').value = p.nome;
  document.getElementById('prodCategoria').value = p.categoria;
  document.getElementById('prodDescricao').value = p.descricao || '';
  document.getElementById('prodPreco').value = p.preco;
  document.getElementById('prodEstoque').value = p.estoque;
  document.getElementById('tituloFormProd').textContent = 'Editar Produto #' + p.id;
  window.scrollTo(0, 0);
}

function limparFormProduto() {
  document.getElementById('formProduto').reset();
  document.getElementById('prodId').value = '';
  document.getElementById('tituloFormProd').textContent = 'Novo Produto';
}

async function salvarProduto(e) {
  e.preventDefault();
  const id = document.getElementById('prodId').value;
  const fd = new FormData();
  fd.append('nome', document.getElementById('prodNome').value);
  fd.append('categoria', document.getElementById('prodCategoria').value);
  fd.append('descricao', document.getElementById('prodDescricao').value);
  fd.append('preco', document.getElementById('prodPreco').value);
  fd.append('estoque', document.getElementById('prodEstoque').value);
  const img = document.getElementById('prodImagem').files[0];
  if (img) fd.append('imagem', img);
  try {
    if (id) {
      await api('/api/produtos/' + id, { method: 'PUT', body: fd });
      toast('Produto atualizado!', 'sucesso');
    } else {
      await api('/api/produtos', { method: 'POST', body: fd });
      toast('Produto cadastrado!', 'sucesso');
    }
    limparFormProduto();
    carregarTabelaProdutos();
    carregarCategorias();
  } catch (e) { toast(e.message, 'erro'); }
}

async function excluirProduto(id) {
  if (!confirm('Remover este produto?')) return;
  try {
    await api('/api/produtos/' + id, { method: 'DELETE' });
    toast('Produto removido', 'sucesso');
    carregarTabelaProdutos();
    carregarCategorias();
  } catch (e) { toast(e.message, 'erro'); }
}

async function adminPedidos() {
  const el = document.getElementById('adminConteudo');
  try {
    const pedidos = await api('/api/admin/pedidos');
    if (!pedidos.length) { el.innerHTML = '<p>Nenhum pedido ainda.</p>'; return; }
    el.innerHTML = pedidos.map(p => {
      const itens = p.itens.map(i => '<li>' + i.quantidade + 'x ' + i.nome_produto + ' — R$ ' + (i.preco_unitario * i.quantidade).toFixed(2).replace('.', ',') + '</li>').join('');
      const opcoes = ['pendente', 'pago', 'enviado', 'entregue', 'cancelado'].map(s =>
        '<option value="' + s + '" ' + (s === p.status ? 'selected' : '') + '>' + s + '</option>').join('');
      return '<div class="pedido-card">' +
        '<div class="pedido-header">' +
        '<h3>Pedido #' + p.id + ' — ' + p.cliente_nome + '</h3>' +
        '<span class="badge ' + p.status + '">' + p.status + '</span>' +
        '</div>' +
        '<p><strong>Cliente:</strong> ' + p.cliente_nome + ' (' + p.cliente_email + ')</p>' +
        '<p><strong>Data:</strong> ' + new Date(p.criado_em).toLocaleString('pt-BR') + '</p>' +
        '<p><strong>Endereço:</strong> ' + (p.endereco || '-') + '</p>' +
        '<ul style="margin:10px 0 10px 20px">' + itens + '</ul>' +
        '<p><strong>Total: R$ ' + p.total.toFixed(2).replace('.', ',') + '</strong></p>' +
        '<div style="margin-top:12px"><label>Alterar status: </label>' +
        '<select onchange="alterarStatus(' + p.id + ', this.value)" style="padding:6px;border-radius:4px;border:1px solid #ddd">' + opcoes + '</select>' +
        '</div></div>';
    }).join('');
  } catch (e) { el.innerHTML = '<p>' + e.message + '</p>'; }
}

async function alterarStatus(id, status) {
  try {
    await api('/api/admin/pedidos/' + id + '/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    toast('Status atualizado!', 'sucesso');
    adminPedidos();
  } catch (e) { toast(e.message, 'erro'); }
}

async function adminClientes() {
  const el = document.getElementById('adminConteudo');
  try {
    const clientes = await api('/api/admin/clientes');
    if (!clientes.length) { el.innerHTML = '<p>Nenhum cliente cadastrado.</p>'; return; }
    el.innerHTML = '<div class="painel"><h2>Clientes Cadastrados</h2><div style="overflow-x:auto"><table class="tabela"><thead><tr><th>ID</th><th>Nome</th><th>E-mail</th><th>Cadastro</th></tr></thead><tbody>' +
      clientes.map(c => '<tr><td>' + c.id + '</td><td>' + c.nome + '</td><td>' + c.email + '</td><td>' + new Date(c.criado_em).toLocaleDateString('pt-BR') + '</td></tr>').join('') +
      '</tbody></table></div></div>';
  } catch (e) { el.innerHTML = '<p>' + e.message + '</p>'; }
}

function abrirLogin() {
  mostrarAba('login');
  document.getElementById('modalLogin').classList.add('ativo');
}

function mostrarAba(aba) {
  const ehLogin = aba === 'login';
  document.getElementById('abaLogin').classList.toggle('ativo', ehLogin);
  document.getElementById('abaRegistrar').classList.toggle('ativo', !ehLogin);
  document.getElementById('authNome').style.display = ehLogin ? 'none' : 'block';
  document.getElementById('authNome').required = !ehLogin;
  document.getElementById('tituloAuth').textContent = ehLogin ? 'Entrar' : 'Criar Conta';
  document.getElementById('botaoAuth').textContent = ehLogin ? 'Entrar' : 'Cadastrar';
  document.getElementById('msgAuth').textContent = '';
  window._abaAtual = aba;
}

async function enviarAuth(e) {
  e.preventDefault();
  const aba = window._abaAtual || 'login';
  const dados = {
    email: document.getElementById('authEmail').value,
    senha: document.getElementById('authSenha').value
  };
  if (aba === 'registrar') dados.nome = document.getElementById('authNome').value;
  try {
    const d = await api(aba === 'login' ? '/api/login' : '/api/registrar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });
    usuarioAtual = d.usuario;
    fecharModal('modalLogin');
    document.getElementById('formAuth').reset();
    renderizarHeader();
    toast(aba === 'login' ? 'Bem-vindo!' : 'Conta criada!', 'sucesso');
    if (window._paginaAtual === 'meus-pedidos') renderMeusPedidos();
  } catch (e) {
    document.getElementById('msgAuth').textContent = e.message;
  }
}

async function logout() {
  await api('/api/logout', { method: 'POST' });
  usuarioAtual = null;
  renderizarHeader();
  irPara('home');
  toast('Saiu da conta');
}

function fecharModal(id) {
  document.getElementById(id).classList.remove('ativo');
}

window.addEventListener('click', e => {
  if (e.target.classList.contains('modal')) e.target.classList.remove('ativo');
});

function irPara(pagina) {
  window._paginaAtual = pagina;
  if (pagina === 'home') renderHome();
  else if (pagina === 'meus-pedidos') {
    if (!usuarioAtual) { abrirLogin(); return; }
    renderMeusPedidos();
  }
  else if (pagina === 'admin') {
    if (!usuarioAtual || !usuarioAtual.is_admin) { toast('Acesso restrito', 'erro'); return; }
    renderAdmin();
  }
  window.scrollTo(0, 0);
}

(async function init() {
  await carregarUsuario();
  await carregarCategorias();
  irPara('home');
})();
