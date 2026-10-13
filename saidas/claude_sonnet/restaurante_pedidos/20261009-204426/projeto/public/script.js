// Estado da aplicação
let usuarioAtual = null;
let pratos = [];
let pedidos = [];
let carrinho = [];
let filtroAtualPedidos = 'todos';

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  verificarAutenticacao();
});

// Autenticação
async function verificarAutenticacao() {
  try {
    const resposta = await fetch('/api/usuario-atual');
    if (resposta.ok) {
      usuarioAtual = await resposta.json();
      mostrarTelaPrincipal();
    } else {
      mostrarTelaLogin();
    }
  } catch (erro) {
    mostrarTelaLogin();
  }
}

function mostrarTelaLogin() {
  document.getElementById('tela-login').style.display = 'block';
  document.getElementById('tela-principal').style.display = 'none';
}

function mostrarTelaPrincipal() {
  document.getElementById('tela-login').style.display = 'none';
  document.getElementById('tela-principal').style.display = 'block';
  document.getElementById('nome-usuario').textContent = usuarioAtual.nome;
  
  configurarNavegacao();
  
  if (usuarioAtual.tipo === 'gerente') {
    navegarPara('gerenciar-cardapio');
  } else {
    navegarPara('cardapio');
  }
}

function mostrarLogin() {
  document.getElementById('form-login').style.display = 'block';
  document.getElementById('form-registro').style.display = 'none';
}

function mostrarRegistro() {
  document.getElementById('form-login').style.display = 'none';
  document.getElementById('form-registro').style.display = 'block';
}

async function fazerLogin() {
  const email = document.getElementById('login-email').value;
  const senha = document.getElementById('login-senha').value;

  try {
    const resposta = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, senha })
    });

    const dados = await resposta.json();

    if (resposta.ok) {
      usuarioAtual = dados.usuario;
      mostrarMensagem('Login realizado com sucesso!', 'sucesso');
      mostrarTelaPrincipal();
    } else {
      mostrarMensagem(dados.erro || 'Erro ao fazer login', 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao conectar com o servidor', 'erro');
  }
}

async function fazerRegistro() {
  const nome = document.getElementById('registro-nome').value;
  const email = document.getElementById('registro-email').value;
  const senha = document.getElementById('registro-senha').value;

  try {
    const resposta = await fetch('/api/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, email, senha })
    });

    const dados = await resposta.json();

    if (resposta.ok) {
      usuarioAtual = dados.usuario;
      mostrarMensagem('Conta criada com sucesso!', 'sucesso');
      mostrarTelaPrincipal();
    } else {
      mostrarMensagem(dados.erro || 'Erro ao registrar', 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao conectar com o servidor', 'erro');
  }
}

async function fazerLogout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
    usuarioAtual = null;
    carrinho = [];
    mostrarMensagem('Logout realizado com sucesso!', 'sucesso');
    mostrarTelaLogin();
  } catch (erro) {
    mostrarMensagem('Erro ao fazer logout', 'erro');
  }
}

// Navegação
function configurarNavegacao() {
  const nav = document.getElementById('navegacao');
  nav.innerHTML = '<ul></ul>';
  const ul = nav.querySelector('ul');

  if (usuarioAtual.tipo === 'cliente') {
    ul.innerHTML = `
      <li><button onclick="navegarPara('cardapio')" data-secao="cardapio">Cardápio</button></li>
      <li><button onclick="navegarPara('meus-pedidos')" data-secao="meus-pedidos">Meus Pedidos</button></li>
    `;
  } else if (usuarioAtual.tipo === 'gerente') {
    ul.innerHTML = `
      <li><button onclick="navegarPara('gerenciar-cardapio')" data-secao="gerenciar-cardapio">Gerenciar Cardápio</button></li>
      <li><button onclick="navegarPara('todos-pedidos')" data-secao="todos-pedidos">Todos os Pedidos</button></li>
    `;
  }
}

function navegarPara(secao) {
  // Esconder todas as seções
  document.querySelectorAll('.secao').forEach(s => s.style.display = 'none');
  
  // Remover classe active de todos os botões
  document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
  
  // Mostrar seção selecionada
  document.getElementById(`secao-${secao}`).style.display = 'block';
  
  // Adicionar classe active ao botão
  const botao = document.querySelector(`nav button[data-secao="${secao}"]`);
  if (botao) botao.classList.add('active');

  // Carregar dados da seção
  switch(secao) {
    case 'cardapio':
      carregarCardapio();
      break;
    case 'meus-pedidos':
      carregarMeusPedidos();
      break;
    case 'gerenciar-cardapio':
      carregarGerenciarCardapio();
      break;
    case 'todos-pedidos':
      carregarTodosPedidos();
      break;
  }
}

// Cardápio (Cliente)
async function carregarCardapio() {
  try {
    const resposta = await fetch('/api/pratos');
    pratos = await resposta.json();
    
    const lista = document.getElementById('lista-cardapio');
    lista.innerHTML = '';

    // Agrupar por categoria
    const categorias = {};
    pratos.forEach(prato => {
      if (!categorias[prato.categoria]) {
        categorias[prato.categoria] = [];
      }
      categorias[prato.categoria].push(prato);
    });

    // Renderizar por categoria
    for (let categoria in categorias) {
      const divCategoria = document.createElement('div');
      divCategoria.style.marginBottom = '40px';
      
      const titulo = document.createElement('h3');
      titulo.textContent = categoria;
      titulo.style.color = 'var(--secondary)';
      titulo.style.marginBottom = '20px';
      titulo.style.fontSize = '1.5em';
      divCategoria.appendChild(titulo);

      const gridPratos = document.createElement('div');
      gridPratos.className = 'grid-pratos';

      categorias[categoria].forEach(prato => {
        if (prato.disponivel) {
          const card = criarCardPrato(prato);
          gridPratos.appendChild(card);
        }
      });

      divCategoria.appendChild(gridPratos);
      lista.appendChild(divCategoria);
    }

    atualizarCarrinhoResumo();
  } catch (erro) {
    mostrarMensagem('Erro ao carregar cardápio', 'erro');
  }
}

function criarCardPrato(prato) {
  const card = document.createElement('div');
  card.className = 'card-prato';
  
  const itemCarrinho = carrinho.find(i => i.prato_id === prato.id);
  const quantidade = itemCarrinho ? itemCarrinho.quantidade : 0;

  card.innerHTML = `
    <span class="categoria">${prato.categoria}</span>
    <h3>${prato.nome}</h3>
    <p>${prato.descricao || 'Sem descrição'}</p>
    <span class="preco">R$ ${prato.preco.toFixed(2)}</span>
    <div class="contador-quantidade">
      <button onclick="alterarQuantidade(${prato.id}, -1)">-</button>
      <span id="qtd-${prato.id}">${quantidade}</span>
      <button onclick="alterarQuantidade(${prato.id}, 1)">+</button>
    </div>
  `;

  return card;
}

function alterarQuantidade(pratoId, delta) {
  const itemIndex = carrinho.findIndex(i => i.prato_id === pratoId);
  
  if (itemIndex >= 0) {
    carrinho[itemIndex].quantidade += delta;
    if (carrinho[itemIndex].quantidade <= 0) {
      carrinho.splice(itemIndex, 1);
    }
  } else if (delta > 0) {
    carrinho.push({ prato_id: pratoId, quantidade: delta });
  }

  const elementoQtd = document.getElementById(`qtd-${pratoId}`);
  if (elementoQtd) {
    const novaQtd = carrinho.find(i => i.prato_id === pratoId)?.quantidade || 0;
    elementoQtd.textContent = novaQtd;
  }

  atualizarCarrinhoResumo();
}

function atualizarCarrinhoResumo() {
  const resumo = document.getElementById('carrinho-resumo');
  const contador = document.getElementById('carrinho-contador');
  
  const totalItens = carrinho.reduce((sum, item) => sum + item.quantidade, 0);
  
  if (totalItens > 0) {
    resumo.style.display = 'block';
    contador.textContent = totalItens;
  } else {
    resumo.style.display = 'none';
  }
}

function abrirCarrinho() {
  if (carrinho.length === 0) {
    mostrarMensagem('Carrinho vazio', 'info');
    return;
  }

  const modal = document.getElementById('modal-carrinho');
  const itensDiv = document.getElementById('itens-carrinho');
  const totalSpan = document.getElementById('total-carrinho');
  
  itensDiv.innerHTML = '';
  let total = 0;

  carrinho.forEach(item => {
    const prato = pratos.find(p => p.id === item.prato_id);
    if (!prato) return;

    const subtotal = prato.preco * item.quantidade;
    total += subtotal;

    const itemDiv = document.createElement('div');
    itemDiv.className = 'item-carrinho';
    itemDiv.innerHTML = `
      <div class="item-carrinho-info">
        <h4>${prato.nome}</h4>
        <p>R$ ${prato.preco.toFixed(2)} x ${item.quantidade}</p>
      </div>
      <div class="item-carrinho-acoes">
        <span style="font-weight: bold; font-size: 1.1em;">R$ ${subtotal.toFixed(2)}</span>
        <button onclick="removerDoCarrinho(${prato.id})" class="btn-danger btn-small">Remover</button>
      </div>
    `;
    itensDiv.appendChild(itemDiv);
  });

  totalSpan.textContent = total.toFixed(2);
  modal.style.display = 'flex';
}

function fecharCarrinho() {
  document.getElementById('modal-carrinho').style.display = 'none';
}

function removerDoCarrinho(pratoId) {
  const index = carrinho.findIndex(i => i.prato_id === pratoId);
  if (index >= 0) {
    carrinho.splice(index, 1);
  }

  const elementoQtd = document.getElementById(`qtd-${pratoId}`);
  if (elementoQtd) {
    elementoQtd.textContent = '0';
  }

  atualizarCarrinhoResumo();
  
  if (carrinho.length === 0) {
    fecharCarrinho();
  } else {
    abrirCarrinho();
  }
}

function limparCarrinho() {
  if (confirm('Deseja realmente limpar o carrinho?')) {
    carrinho.forEach(item => {
      const elementoQtd = document.getElementById(`qtd-${item.prato_id}`);
      if (elementoQtd) {
        elementoQtd.textContent = '0';
      }
    });
    
    carrinho = [];
    atualizarCarrinhoResumo();
    fecharCarrinho();
    mostrarMensagem('Carrinho limpo', 'info');
  }
}

async function finalizarPedido() {
  if (carrinho.length === 0) {
    mostrarMensagem('Carrinho vazio', 'erro');
    return;
  }

  const observacoes = document.getElementById('observacoes-pedido').value;

  try {
    const resposta = await fetch('/api/pedidos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itens: carrinho, observacoes })
    });

    const dados = await resposta.json();

    if (resposta.ok) {
      mostrarMensagem('Pedido realizado com sucesso!', 'sucesso');
      
      carrinho.forEach(item => {
        const elementoQtd = document.getElementById(`qtd-${item.prato_id}`);
        if (elementoQtd) {
          elementoQtd.textContent = '0';
        }
      });
      
      carrinho = [];
      document.getElementById('observacoes-pedido').value = '';
      atualizarCarrinhoResumo();
      fecharCarrinho();
      navegarPara('meus-pedidos');
    } else {
      mostrarMensagem(dados.erro || 'Erro ao finalizar pedido', 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao conectar com o servidor', 'erro');
  }
}

// Meus Pedidos (Cliente)
async function carregarMeusPedidos() {
  try {
    const resposta = await fetch('/api/pedidos');
    pedidos = await resposta.json();
    
    const lista = document.getElementById('lista-meus-pedidos');
    lista.innerHTML = '';

    if (pedidos.length === 0) {
      lista.innerHTML = '<div class="vazio"><h3>Nenhum pedido ainda</h3><p>Faça seu primeiro pedido no cardápio!</p></div>';
      return;
    }

    pedidos.forEach(pedido => {
      const card = criarCardPedido(pedido, false);
      lista.appendChild(card);
    });
  } catch (erro) {
    mostrarMensagem('Erro ao carregar pedidos', 'erro');
  }
}

// Gerenciar Cardápio (Gerente)
async function carregarGerenciarCardapio() {
  try {
    const resposta = await fetch('/api/pratos');
    pratos = await resposta.json();
    
    const lista = document.getElementById('lista-gerenciar-cardapio');
    lista.innerHTML = '';

    if (pratos.length === 0) {
      lista.innerHTML = '<div class="vazio"><h3>Nenhum prato cadastrado</h3><p>Adicione pratos ao cardápio!</p></div>';
      return;
    }

    // Agrupar por categoria
    const categorias = {};
    pratos.forEach(prato => {
      if (!categorias[prato.categoria]) {
        categorias[prato.categoria] = [];
      }
      categorias[prato.categoria].push(prato);
    });

    for (let categoria in categorias) {
      const divCategoria = document.createElement('div');
      divCategoria.style.marginBottom = '40px';
      
      const titulo = document.createElement('h3');
      titulo.textContent = categoria;
      titulo.style.color = 'var(--secondary)';
      titulo.style.marginBottom = '20px';
      titulo.style.fontSize = '1.5em';
      divCategoria.appendChild(titulo);

      const gridPratos = document.createElement('div');
      gridPratos.className = 'grid-pratos';

      categorias[categoria].forEach(prato => {
        const card = criarCardPratoGerente(prato);
        gridPratos.appendChild(card);
      });

      divCategoria.appendChild(gridPratos);
      lista.appendChild(divCategoria);
    }
  } catch (erro) {
    mostrarMensagem('Erro ao carregar cardápio', 'erro');
  }
}

function criarCardPratoGerente(prato) {
  const card = document.createElement('div');
  card.className = 'card-prato';
  if (!prato.disponivel) card.classList.add('indisponivel');

  card.innerHTML = `
    <span class="categoria">${prato.categoria}</span>
    <h3>${prato.nome}</h3>
    <p>${prato.descricao || 'Sem descrição'}</p>
    <span class="preco">R$ ${prato.preco.toFixed(2)}</span>
    <p style="color: ${prato.disponivel ? 'var(--success)' : 'var(--primary)'}; font-weight: 500; margin-top: 10px;">
      ${prato.disponivel ? '✓ Disponível' : '✗ Indisponível'}
    </p>
    <div class="acoes">
      <button onclick="editarPrato(${prato.id})" class="btn-success btn-small">Editar</button>
      <button onclick="deletarPrato(${prato.id})" class="btn-danger btn-small">Deletar</button>
    </div>
  `;

  return card;
}

function abrirModalPrato(pratoId = null) {
  const modal = document.getElementById('modal-prato');
  const titulo = document.getElementById('modal-prato-titulo');
  const form = document.getElementById('form-prato');
  
  form.reset();
  document.getElementById('prato-id').value = '';

  if (pratoId) {
    titulo.textContent = 'Editar Prato';
    const prato = pratos.find(p => p.id === pratoId);
    if (prato) {
      document.getElementById('prato-id').value = prato.id;
      document.getElementById('prato-nome').value = prato.nome;
      document.getElementById('prato-descricao').value = prato.descricao || '';
      document.getElementById('prato-preco').value = prato.preco;
      document.getElementById('prato-categoria').value = prato.categoria;
      document.getElementById('prato-disponivel').checked = prato.disponivel;
    }
  } else {
    titulo.textContent = 'Adicionar Prato';
    document.getElementById('prato-disponivel').checked = true;
  }

  modal.style.display = 'flex';
}

function fecharModalPrato() {
  document.getElementById('modal-prato').style.display = 'none';
}

function editarPrato(pratoId) {
  abrirModalPrato(pratoId);
}

async function salvarPrato(event) {
  event.preventDefault();

  const id = document.getElementById('prato-id').value;
  const nome = document.getElementById('prato-nome').value;
  const descricao = document.getElementById('prato-descricao').value;
  const preco = parseFloat(document.getElementById('prato-preco').value);
  const categoria = document.getElementById('prato-categoria').value;
  const disponivel = document.getElementById('prato-disponivel').checked;

  const dados = { nome, descricao, preco, categoria, disponivel };

  try {
    let resposta;
    if (id) {
      resposta = await fetch(`/api/pratos/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
    } else {
      resposta = await fetch('/api/pratos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dados)
      });
    }

    if (resposta.ok) {
      mostrarMensagem(id ? 'Prato atualizado!' : 'Prato adicionado!', 'sucesso');
      fecharModalPrato();
      carregarGerenciarCardapio();
    } else {
      const erro = await resposta.json();
      mostrarMensagem(erro.erro || 'Erro ao salvar prato', 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao conectar com o servidor', 'erro');
  }
}

async function deletarPrato(pratoId) {
  if (!confirm('Deseja realmente deletar este prato?')) return;

  try {
    const resposta = await fetch(`/api/pratos/${pratoId}`, {
      method: 'DELETE'
    });

    if (resposta.ok) {
      mostrarMensagem('Prato deletado!', 'sucesso');
      carregarGerenciarCardapio();
    } else {
      mostrarMensagem('Erro ao deletar prato', 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao conectar com o servidor', 'erro');
  }
}

// Todos os Pedidos (Gerente)
async function carregarTodosPedidos() {
  try {
    const resposta = await fetch('/api/pedidos');
    pedidos = await resposta.json();
    
    renderizarPedidosGerente();
  } catch (erro) {
    mostrarMensagem('Erro ao carregar pedidos', 'erro');
  }
}

function renderizarPedidosGerente() {
  const lista = document.getElementById('lista-todos-pedidos');
  lista.innerHTML = '';

  let pedidosFiltrados = pedidos;
  if (filtroAtualPedidos !== 'todos') {
    pedidosFiltrados = pedidos.filter(p => p.status === filtroAtualPedidos);
  }

  if (pedidosFiltrados.length === 0) {
    lista.innerHTML = '<div class="vazio"><h3>Nenhum pedido encontrado</h3></div>';
    return;
  }

  pedidosFiltrados.forEach(pedido => {
    const card = criarCardPedido(pedido, true);
    lista.appendChild(card);
  });
}

function filtrarPedidosGerente(filtro) {
  filtroAtualPedidos = filtro;
  
  document.querySelectorAll('.btn-filtro').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-filtro="${filtro}"]`).classList.add('active');
  
  renderizarPedidosGerente();
}

function criarCardPedido(pedido, isGerente) {
  const card = document.createElement('div');
  card.className = 'card-pedido';

  const data = new Date(pedido.criado_em).toLocaleString('pt-BR');

  let infoCliente = '';
  if (isGerente) {
    infoCliente = `
      <p><strong>Cliente:</strong> ${pedido.cliente_nome}</p>
      <p><strong>Email:</strong> ${pedido.cliente_email}</p>
    `;
  }

  let itensHTML = '';
  pedido.itens.forEach(item => {
    itensHTML += `
      <div class="pedido-item">
        <div class="pedido-item-info">
          <h4>${item.prato_nome}</h4>
          <p>Quantidade: ${item.quantidade} x R$ ${item.preco_unitario.toFixed(2)}</p>
        </div>
        <div class="pedido-item-preco">
          R$ ${(item.quantidade * item.preco_unitario).toFixed(2)}
        </div>
      </div>
    `;
  });

  let acoesHTML = '';
  if (isGerente) {
    acoesHTML = `
      <div class="pedido-acoes">
        <select onchange="alterarStatusPedido(${pedido.id}, this.value)" style="flex: 2;">
          <option value="">Alterar status...</option>
          <option value="Pendente" ${pedido.status === 'Pendente' ? 'disabled' : ''}>Pendente</option>
          <option value="Preparando" ${pedido.status === 'Preparando' ? 'disabled' : ''}>Preparando</option>
          <option value="Pronto" ${pedido.status === 'Pronto' ? 'disabled' : ''}>Pronto</option>
          <option value="Entregue" ${pedido.status === 'Entregue' ? 'disabled' : ''}>Entregue</option>
          <option value="Cancelado" ${pedido.status === 'Cancelado' ? 'disabled' : ''}>Cancelado</option>
        </select>
      </div>
    `;
  }

  card.innerHTML = `
    <div class="pedido-header">
      <h3>Pedido #${pedido.id}</h3>
      <span class="status-badge ${pedido.status}">${pedido.status}</span>
    </div>
    <div class="pedido-info">
      ${infoCliente}
      <p><strong>Data:</strong> ${data}</p>
      ${pedido.observacoes ? `<p><strong>Observações:</strong> ${pedido.observacoes}</p>` : ''}
    </div>
    <div class="pedido-itens">
      ${itensHTML}
    </div>
    <div class="pedido-total">
      <h4>Total: R$ ${pedido.total.toFixed(2)}</h4>
    </div>
    ${acoesHTML}
  `;

  return card;
}

async function alterarStatusPedido(pedidoId, novoStatus) {
  if (!novoStatus) return;

  try {
    const resposta = await fetch(`/api/pedidos/${pedidoId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: novoStatus })
    });

    if (resposta.ok) {
      mostrarMensagem('Status atualizado!', 'sucesso');
      carregarTodosPedidos();
    } else {
      const erro = await resposta.json();
      mostrarMensagem(erro.erro || 'Erro ao atualizar status', 'erro');
    }
  } catch (erro) {
    mostrarMensagem('Erro ao conectar com o servidor', 'erro');
  }
}

// Mensagens
function mostrarMensagem(texto, tipo = 'info') {
  const mensagem = document.getElementById('mensagem');
  mensagem.textContent = texto;
  mensagem.className = `mensagem ${tipo}`;
  mensagem.style.display = 'block';

  setTimeout(() => {
    mensagem.style.display = 'none';
  }, 4000);
}

// Fechar modais ao clicar fora
window.onclick = function(event) {
  const modalCarrinho = document.getElementById('modal-carrinho');
  const modalPrato = document.getElementById('modal-prato');
  
  if (event.target === modalCarrinho) {
    fecharCarrinho();
  }
  if (event.target === modalPrato) {
    fecharModalPrato();
  }
}

// Permitir Enter para fazer login
document.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const loginVisivel = document.getElementById('form-login').style.display !== 'none';
    const registroVisivel = document.getElementById('form-registro').style.display !== 'none';
    
    if (loginVisivel) {
      fazerLogin();
    } else if (registroVisivel) {
      fazerRegistro();
    }
  }
});
