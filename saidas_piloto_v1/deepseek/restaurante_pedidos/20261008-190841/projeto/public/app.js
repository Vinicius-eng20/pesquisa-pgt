let usuarioAtual = null;
let pratosCache = [];
let carrinho = JSON.parse(localStorage.getItem('carrinho') || '[]');

function salvarCarrinho() {
  localStorage.setItem('carrinho', JSON.stringify(carrinho));
  atualizarCartCount();
}
function atualizarCartCount() {
  const total = carrinho.reduce((s, i) => s + i.quantidade, 0);
  const el = document.getElementById('cartCount');
  if (el) el.textContent = total;
}

async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.erro || 'Erro');
  return data;
}

async function carregarUsuario() {
  usuarioAtual = await api('/api/eu');
  renderizarTela();
}

function renderizarTela() {
  const auth = document.getElementById('authScreen');
  const cli = document.getElementById('clienteScreen');
  const ger = document.getElementById('gerenteScreen');
  const userArea = document.getElementById('userArea');
  auth.classList.add('hidden');
  cli.classList.add('hidden');
  ger.classList.add('hidden');

  if (!usuarioAtual) {
    auth.classList.remove('hidden');
    userArea.innerHTML = '';
    return;
  }
  userArea.innerHTML = `<span>Olá, ${usuarioAtual.nome}</span> <button class="small" onclick="logout()">Sair</button>`;
  if (usuarioAtual.tipo === 'gerente') {
    ger.classList.remove('hidden');
    carregarPratosGerente();
    carregarTodosPedidos();
  } else {
    cli.classList.remove('hidden');
    carregarCardapio();
    carregarMeusPedidos();
    atualizarCartCount();
  }
}

// AUTH
async function login() {
  const email = document.getElementById('loginEmail').value;
  const senha = document.getElementById('loginSenha').value;
  try {
    usuarioAtual = await api('/api/login', { method: 'POST', body: { email, senha } });
    document.getElementById('authMsg').textContent = '';
    renderizarTela();
  } catch (e) {
    document.getElementById('authMsg').textContent = e.message;
  }
}
async function cadastrar() {
  const nome = document.getElementById('cadNome').value;
  const email = document.getElementById('cadEmail').value;
  const senha = document.getElementById('cadSenha').value;
  try {
    usuarioAtual = await api('/api/cadastro', { method: 'POST', body: { nome, email, senha } });
    document.getElementById('authMsg').textContent = '';
    renderizarTela();
  } catch (e) {
    document.getElementById('authMsg').textContent = e.message;
  }
}
async function logout() {
  await api('/api/logout', { method: 'POST' });
  usuarioAtual = null;
  carrinho = [];
  salvarCarrinho();
  renderizarTela();
}

// TABS
function mostrarTab(tab) {
  document.querySelectorAll('#clienteScreen .tab-content').forEach(s => s.classList.add('hidden'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  document.querySelectorAll('#clienteScreen .tabs button').forEach(b => b.classList.remove('tab-active'));
  document.querySelector(`#clienteScreen .tabs button[data-tab="${tab}"]`).classList.add('tab-active');
}
function mostrarTabG(tab) {
  document.querySelectorAll('#gerenteScreen .tab-content').forEach(s => s.classList.add('hidden'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  document.querySelectorAll('#gerenteScreen .tabs button').forEach(b => b.classList.remove('tab-active'));
  document.querySelector(`#gerenteScreen .tabs button[data-tab="${tab}"]`).classList.add('tab-active');
}

// CARDAPIO
async function carregarCardapio() {
  pratosCache = await api('/api/pratos');
  const el = document.getElementById('listaPratos');
  el.innerHTML = pratosCache.map(p => `
    <div class="prato-card">
      <span class="categoria">${p.categoria}</span>
      <h4>${p.nome}</h4>
      <p class="descricao">${p.descricao || ''}</p>
      <p class="preco">R$ ${p.preco.toFixed(2)}</p>
      ${p.disponivel
        ? `<button class="primary small" onclick="adicionarAoCarrinho(${p.id})">Adicionar</button>`
        : `<p class="indisponivel">Indisponível</p>`}
    </div>
  `).join('');
}

function adicionarAoCarrinho(id) {
  const prato = pratosCache.find(p => p.id === id);
  if (!prato) return;
  const item = carrinho.find(i => i.prato_id === id);
  if (item) item.quantidade++;
  else carrinho.push({ prato_id: id, nome: prato.nome, preco: prato.preco, quantidade: 1 });
  salvarCarrinho();
  renderizarCarrinho();
  alert(prato.nome + ' adicionado ao carrinho!');
}

function renderizarCarrinho() {
  const el = document.getElementById('carrinhoItens');
  if (carrinho.length === 0) {
    el.innerHTML = '<p>Seu carrinho está vazio.</p>';
    document.getElementById('carrinhoTotal').textContent = '';
    return;
  }
  el.innerHTML = carrinho.map((i, idx) => `
    <div class="carrinho-item">
      <span class="nome">${i.nome} - R$ ${i.preco.toFixed(2)}</span>
      <div class="qtd-ctrl">
        <button class="small" onclick="alterarQtd(${idx}, -1)">-</button>
        <span>${i.quantidade}</span>
        <button class="small" onclick="alterarQtd(${idx}, 1)">+</button>
        <button class="danger" onclick="removerItem(${idx})">Remover</button>
      </div>
    </div>
  `).join('');
  const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
  document.getElementById('carrinhoTotal').textContent = 'Total: R$ ' + total.toFixed(2);
}

function alterarQtd(idx, delta) {
  carrinho[idx].quantidade += delta;
  if (carrinho[idx].quantidade <= 0) carrinho.splice(idx, 1);
  salvarCarrinho();
  renderizarCarrinho();
}
function removerItem(idx) {
  carrinho.splice(idx, 1);
  salvarCarrinho();
  renderizarCarrinho();
}

async function finalizarPedido() {
  if (carrinho.length === 0) return alert('Carrinho vazio');
  try {
    await api('/api/pedidos', {
      method: 'POST',
      body: { itens: carrinho.map(i => ({ prato_id: i.prato_id, quantidade: i.quantidade })) }
    });
    carrinho = [];
    salvarCarrinho();
    renderizarCarrinho();
    alert('Pedido realizado com sucesso!');
    carregarMeusPedidos();
    mostrarTab('meusPedidos');
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function carregarMeusPedidos() {
  const pedidos = await api('/api/meus-pedidos');
  const el = document.getElementById('meusPedidos');
  if (pedidos.length === 0) {
    el.innerHTML = '<p>Você ainda não fez nenhum pedido.</p>';
    return;
  }
  el.innerHTML = pedidos.map(p => `
    <div class="pedido-card">
      <div class="pedido-header">
        <strong>Pedido #${p.id}</strong>
        <span class="status ${p.status}">${p.status}</span>
        <span>${new Date(p.criado_em).toLocaleString('pt-BR')}</span>
      </div>
      <ul class="itens-lista">
        ${p.itens.map(it => `<li>${it.quantidade}x ${it.nome_prato} - R$ ${(it.preco * it.quantidade).toFixed(2)}</li>`).join('')}
      </ul>
      <div class="total">Total: R$ ${p.total.toFixed(2)}</div>
    </div>
  `).join('');
}

// GERENTE
async function carregarPratosGerente() {
  const pratos = await api('/api/pratos');
  pratosCache = pratos;
  const el = document.getElementById('listaPratosG');
  el.innerHTML = pratos.map(p => `
    <div class="prato-card">
      <span class="categoria">${p.categoria}</span>
      <h4>${p.nome}</h4>
      <p class="descricao">${p.descricao || ''}</p>
      <p class="preco">R$ ${p.preco.toFixed(2)}</p>
      ${p.disponivel ? '' : '<p class="indisponivel">Indisponível</p>'}
      <div class="gerente-acoes">
        <button class="small" onclick='editarPrato(${JSON.stringify(p).replace(/'/g, "&apos;")})'>Editar</button>
        <button class="danger" onclick="removerPrato(${p.id})">Remover</button>
      </div>
    </div>
  `).join('');
}

function editarPrato(p) {
  document.getElementById('formTitulo').textContent = 'Editar Prato';
  document.getElementById('pratoId').value = p.id;
  document.getElementById('pratoNome').value = p.nome;
  document.getElementById('pratoDescricao').value = p.descricao || '';
  document.getElementById('pratoPreco').value = p.preco;
  document.getElementById('pratoCategoria').value = p.categoria;
  document.getElementById('pratoDisponivel').checked = !!p.disponivel;
  window.scrollTo(0, 0);
}

function limparFormPrato() {
  document.getElementById('formTitulo').textContent = 'Adicionar Prato';
  document.getElementById('pratoId').value = '';
  document.getElementById('pratoNome').value = '';
  document.getElementById('pratoDescricao').value = '';
  document.getElementById('pratoPreco').value = '';
  document.getElementById('pratoCategoria').value = 'Principal';
  document.getElementById('pratoDisponivel').checked = true;
}

async function salvarPrato() {
  const id = document.getElementById('pratoId').value;
  const body = {
    nome: document.getElementById('pratoNome').value,
    descricao: document.getElementById('pratoDescricao').value,
    preco: parseFloat(document.getElementById('pratoPreco').value),
    categoria: document.getElementById('pratoCategoria').value,
    disponivel: document.getElementById('pratoDisponivel').checked
  };
  if (!body.nome || isNaN(body.preco)) return alert('Preencha nome e preço');
  try {
    if (id) {
      await api('/api/pratos/' + id, { method: 'PUT', body });
    } else {
      await api('/api/pratos', { method: 'POST', body });
    }
    limparFormPrato();
    carregarPratosGerente();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function removerPrato(id) {
  if (!confirm('Remover este prato?')) return;
  await api('/api/pratos/' + id, { method: 'DELETE' });
  carregarPratosGerente();
}

async function carregarTodosPedidos() {
  const pedidos = await api('/api/pedidos');
  const el = document.getElementById('todosPedidos');
  if (pedidos.length === 0) {
    el.innerHTML = '<p>Nenhum pedido ainda.</p>';
    return;
  }
  el.innerHTML = pedidos.map(p => `
    <div class="pedido-card">
      <div class="pedido-header">
        <strong>Pedido #${p.id}</strong>
        <span class="status ${p.status}">${p.status}</span>
        <span>${p.cliente_nome} (${p.cliente_email})</span>
        <span>${new Date(p.criado_em).toLocaleString('pt-BR')}</span>
      </div>
      <ul class="itens-lista">
        ${p.itens.map(it => `<li>${it.quantidade}x ${it.nome_prato} - R$ ${(it.preco * it.quantidade).toFixed(2)}</li>`).join('')}
      </ul>
      <div class="total">Total: R$ ${p.total.toFixed(2)}</div>
      <div class="gerente-acoes">
        <label>Status:</label>
        <select onchange="mudarStatus(${p.id}, this.value)">
          ${['Pendente','Preparando','Pronto','Entregue','Cancelado'].map(s =>
            `<option value="${s}" ${s === p.status ? 'selected' : ''}>${s}</option>`
          ).join('')}
        </select>
      </div>
    </div>
  `).join('');
}

async function mudarStatus(id, status) {
  try {
    await api('/api/pedidos/' + id + '/status', { method: 'PUT', body: { status } });
    carregarTodosPedidos();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

// INICIALIZAÇÃO
renderizarCarrinho();
carregarUsuario();

// Enter para login
document.getElementById('loginSenha').addEventListener('keypress', e => {
  if (e.key === 'Enter') login();
});
