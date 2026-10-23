// Estado da aplicação
let estado = {
  usuario: null,
  carrinho: [],
  produtos: [],
  categorias: [],
  categoriaAtual: 'todas'
};

// Carregar carrinho do localStorage
function carregarCarrinho() {
  const carrinhoSalvo = localStorage.getItem('carrinho');
  if (carrinhoSalvo) {
    estado.carrinho = JSON.parse(carrinhoSalvo);
  }
}

// Salvar carrinho no localStorage
function salvarCarrinho() {
  localStorage.setItem('carrinho', JSON.stringify(estado.carrinho));
  atualizarBadgeCarrinho();
}

// Atualizar badge do carrinho
function atualizarBadgeCarrinho() {
  const totalItens = estado.carrinho.reduce((total, item) => total + item.quantidade, 0);
  const badge = document.querySelector('.carrinho-badge .badge');
  if (badge) {
    badge.textContent = totalItens;
    badge.style.display = totalItens > 0 ? 'flex' : 'none';
  }
}

// API helpers
async function api(url, options = {}) {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.erro || 'Erro na requisição');
    }
    return data;
  } catch (erro) {
    mostrarNotificacao(erro.message, 'error');
    throw erro;
  }
}

// Notificações
function mostrarNotificacao(mensagem, tipo = 'info') {
  const notificacao = document.getElementById('notificacao');
  notificacao.textContent = mensagem;
  notificacao.className = `notificacao show ${tipo}`;
  setTimeout(() => {
    notificacao.className = 'notificacao';
  }, 3000);
}

// Modal
function abrirModal(conteudo) {
  const modal = document.getElementById('modal');
  const modalBody = document.getElementById('modalBody');
  modalBody.innerHTML = conteudo;
  modal.classList.add('show');
}

function fecharModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('show');
}

// Navegação
function navegar(rota) {
  history.pushState({}, '', rota);
  renderizar();
}

// Verificar autenticação
async function verificarAutenticacao() {
  try {
    const data = await api('/api/usuario');
    estado.usuario = data.usuario;
  } catch (erro) {
    estado.usuario = null;
  }
}

// Renderizar menu
function renderizarMenu() {
  const nav = document.getElementById('navMenu');
  
  if (!estado.usuario) {
    nav.innerHTML = `
      <a href="/" onclick="event.preventDefault(); navegar('/')">Produtos</a>
      <a href="/login" onclick="event.preventDefault(); navegar('/login')">Entrar</a>
      <a href="/cadastro" onclick="event.preventDefault(); navegar('/cadastro')">Cadastrar</a>
    `;
  } else if (estado.usuario.tipo === 'admin') {
    nav.innerHTML = `
      <a href="/" onclick="event.preventDefault(); navegar('/')">Produtos</a>
      <a href="/admin" onclick="event.preventDefault(); navegar('/admin')">Admin</a>
      <a href="/admin/pedidos" onclick="event.preventDefault(); navegar('/admin/pedidos')">Pedidos</a>
      <button class="link-button" onclick="logout()">Sair (${estado.usuario.nome})</button>
    `;
  } else {
    nav.innerHTML = `
      <a href="/" onclick="event.preventDefault(); navegar('/')">Produtos</a>
      <a href="/pedidos" onclick="event.preventDefault(); navegar('/pedidos')">Meus Pedidos</a>
      <a href="/carrinho" onclick="event.preventDefault(); navegar('/carrinho')" class="carrinho-badge">
        🛒 Carrinho
        <span class="badge" style="display: none;">0</span>
      </a>
      <button class="link-button" onclick="logout()">Sair (${estado.usuario.nome})</button>
    `;
  }
  
  atualizarBadgeCarrinho();
}

// Logout
async function logout() {
  try {
    await api('/api/logout', { method: 'POST' });
    estado.usuario = null;
    estado.carrinho = [];
    localStorage.removeItem('carrinho');
    navegar('/');
    mostrarNotificacao('Logout realizado com sucesso', 'success');
  } catch (erro) {
    // Já tratado
  }
}

// Páginas
async function paginaLogin() {
  return `
    <div class="auth-container">
      <div class="auth-card">
        <h2>Entrar</h2>
        <form onsubmit="event.preventDefault(); fazerLogin()">
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" class="form-control" required>
          </div>
          <div class="form-group">
            <label>Senha</label>
            <input type="password" id="senha" class="form-control" required>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Entrar</button>
          <div class="form-footer">
            <p>Não tem conta? <a href="/cadastro" onclick="event.preventDefault(); navegar('/cadastro')">Cadastre-se</a></p>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function fazerLogin() {
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;

  try {
    const data = await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ email, senha })
    });
    
    estado.usuario = data.usuario;
    mostrarNotificacao('Login realizado com sucesso!', 'success');
    navegar('/');
  } catch (erro) {
    // Já tratado
  }
}

async function paginaCadastro() {
  return `
    <div class="auth-container">
      <div class="auth-card">
        <h2>Cadastrar</h2>
        <form onsubmit="event.preventDefault(); fazerCadastro()">
          <div class="form-group">
            <label>Nome</label>
            <input type="text" id="nome" class="form-control" required>
          </div>
          <div class="form-group">
            <label>Email</label>
            <input type="email" id="email" class="form-control" required>
          </div>
          <div class="form-group">
            <label>Senha</label>
            <input type="password" id="senha" class="form-control" required>
          </div>
          <button type="submit" class="btn btn-primary btn-block">Cadastrar</button>
          <div class="form-footer">
            <p>Já tem conta? <a href="/login" onclick="event.preventDefault(); navegar('/login')">Entre aqui</a></p>
          </div>
        </form>
      </div>
    </div>
  `;
}

async function fazerCadastro() {
  const nome = document.getElementById('nome').value;
  const email = document.getElementById('email').value;
  const senha = document.getElementById('senha').value;

  try {
    const data = await api('/api/cadastro', {
      method: 'POST',
      body: JSON.stringify({ nome, email, senha })
    });
    
    estado.usuario = data.usuario;
    mostrarNotificacao('Cadastro realizado com sucesso!', 'success');
    navegar('/');
  } catch (erro) {
    // Já tratado
  }
}

async function paginaProdutos() {
  try {
    const [dataProdutos, dataCategorias] = await Promise.all([
      api(`/api/produtos?categoria=${estado.categoriaAtual}`),
      api('/api/categorias')
    ]);
    
    estado.produtos = dataProdutos.produtos;
    estado.categorias = dataCategorias.categorias;

    const opcoesCategorias = ['todas', ...estado.categorias].map(cat => 
      `<option value="${cat}" ${cat === estado.categoriaAtual ? 'selected' : ''}>${cat === 'todas' ? 'Todas as Categorias' : cat}</option>`
    ).join('');

    const produtosHtml = estado.produtos.map(produto => `
      <div class="card product-card" onclick="navegar('/produto/${produto.id}')">
        <img src="${produto.imagem || 'https://via.placeholder.com/300x300/CCCCCC/FFFFFF?text=Sem+Imagem'}" alt="${produto.nome}" class="product-image">
        <div class="card-body">
          <span class="product-category">${produto.categoria}</span>
          <h3 class="card-title">${produto.nome}</h3>
          <p class="card-text">${produto.descricao}</p>
          <p class="product-price">R$ ${produto.preco.toFixed(2)}</p>
          <p class="product-stock">Estoque: ${produto.estoque} unidades</p>
          ${estado.usuario && estado.usuario.tipo !== 'admin' ? `
            <button class="btn btn-primary btn-block" onclick="event.stopPropagation(); adicionarAoCarrinho(${produto.id})">
              Adicionar ao Carrinho
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');

    return `
      <div class="products-header">
        <h2>Nossos Produtos</h2>
        <div class="filter-group">
          <select class="form-control" onchange="filtrarPorCategoria(this.value)">
            ${opcoesCategorias}
          </select>
        </div>
      </div>
      <div class="products-grid">
        ${produtosHtml || '<div class="empty-state"><h3>Nenhum produto encontrado</h3></div>'}
      </div>
    `;
  } catch (erro) {
    return '<div class="error-message">Erro ao carregar produtos</div>';
  }
}

function filtrarPorCategoria(categoria) {
  estado.categoriaAtual = categoria;
  renderizar();
}

function adicionarAoCarrinho(produtoId) {
  const produto = estado.produtos.find(p => p.id === produtoId);
  if (!produto) return;

  const itemCarrinho = estado.carrinho.find(item => item.produtoId === produtoId);
  
  if (itemCarrinho) {
    if (itemCarrinho.quantidade < produto.estoque) {
      itemCarrinho.quantidade++;
      mostrarNotificacao('Quantidade atualizada no carrinho', 'success');
    } else {
      mostrarNotificacao('Estoque insuficiente', 'error');
      return;
    }
  } else {
    estado.carrinho.push({
      produtoId: produto.id,
      nome: produto.nome,
      preco: produto.preco,
      imagem: produto.imagem,
      quantidade: 1,
      estoque: produto.estoque
    });
    mostrarNotificacao('Produto adicionado ao carrinho', 'success');
  }
  
  salvarCarrinho();
}

async function paginaProdutoDetalhe(id) {
  try {
    const data = await api(`/api/produtos/${id}`);
    const produto = data.produto;

    return `
      <button class="btn btn-secondary" onclick="navegar('/')">← Voltar</button>
      <div class="product-detail">
        <img src="${produto.imagem || 'https://via.placeholder.com/600x600/CCCCCC/FFFFFF?text=Sem+Imagem'}" alt="${produto.nome}" class="product-detail-image">
        <div class="product-detail-info">
          <span class="product-category">${produto.categoria}</span>
          <h1>${produto.nome}</h1>
          <p class="product-price">R$ ${produto.preco.toFixed(2)}</p>
          <p class="product-description">${produto.descricao}</p>
          <p class="product-stock">Estoque disponível: ${produto.estoque} unidades</p>
          ${estado.usuario && estado.usuario.tipo !== 'admin' && produto.estoque > 0 ? `
            <div class="quantity-selector">
              <button onclick="alterarQuantidade(-1)">-</button>
              <input type="number" id="quantidade" value="1" min="1" max="${produto.estoque}" class="form-control">
              <button onclick="alterarQuantidade(1)">+</button>
            </div>
            <button class="btn btn-primary btn-block" onclick="adicionarAoCarrinhoComQuantidade(${produto.id})">
              Adicionar ao Carrinho
            </button>
          ` : produto.estoque === 0 ? '<p style="color: var(--danger); font-weight: bold;">Produto indisponível</p>' : ''}
        </div>
      </div>
    `;
  } catch (erro) {
    return '<div class="error-message">Produto não encontrado</div>';
  }
}

function alterarQuantidade(delta) {
  const input = document.getElementById('quantidade');
  const novoValor = parseInt(input.value) + delta;
  if (novoValor >= parseInt(input.min) && novoValor <= parseInt(input.max)) {
    input.value = novoValor;
  }
}

function adicionarAoCarrinhoComQuantidade(produtoId) {
  const quantidade = parseInt(document.getElementById('quantidade').value);
  const produto = estado.produtos.find(p => p.id === produtoId);
  
  if (!produto) {
    api(`/api/produtos/${produtoId}`).then(data => {
      const prod = data.produto;
      const itemCarrinho = estado.carrinho.find(item => item.produtoId === produtoId);
      
      if (itemCarrinho) {
        const novaQuantidade = itemCarrinho.quantidade + quantidade;
        if (novaQuantidade <= prod.estoque) {
          itemCarrinho.quantidade = novaQuantidade;
          mostrarNotificacao('Carrinho atualizado', 'success');
        } else {
          mostrarNotificacao('Estoque insuficiente', 'error');
          return;
        }
      } else {
        estado.carrinho.push({
          produtoId: prod.id,
          nome: prod.nome,
          preco: prod.preco,
          imagem: prod.imagem,
          quantidade: quantidade,
          estoque: prod.estoque
        });
        mostrarNotificacao(`${quantidade} ${quantidade > 1 ? 'itens adicionados' : 'item adicionado'} ao carrinho`, 'success');
      }
      
      salvarCarrinho();
    });
  }
}

async function paginaCarrinho() {
  if (!estado.usuario || estado.usuario.tipo === 'admin') {
    navegar('/');
    return '';
  }

  if (estado.carrinho.length === 0) {
    return `
      <div class="cart-empty">
        <h2>Seu carrinho está vazio</h2>
        <button class="btn btn-primary" onclick="navegar('/')">Continuar Comprando</button>
      </div>
    `;
  }

  const total = estado.carrinho.reduce((sum, item) => sum + (item.preco * item.quantidade), 0);

  const itensHtml = estado.carrinho.map((item, index) => `
    <div class="cart-item">
      <img src="${item.imagem || 'https://via.placeholder.com/100x100/CCCCCC/FFFFFF?text=Sem+Imagem'}" alt="${item.nome}" class="cart-item-image">
      <div class="cart-item-info">
        <h3>${item.nome}</h3>
        <p class="cart-item-price">R$ ${item.preco.toFixed(2)}</p>
        <div class="quantity-selector">
          <button onclick="alterarQuantidadeCarrinho(${index}, -1)">-</button>
          <input type="number" value="${item.quantidade}" min="1" max="${item.estoque}" class="form-control" readonly>
          <button onclick="alterarQuantidadeCarrinho(${index}, 1)">+</button>
        </div>
      </div>
      <div class="cart-item-actions">
        <p class="cart-item-price">R$ ${(item.preco * item.quantidade).toFixed(2)}</p>
        <button class="btn btn-danger btn-small" onclick="removerDoCarrinho(${index})">Remover</button>
      </div>
    </div>
  `).join('');

  return `
    <h2>Meu Carrinho</h2>
    <div style="display: grid; grid-template-columns: 1fr 350px; gap: 2rem; margin-top: 2rem;">
      <div class="cart-items">
        ${itensHtml}
      </div>
      <div class="cart-summary">
        <h3>Resumo do Pedido</h3>
        <div class="cart-summary-item">
          <span>Subtotal:</span>
          <span>R$ ${total.toFixed(2)}</span>
        </div>
        <div class="cart-summary-total">
          <div class="cart-summary-item">
            <span>Total:</span>
            <span>R$ ${total.toFixed(2)}</span>
          </div>
        </div>
        <button class="btn btn-success btn-block" onclick="finalizarPedido()">Finalizar Pedido</button>
        <button class="btn btn-secondary btn-block" onclick="navegar('/')">Continuar Comprando</button>
      </div>
    </div>
  `;
}

function alterarQuantidadeCarrinho(index, delta) {
  const item = estado.carrinho[index];
  const novaQuantidade = item.quantidade + delta;
  
  if (novaQuantidade <= 0) {
    removerDoCarrinho(index);
  } else if (novaQuantidade <= item.estoque) {
    item.quantidade = novaQuantidade;
    salvarCarrinho();
    renderizar();
  } else {
    mostrarNotificacao('Estoque insuficiente', 'error');
  }
}

function removerDoCarrinho(index) {
  estado.carrinho.splice(index, 1);
  salvarCarrinho();
  renderizar();
  mostrarNotificacao('Item removido do carrinho', 'info');
}

async function finalizarPedido() {
  if (estado.carrinho.length === 0) {
    mostrarNotificacao('Carrinho vazio', 'error');
    return;
  }

  try {
    const itens = estado.carrinho.map(item => ({
      produtoId: item.produtoId,
      quantidade: item.quantidade
    }));

    const data = await api('/api/pedidos', {
      method: 'POST',
      body: JSON.stringify({ itens })
    });

    estado.carrinho = [];
    localStorage.removeItem('carrinho');
    mostrarNotificacao('Pedido realizado com sucesso!', 'success');
    navegar('/pedidos');
  } catch (erro) {
    // Já tratado
  }
}

async function paginaPedidos() {
  if (!estado.usuario || estado.usuario.tipo === 'admin') {
    navegar('/');
    return '';
  }

  try {
    const data = await api('/api/pedidos');
    const pedidos = data.pedidos;

    if (pedidos.length === 0) {
      return `
        <div class="empty-state">
          <h3>Você ainda não fez nenhum pedido</h3>
          <button class="btn btn-primary" onclick="navegar('/')">Começar a Comprar</button>
        </div>
      `;
    }

    const pedidosHtml = pedidos.map(pedido => {
      const itensHtml = pedido.itens.map(item => `
        <div class="order-item">
          <img src="${item.produto_imagem || 'https://via.placeholder.com/80x80/CCCCCC/FFFFFF?text=Sem+Imagem'}" alt="${item.produto_nome}" class="order-item-image">
          <div>
            <div class="order-item-name">${item.produto_nome}</div>
            <div class="order-item-quantity">Quantidade: ${item.quantidade}</div>
          </div>
          <div class="order-item-price">R$ ${(item.preco_unitario * item.quantidade).toFixed(2)}</div>
        </div>
      `).join('');

      return `
        <div class="order-card">
          <div class="order-header">
            <div>
              <div class="order-id">Pedido #${pedido.id}</div>
              <div class="order-date">${new Date(pedido.criado_em).toLocaleString('pt-BR')}</div>
            </div>
            <span class="order-status ${pedido.status}">${pedido.status}</span>
          </div>
          <div class="order-items">
            ${itensHtml}
          </div>
          <div class="order-footer">
            <div class="order-total">Total: R$ ${pedido.total.toFixed(2)}</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <h2>Meus Pedidos</h2>
      <div class="orders-list">
        ${pedidosHtml}
      </div>
    `;
  } catch (erro) {
    return '<div class="error-message">Erro ao carregar pedidos</div>';
  }
}

async function paginaAdmin() {
  if (!estado.usuario || estado.usuario.tipo !== 'admin') {
    navegar('/');
    return '';
  }

  try {
    const data = await api('/api/produtos');
    const produtos = data.produtos;

    const totalProdutos = produtos.length;
    const valorEstoque = produtos.reduce((sum, p) => sum + (p.preco * p.estoque), 0);

    const produtosHtml = produtos.map(produto => `
      <tr>
        <td><img src="${produto.imagem || 'https://via.placeholder.com/60x60/CCCCCC/FFFFFF?text=Sem+Imagem'}" alt="${produto.nome}"></td>
        <td>${produto.nome}</td>
        <td>${produto.categoria}</td>
        <td>R$ ${produto.preco.toFixed(2)}</td>
        <td>${produto.estoque}</td>
        <td class="actions">
          <button class="btn btn-primary btn-small" onclick="editarProduto(${produto.id})">Editar</button>
          <button class="btn btn-danger btn-small" onclick="confirmarExcluirProduto(${produto.id})">Excluir</button>
        </td>
      </tr>
    `).join('');

    return `
      <div class="admin-header">
        <h2>Gerenciar Produtos</h2>
        <button class="btn btn-success" onclick="novoProduto()">+ Novo Produto</button>
      </div>
      
      <div class="admin-stats">
        <div class="stat-card">
          <h3>Total de Produtos</h3>
          <div class="stat-value">${totalProdutos}</div>
        </div>
        <div class="stat-card" style="background: linear-gradient(135deg, var(--secondary), #45B369);">
          <h3>Valor em Estoque</h3>
          <div class="stat-value">R$ ${valorEstoque.toFixed(2)}</div>
        </div>
      </div>

      <div class="admin-table">
        <table>
          <thead>
            <tr>
              <th>Imagem</th>
              <th>Nome</th>
              <th>Categoria</th>
              <th>Preço</th>
              <th>Estoque</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${produtosHtml || '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Nenhum produto cadastrado</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  } catch (erro) {
    return '<div class="error-message">Erro ao carregar produtos</div>';
  }
}

function novoProduto() {
  abrirModal(`
    <h2>Novo Produto</h2>
    <form onsubmit="event.preventDefault(); salvarProduto()">
      <div class="form-group">
        <label>Nome</label>
        <input type="text" id="produtoNome" class="form-control" required>
      </div>
      <div class="form-group">
        <label>Descrição</label>
        <textarea id="produtoDescricao" class="form-control"></textarea>
      </div>
      <div class="form-group">
        <label>Preço</label>
        <input type="number" id="produtoPreco" class="form-control" step="0.01" required>
      </div>
      <div class="form-group">
        <label>Categoria</label>
        <input type="text" id="produtoCategoria" class="form-control" required>
      </div>
      <div class="form-group">
        <label>URL da Imagem</label>
        <input type="text" id="produtoImagem" class="form-control">
      </div>
      <div class="form-group">
        <label>Estoque</label>
        <input type="number" id="produtoEstoque" class="form-control" value="0" required>
      </div>
      <button type="submit" class="btn btn-success btn-block">Salvar</button>
    </form>
  `);
}

function editarProduto(id) {
  api(`/api/produtos/${id}`).then(data => {
    const produto = data.produto;
    abrirModal(`
      <h2>Editar Produto</h2>
      <form onsubmit="event.preventDefault(); salvarProduto(${id})">
        <div class="form-group">
          <label>Nome</label>
          <input type="text" id="produtoNome" class="form-control" value="${produto.nome}" required>
        </div>
        <div class="form-group">
          <label>Descrição</label>
          <textarea id="produtoDescricao" class="form-control">${produto.descricao || ''}</textarea>
        </div>
        <div class="form-group">
          <label>Preço</label>
          <input type="number" id="produtoPreco" class="form-control" step="0.01" value="${produto.preco}" required>
        </div>
        <div class="form-group">
          <label>Categoria</label>
          <input type="text" id="produtoCategoria" class="form-control" value="${produto.categoria}" required>
        </div>
        <div class="form-group">
          <label>URL da Imagem</label>
          <input type="text" id="produtoImagem" class="form-control" value="${produto.imagem || ''}">
        </div>
        <div class="form-group">
          <label>Estoque</label>
          <input type="number" id="produtoEstoque" class="form-control" value="${produto.estoque}" required>
        </div>
        <button type="submit" class="btn btn-success btn-block">Salvar</button>
      </form>
    `);
  });
}

async function salvarProduto(id = null) {
  const nome = document.getElementById('produtoNome').value;
  const descricao = document.getElementById('produtoDescricao').value;
  const preco = parseFloat(document.getElementById('produtoPreco').value);
  const categoria = document.getElementById('produtoCategoria').value;
  const imagem = document.getElementById('produtoImagem').value;
  const estoque = parseInt(document.getElementById('produtoEstoque').value);

  try {
    if (id) {
      await api(`/api/admin/produtos/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ nome, descricao, preco, categoria, imagem, estoque })
      });
      mostrarNotificacao('Produto atualizado com sucesso', 'success');
    } else {
      await api('/api/admin/produtos', {
        method: 'POST',
        body: JSON.stringify({ nome, descricao, preco, categoria, imagem, estoque })
      });
      mostrarNotificacao('Produto criado com sucesso', 'success');
    }
    fecharModal();
    renderizar();
  } catch (erro) {
    // Já tratado
  }
}

function confirmarExcluirProduto(id) {
  abrirModal(`
    <h2>Confirmar Exclusão</h2>
    <p>Tem certeza que deseja excluir este produto?</p>
    <div style="display: flex; gap: 1rem; margin-top: 2rem;">
      <button class="btn btn-danger" onclick="excluirProduto(${id})">Sim, Excluir</button>
      <button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button>
    </div>
  `);
}

async function excluirProduto(id) {
  try {
    await api(`/api/admin/produtos/${id}`, { method: 'DELETE' });
    mostrarNotificacao('Produto excluído com sucesso', 'success');
    fecharModal();
    renderizar();
  } catch (erro) {
    // Já tratado
  }
}

async function paginaAdminPedidos() {
  if (!estado.usuario || estado.usuario.tipo !== 'admin') {
    navegar('/');
    return '';
  }

  try {
    const data = await api('/api/admin/pedidos');
    const pedidos = data.pedidos;

    if (pedidos.length === 0) {
      return `
        <h2>Gerenciar Pedidos</h2>
        <div class="empty-state">
          <h3>Nenhum pedido registrado</h3>
        </div>
      `;
    }

    const totalPedidos = pedidos.length;
    const pedidosPendentes = pedidos.filter(p => p.status === 'pendente').length;
    const valorTotal = pedidos.reduce((sum, p) => sum + p.total, 0);

    const pedidosHtml = pedidos.map(pedido => {
      const itensHtml = pedido.itens.map(item => `
        <div class="order-item">
          <img src="${item.produto_imagem || 'https://via.placeholder.com/80x80/CCCCCC/FFFFFF?text=Sem+Imagem'}" alt="${item.produto_nome}" class="order-item-image">
          <div>
            <div class="order-item-name">${item.produto_nome}</div>
            <div class="order-item-quantity">Quantidade: ${item.quantidade}</div>
          </div>
          <div class="order-item-price">R$ ${(item.preco_unitario * item.quantidade).toFixed(2)}</div>
        </div>
      `).join('');

      return `
        <div class="order-card">
          <div class="order-header">
            <div>
              <div class="order-id">Pedido #${pedido.id}</div>
              <div class="order-date">${new Date(pedido.criado_em).toLocaleString('pt-BR')}</div>
            </div>
            <span class="order-status ${pedido.status}">${pedido.status}</span>
          </div>
          <div class="order-user-info">
            <strong>Cliente:</strong> ${pedido.usuario_nome} (${pedido.usuario_email})
          </div>
          <div class="order-items">
            ${itensHtml}
          </div>
          <div class="order-footer">
            <div class="order-total">Total: R$ ${pedido.total.toFixed(2)}</div>
            <select class="form-control" style="width: 200px;" onchange="alterarStatusPedido(${pedido.id}, this.value)">
              <option value="pendente" ${pedido.status === 'pendente' ? 'selected' : ''}>Pendente</option>
              <option value="processando" ${pedido.status === 'processando' ? 'selected' : ''}>Processando</option>
              <option value="enviado" ${pedido.status === 'enviado' ? 'selected' : ''}>Enviado</option>
              <option value="entregue" ${pedido.status === 'entregue' ? 'selected' : ''}>Entregue</option>
              <option value="cancelado" ${pedido.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
            </select>
          </div>
        </div>
      `;
    }).join('');

    return `
      <h2>Gerenciar Pedidos</h2>
      
      <div class="admin-stats">
        <div class="stat-card">
          <h3>Total de Pedidos</h3>
          <div class="stat-value">${totalPedidos}</div>
        </div>
        <div class="stat-card" style="background: linear-gradient(135deg, var(--warning), #E67E22);">
          <h3>Pedidos Pendentes</h3>
          <div class="stat-value">${pedidosPendentes}</div>
        </div>
        <div class="stat-card" style="background: linear-gradient(135deg, var(--secondary), #45B369);">
          <h3>Valor Total</h3>
          <div class="stat-value">R$ ${valorTotal.toFixed(2)}</div>
        </div>
      </div>

      <div class="orders-list">
        ${pedidosHtml}
      </div>
    `;
  } catch (erro) {
    return '<div class="error-message">Erro ao carregar pedidos</div>';
  }
}

async function alterarStatusPedido(id, status) {
  try {
    await api(`/api/admin/pedidos/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    mostrarNotificacao('Status do pedido atualizado', 'success');
  } catch (erro) {
    renderizar();
  }
}

// Renderização principal
async function renderizar() {
  const conteudo = document.getElementById('conteudo');
  const caminho = window.location.pathname;

  renderizarMenu();

  conteudo.innerHTML = '<div class="loading">Carregando...</div>';

  let html = '';

  if (caminho === '/login') {
    if (estado.usuario) {
      navegar('/');
      return;
    }
    html = await paginaLogin();
  } else if (caminho === '/cadastro') {
    if (estado.usuario) {
      navegar('/');
      return;
    }
    html = await paginaCadastro();
  } else if (caminho === '/carrinho') {
    html = await paginaCarrinho();
  } else if (caminho === '/pedidos') {
    html = await paginaPedidos();
  } else if (caminho === '/admin') {
    html = await paginaAdmin();
  } else if (caminho === '/admin/pedidos') {
    html = await paginaAdminPedidos();
  } else if (caminho.startsWith('/produto/')) {
    const id = caminho.split('/')[2];
    html = await paginaProdutoDetalhe(id);
  } else {
    html = await paginaProdutos();
  }

  conteudo.innerHTML = html;
}

// Event listeners
window.addEventListener('popstate', renderizar);

document.addEventListener('DOMContentLoaded', async () => {
  carregarCarrinho();
  await verificarAutenticacao();
  renderizar();

  // Modal close
  const modalClose = document.querySelector('.modal-close');
  const modal = document.getElementById('modal');
  
  modalClose.addEventListener('click', fecharModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      fecharModal();
    }
  });
});
