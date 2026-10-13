let usuarioAtual = null;
let carrinho = [];

// Inicialização
window.onload = () => {
  verificarLogin();
  carregarCategorias();
  carregarProdutos();
  carregarCarrinhoLocal();
};

// ========== AUTENTICAÇÃO ==========

async function verificarLogin() {
  try {
    const res = await fetch('/api/usuario-atual');
    const data = await res.json();
    
    if (data.usuario) {
      usuarioAtual = data.usuario;
      document.getElementById('menu-visitante').style.display = 'none';
      document.getElementById('menu-usuario').style.display = 'flex';
      document.getElementById('nome-usuario').textContent = `Olá, ${data.usuario.nome}`;
      
      if (data.usuario.tipo === 'admin') {
        document.getElementById('btn-admin').style.display = 'inline-block';
      }
    }
  } catch (erro) {
    console.error('Erro ao verificar login:', erro);
  }
}

async function fazerLogin(event) {
  event.preventDefault();
  
  const dados = {
    email: document.getElementById('login-email').value,
    senha: document.getElementById('login-senha').value
  };

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    const resultado = await res.json();

    if (resultado.sucesso) {
      mostrarMensagem('Login realizado com sucesso!', 'sucesso');
      usuarioAtual = resultado.usuario;
      setTimeout(() => {
        location.reload();
      }, 1000);
    } else {
      mostrarMensagem(resultado.erro, 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao fazer login', 'erro');
  }
}

async function fazerRegistro(event) {
  event.preventDefault();
  
  const dados = {
    nome: document.getElementById('reg-nome').value,
    email: document.getElementById('reg-email').value,
    senha: document.getElementById('reg-senha').value
  };

  try {
    const res = await fetch('/api/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    const resultado = await res.json();

    if (resultado.sucesso) {
      mostrarMensagem('Conta criada com sucesso! Faça login.', 'sucesso');
      mostrarLogin();
    } else {
      mostrarMensagem(resultado.erro, 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao criar conta', 'erro');
  }
}

async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    location.reload();
  } catch (erro) {
    mostrarMensagem('Erro ao sair', 'erro');
  }
}

// ========== PRODUTOS ==========

async function carregarCategorias() {
  try {
    const res = await fetch('/api/categorias');
    const categorias = await res.json();
    
    const select = document.getElementById('filtro-categoria');
    categorias.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      select.appendChild(option);
    });
  } catch (erro) {
    console.error('Erro ao carregar categorias:', erro);
  }
}

async function carregarProdutos() {
  const busca = document.getElementById('busca').value;
  const categoria = document.getElementById('filtro-categoria').value;
  
  let url = '/api/produtos?';
  if (busca) url += `busca=${encodeURIComponent(busca)}&`;
  if (categoria) url += `categoria=${encodeURIComponent(categoria)}`;

  try {
    const res = await fetch(url);
    const produtos = await res.json();
    
    const container = document.getElementById('lista-produtos');
    container.innerHTML = '';

    if (produtos.length === 0) {
      container.innerHTML = '<p>Nenhum produto encontrado.</p>';
      return;
    }

    produtos.forEach(produto => {
      const card = document.createElement('div');
      card.className = 'produto-card';
      
      const imagemUrl = produto.imagem || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ecf0f1" width="200" height="200"/%3E%3Ctext fill="%2395a5a6" font-family="sans-serif" font-size="20" dy="10.5" font-weight="bold" x="50%25" y="50%25" text-anchor="middle"%3ESem imagem%3C/text%3E%3C/svg%3E';
      
      card.innerHTML = `
        <img src="${imagemUrl}" alt="${produto.nome}" class="produto-imagem" onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22200%22 height=%22200%22%3E%3Crect fill=%22%23ecf0f1%22 width=%22200%22 height=%22200%22/%3E%3Ctext fill=%22%2395a5a6%22 font-family=%22sans-serif%22 font-size=%2220%22 dy=%2210.5%22 font-weight=%22bold%22 x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22%3ESem imagem%3C/text%3E%3C/svg%3E'">
        <div class="produto-info">
          ${produto.categoria ? `<span class="produto-categoria">${produto.categoria}</span>` : ''}
          <div class="produto-nome">${produto.nome}</div>
          <div class="produto-descricao">${produto.descricao || ''}</div>
          <div class="produto-preco">R$ ${produto.preco.toFixed(2)}</div>
          <div class="produto-estoque">${produto.estoque > 0 ? `${produto.estoque} em estoque` : 'Fora de estoque'}</div>
          <button class="btn-adicionar" onclick="adicionarAoCarrinho(${produto.id})" ${produto.estoque === 0 ? 'disabled' : ''}>
            ${produto.estoque === 0 ? 'Fora de Estoque' : 'Adicionar ao Carrinho'}
          </button>
        </div>
      `;
      
      container.appendChild(card);
    });
  } catch (erro) {
    console.error('Erro ao carregar produtos:', erro);
  }
}

// ========== CARRINHO ==========

function carregarCarrinhoLocal() {
  const carrinhoSalvo = localStorage.getItem('carrinho');
  if (carrinhoSalvo) {
    carrinho = JSON.parse(carrinhoSalvo);
    atualizarQuantidadeCarrinho();
  }
}

function salvarCarrinhoLocal() {
  localStorage.setItem('carrinho', JSON.stringify(carrinho));
  atualizarQuantidadeCarrinho();
}

function atualizarQuantidadeCarrinho() {
  const total = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
  document.getElementById('qtd-carrinho').textContent = total;
}

async function adicionarAoCarrinho(produtoId) {
  if (!usuarioAtual) {
    mostrarMensagem('Faça login para adicionar produtos ao carrinho', 'erro');
    mostrarLogin();
    return;
  }

  try {
    const res = await fetch(`/api/produtos/${produtoId}`);
    const produto = await res.json();

    const itemExistente = carrinho.find(item => item.produto_id === produtoId);
    
    if (itemExistente) {
      itemExistente.quantidade++;
    } else {
      carrinho.push({
        produto_id: produtoId,
        nome: produto.nome,
        preco: produto.preco,
        quantidade: 1
      });
    }

    salvarCarrinhoLocal();
    mostrarMensagem('Produto adicionado ao carrinho!', 'sucesso');
  } catch (erro) {
    mostrarMensagem('Erro ao adicionar produto', 'erro');
  }
}

function mostrarCarrinho() {
  esconderTodasTelas();
  document.getElementById('tela-carrinho').style.display = 'block';
  renderizarCarrinho();
}

function renderizarCarrinho() {
  const container = document.getElementById('itens-carrinho');
  const vazio = document.getElementById('carrinho-vazio');
  const comItens = document.getElementById('carrinho-com-itens');

  if (carrinho.length === 0) {
    container.innerHTML = '';
    vazio.style.display = 'block';
    comItens.style.display = 'none';
    return;
  }

  vazio.style.display = 'none';
  comItens.style.display = 'block';

  container.innerHTML = '';
  let total = 0;

  carrinho.forEach((item, index) => {
    total += item.preco * item.quantidade;

    const div = document.createElement('div');
    div.className = 'item-carrinho';
    div.innerHTML = `
      <div class="item-carrinho-info">
        <div class="item-carrinho-nome">${item.nome}</div>
        <div class="item-carrinho-preco">R$ ${item.preco.toFixed(2)}</div>
      </div>
      <div class="item-carrinho-acoes">
        <input type="number" min="1" value="${item.quantidade}" onchange="atualizarQuantidade(${index}, this.value)">
        <button class="btn-remover" onclick="removerDoCarrinho(${index})">Remover</button>
      </div>
    `;
    container.appendChild(div);
  });

  document.getElementById('total-carrinho').textContent = total.toFixed(2);
}

function atualizarQuantidade(index, novaQuantidade) {
  const qtd = parseInt(novaQuantidade);
  if (qtd > 0) {
    carrinho[index].quantidade = qtd;
    salvarCarrinhoLocal();
    renderizarCarrinho();
  }
}

function removerDoCarrinho(index) {
  carrinho.splice(index, 1);
  salvarCarrinhoLocal();
  renderizarCarrinho();
  mostrarMensagem('Produto removido do carrinho', 'sucesso');
}

async function finalizarPedido() {
  const endereco = document.getElementById('endereco').value;

  if (!endereco) {
    mostrarMensagem('Digite o endereço de entrega', 'erro');
    return;
  }

  const itens = carrinho.map(item => ({
    produto_id: item.produto_id,
    quantidade: item.quantidade
  }));

  try {
    const res = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itens, endereco })
    });

    const resultado = await res.json();

    if (resultado.sucesso) {
      mostrarMensagem('Pedido realizado com sucesso!', 'sucesso');
      carrinho = [];
      salvarCarrinhoLocal();
      document.getElementById('endereco').value = '';
      setTimeout(() => {
        mostrarMeusPedidos();
      }, 1500);
    } else {
      mostrarMensagem(resultado.erro, 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao finalizar pedido', 'erro');
  }
}

// ========== PEDIDOS ==========

async function mostrarMeusPedidos() {
  esconderTodasTelas();
  document.getElementById('tela-meus-pedidos').style.display = 'block';

  try {
    const res = await fetch('/api/meus-pedidos');
    const pedidos = await res.json();

    const container = document.getElementById('lista-meus-pedidos');
    container.innerHTML = '';

    if (pedidos.length === 0) {
      container.innerHTML = '<p>Você ainda não fez nenhum pedido.</p>';
      return;
    }

    pedidos.forEach(pedido => {
      const card = document.createElement('div');
      card.className = 'pedido-card';
      card.onclick = () => verDetalhesPedido(pedido.id);
      
      const data = new Date(pedido.criado_em).toLocaleDateString('pt-BR');
      
      card.innerHTML = `
        <div class="pedido-header">
          <div class="pedido-numero">Pedido #${pedido.id}</div>
          <span class="pedido-status status-${pedido.status}">${pedido.status}</span>
        </div>
        <div class="pedido-info">Data: ${data}</div>
        <div class="pedido-total">Total: R$ ${pedido.total.toFixed(2)}</div>
      `;
      
      container.appendChild(card);
    });
  } catch (erro) {
    mostrarMensagem('Erro ao carregar pedidos', 'erro');
  }
}

async function verDetalhesPedido(pedidoId) {
  try {
    const res = await fetch(`/api/pedidos/${pedidoId}`);
    const pedido = await res.json();

    esconderTodasTelas();
    document.getElementById('tela-detalhes-pedido').style.display = 'block';

    const container = document.getElementById('detalhes-pedido');
    const data = new Date(pedido.criado_em).toLocaleDateString('pt-BR');

    let itensHtml = '';
    pedido.itens.forEach(item => {
      itensHtml += `
        <div class="item-pedido">
          <div>
            <strong>${item.nome}</strong><br>
            Quantidade: ${item.quantidade}
          </div>
          <div>R$ ${(item.preco * item.quantidade).toFixed(2)}</div>
        </div>
      `;
    });

    container.innerHTML = `
      <div class="detalhes-pedido">
        <h2>Pedido #${pedido.id}</h2>
        <p><strong>Data:</strong> ${data}</p>
        <p><strong>Status:</strong> <span class="pedido-status status-${pedido.status}">${pedido.status}</span></p>
        <p><strong>Endereço:</strong> ${pedido.endereco}</p>
        <h3 style="margin-top: 20px;">Itens do Pedido</h3>
        ${itensHtml}
        <div class="pedido-total" style="margin-top: 20px; text-align: right;">
          Total: R$ ${pedido.total.toFixed(2)}
        </div>
      </div>
    `;
  } catch (erro) {
    mostrarMensagem('Erro ao carregar detalhes', 'erro');
  }
}

function voltarParaPedidos() {
  if (usuarioAtual.tipo === 'admin') {
    mostrarAdmin();
    mostrarAbaAdmin('pedidos');
  } else {
    mostrarMeusPedidos();
  }
}

// ========== ADMIN ==========

function mostrarAdmin() {
  esconderTodasTelas();
  document.getElementById('tela-admin').style.display = 'block';
  carregarAdminProdutos();
}

function mostrarAbaAdmin(aba) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');

  document.querySelectorAll('.admin-aba').forEach(a => a.style.display = 'none');
  document.getElementById(`admin-${aba}`).style.display = 'block';

  if (aba === 'produtos') {
    carregarAdminProdutos();
  } else {
    carregarAdminPedidos();
  }
}

async function carregarAdminProdutos() {
  try {
    const res = await fetch('/api/produtos');
    const produtos = await res.json();

    const container = document.getElementById('lista-admin-produtos');
    container.innerHTML = '';

    produtos.forEach(produto => {
      const card = document.createElement('div');
      card.className = 'admin-produto-card';
      
      card.innerHTML = `
        <div class="admin-produto-info">
          <strong>${produto.nome}</strong><br>
          R$ ${produto.preco.toFixed(2)} | Estoque: ${produto.estoque} | ${produto.categoria || 'Sem categoria'}
        </div>
        <div class="admin-produto-acoes">
          <button class="btn-editar" onclick='editarProduto(${JSON.stringify(produto)})'>Editar</button>
          <button class="btn-excluir" onclick="excluirProduto(${produto.id})">Excluir</button>
        </div>
      `;
      
      container.appendChild(card);
    });
  } catch (erro) {
    mostrarMensagem('Erro ao carregar produtos', 'erro');
  }
}

function mostrarFormProduto() {
  document.getElementById('form-produto').style.display = 'block';
  document.getElementById('titulo-form-produto').textContent = 'Novo Produto';
  document.getElementById('prod-id').value = '';
  document.querySelector('#form-produto form').reset();
}

function cancelarFormProduto() {
  document.getElementById('form-produto').style.display = 'none';
}

function editarProduto(produto) {
  document.getElementById('form-produto').style.display = 'block';
  document.getElementById('titulo-form-produto').textContent = 'Editar Produto';
  document.getElementById('prod-id').value = produto.id;
  document.getElementById('prod-nome').value = produto.nome;
  document.getElementById('prod-descricao').value = produto.descricao || '';
  document.getElementById('prod-preco').value = produto.preco;
  document.getElementById('prod-categoria').value = produto.categoria || '';
  document.getElementById('prod-estoque').value = produto.estoque;
  document.getElementById('prod-imagem').value = produto.imagem || '';
}

async function salvarProduto(event) {
  event.preventDefault();

  const id = document.getElementById('prod-id').value;
  const dados = {
    nome: document.getElementById('prod-nome').value,
    descricao: document.getElementById('prod-descricao').value,
    preco: parseFloat(document.getElementById('prod-preco').value),
    categoria: document.getElementById('prod-categoria').value,
    estoque: parseInt(document.getElementById('prod-estoque').value),
    imagem: document.getElementById('prod-imagem').value
  };

  try {
    const url = id ? `/api/produtos/${id}` : '/api/produtos';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    });

    const resultado = await res.json();

    if (resultado.sucesso) {
      mostrarMensagem(id ? 'Produto atualizado!' : 'Produto criado!', 'sucesso');
      cancelarFormProduto();
      carregarAdminProdutos();
      carregarProdutos();
    } else {
      mostrarMensagem(resultado.erro, 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao salvar produto', 'erro');
  }
}

async function excluirProduto(id) {
  if (!confirm('Tem certeza que deseja excluir este produto?')) return;

  try {
    const res = await fetch(`/api/produtos/${id}`, { method: 'DELETE' });
    const resultado = await res.json();

    if (resultado.sucesso) {
      mostrarMensagem('Produto excluído!', 'sucesso');
      carregarAdminProdutos();
      carregarProdutos();
    } else {
      mostrarMensagem(resultado.erro, 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao excluir produto', 'erro');
  }
}

async function carregarAdminPedidos() {
  try {
    const res = await fetch('/api/todos-pedidos');
    const pedidos = await res.json();

    const container = document.getElementById('lista-admin-pedidos');
    container.innerHTML = '';

    if (pedidos.length === 0) {
      container.innerHTML = '<p>Nenhum pedido realizado ainda.</p>';
      return;
    }

    pedidos.forEach(pedido => {
      const card = document.createElement('div');
      card.className = 'pedido-card';
      
      const data = new Date(pedido.criado_em).toLocaleDateString('pt-BR');
      
      card.innerHTML = `
        <div class="pedido-header">
          <div class="pedido-numero">Pedido #${pedido.id}</div>
          <select class="select-status" onchange="alterarStatus(${pedido.id}, this.value)" onclick="event.stopPropagation()">
            <option value="pendente" ${pedido.status === 'pendente' ? 'selected' : ''}>Pendente</option>
            <option value="processando" ${pedido.status === 'processando' ? 'selected' : ''}>Processando</option>
            <option value="enviado" ${pedido.status === 'enviado' ? 'selected' : ''}>Enviado</option>
            <option value="entregue" ${pedido.status === 'entregue' ? 'selected' : ''}>Entregue</option>
            <option value="cancelado" ${pedido.status === 'cancelado' ? 'selected' : ''}>Cancelado</option>
          </select>
        </div>
        <div class="pedido-info">
          Cliente: ${pedido.cliente_nome} (${pedido.cliente_email})<br>
          Data: ${data}
        </div>
        <div class="pedido-total">Total: R$ ${pedido.total.toFixed(2)}</div>
      `;
      
      card.onclick = () => verDetalhesPedido(pedido.id);
      container.appendChild(card);
    });
  } catch (erro) {
    mostrarMensagem('Erro ao carregar pedidos', 'erro');
  }
}

async function alterarStatus(pedidoId, novoStatus) {
  try {
    const res = await fetch(`/api/pedidos/${pedidoId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus })
    });

    const resultado = await res.json();

    if (resultado.sucesso) {
      mostrarMensagem('Status atualizado!', 'sucesso');
    } else {
      mostrarMensagem(resultado.erro, 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao atualizar status', 'erro');
  }
}

// ========== NAVEGAÇÃO ==========

function esconderTodasTelas() {
  document.querySelectorAll('.tela').forEach(tela => tela.style.display = 'none');
}

function mostrarProdutos() {
  esconderTodasTelas();
  document.getElementById('tela-produtos').style.display = 'block';
}

function mostrarLogin() {
  esconderTodasTelas();
  document.getElementById('tela-login').style.display = 'block';
}

function mostrarRegistro() {
  esconderTodasTelas();
  document.getElementById('tela-registro').style.display = 'block';
}

// ========== UTILIDADES ==========

function mostrarMensagem(texto, tipo) {
  const msg = document.getElementById('mensagem');
  msg.textContent = texto;
  msg.className = `mensagem ${tipo}`;
  msg.style.display = 'block';

  setTimeout(() => {
    msg.style.display = 'none';
  }, 3000);
}
