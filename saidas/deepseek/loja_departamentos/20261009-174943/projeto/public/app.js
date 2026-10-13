let usuario = null;
let carrinho = [];
let departamentoAtual = null;

async function api(url, metodo = 'GET', body = null) {
  const opts = { method: metodo, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  const data = r.headers.get('content-type')?.includes('json') ? await r.json() : {};
  if (!r.ok) throw new Error(data.erro || 'Erro');
  return data;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('visivel');
  setTimeout(() => t.classList.remove('visivel'), 2000);
}

function modal(html) {
  const m = document.getElementById('modal');
  document.getElementById('modalConteudo').innerHTML = html;
  m.classList.remove('oculto');
}
function fecharModal() { document.getElementById('modal').classList.add('oculto'); }
document.getElementById('modal').addEventListener('click', e => { if (e.target.id === 'modal') fecharModal(); });

function money(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); }

// ---------- INICIALIZAÇÃO ----------
async function init() {
  try {
    const r = await api('/api/auth/me');
    usuario = r.usuario;
  } catch {}
  await atualizarCarrinho();
  await carregarDepartamentos();
  irPara('home');
}

async function carregarDepartamentos() {
  try {
    const deps = await api('/api/departamentos');
    const nav = document.getElementById('navDepartamentos');
    nav.innerHTML = `<button onclick="filtrarDep(null)" class="${departamentoAtual === null ? 'ativo' : ''}">Todos</button>` +
      deps.map(d => `<button onclick="filtrarDep('${d}')" class="${departamentoAtual === d ? 'ativo' : ''}">${d}</button>`).join('');
  } catch {}
}

function filtrarDep(d) { departamentoAtual = d; carregarDepartamentos(); irPara('home'); }
function buscar() { irPara('home'); }

// ---------- NAVEGAÇÃO ----------
function irPara(tela, extra) {
  const c = document.getElementById('conteudo');
  atualizarAreaUsuario();
  if (tela === 'home') renderHome(c);
  else if (tela === 'login') renderLogin(c);
  else if (tela === 'cadastro') renderCadastro(c);
  else if (tela === 'pedidos') renderMeusPedidos(c);
  else if (tela === 'adminProdutos') renderAdminProdutos(c);
  else if (tela === 'adminPedidos') renderAdminPedidos(c);
  else if (tela === 'adminNovoProduto') renderFormProduto(c, null);
  else if (tela === 'adminEditarProduto') renderFormProduto(c, extra);
}

function atualizarAreaUsuario() {
  const area = document.getElementById('areaUsuario');
  if (usuario) {
    area.innerHTML = `
      <span class="usuario-nome">Olá, ${usuario.nome.split(' ')[0]}</span>
      <div style="display:inline-flex;gap:6px;flex-wrap:wrap;">
        ${usuario.is_admin
          ? `<button class="btn btn-secundario" style="padding:8px 12px;font-size:13px" onclick="irPara('adminProdutos')">Produtos</button>
             <button class="btn btn-secundario" style="padding:8px 12px;font-size:13px" onclick="irPara('adminPedidos')">Pedidos</button>`
          : `<button class="btn btn-secundario" style="padding:8px 12px;font-size:13px" onclick="irPara('pedidos')">Meus Pedidos</button>`}
        <button class="btn btn-secundario" style="padding:8px 12px;font-size:13px" onclick="logout()">Sair</button>
      </div>
    `;
  } else {
    area.innerHTML = `
      <button class="btn" style="padding:8px 12px;font-size:13px" onclick="irPara('login')">Entrar</button>
      <button class="btn btn-secundario" style="padding:8px 12px;font-size:13px" onclick="irPara('cadastro')">Cadastrar</button>
    `;
  }
}

async function logout() {
  await api('/api/auth/logout', 'POST');
  usuario = null;
  await atualizarCarrinho();
  toast('Saiu da conta');
  irPara('home');
}

// ---------- HOME ----------
async function renderHome(c) {
  const busca = document.getElementById('campoBusca').value.trim();
  let url = '/api/produtos?';
  if (departamentoAtual) url += `departamento=${encodeURIComponent(departamentoAtual)}&`;
  if (busca) url += `busca=${encodeURIComponent(busca)}`;
  c.innerHTML = '<p>Carregando...</p>';
  try {
    const produtos = await api(url);
    if (produtos.length === 0) {
      c.innerHTML = '<div class="sem-resultados">Nenhum produto encontrado.</div>';
      return;
    }
    c.innerHTML = `<h1>${departamentoAtual || 'Todos os produtos'}</h1>
      <div class="grid-produtos">${produtos.map(p => `
        <div class="produto-card">
          <div class="produto-img">${p.imagem || '📦'}</div>
          <div class="produto-info">
            <div class="produto-dep">${p.departamento}</div>
            <div class="produto-nome">${p.nome}</div>
            <div class="produto-desc">${p.descricao || ''}</div>
            <div class="produto-preco">${money(p.preco)}</div>
            <div class="produto-estoque">${p.estoque > 0 ? p.estoque + ' em estoque' : 'Sem estoque'}</div>
            <button class="btn btn-full" ${p.estoque <= 0 ? 'disabled' : ''} onclick="addCarrinho(${p.id})">Adicionar ao carrinho</button>
          </div>
        </div>
      `).join('')}</div>`;
  } catch (e) {
    c.innerHTML = '<div class="sem-resultados">Erro ao carregar produtos</div>';
  }
}

// ---------- AUTH ----------
function renderLogin(c) {
  c.innerHTML = `
    <div class="card" style="max-width:400px;margin:0 auto">
      <h1>Entrar</h1>
      <form class="form" onsubmit="fazerLogin(event)">
        <label>Email</label>
        <input name="email" type="email" required>
        <label>Senha</label>
        <input name="senha" type="password" required>
        <button class="btn btn-full" type="submit">Entrar</button>
      </form>
      <p style="margin-top:12px;text-align:center;font-size:14px">Não tem conta? <a href="#" onclick="irPara('cadastro');return false;">Cadastre-se</a></p>
      <p style="margin-top:16px;font-size:12px;color:#888;text-align:center">Admin: admin@loja.com / admin123<br>Cliente: cliente@loja.com / cliente123</p>
    </div>
  `;
}

async function fazerLogin(e) {
  e.preventDefault();
  const f = e.target;
  try {
    const r = await api('/api/auth/login', 'POST', { email: f.email.value, senha: f.senha.value });
    usuario = r.usuario;
    toast('Bem-vindo, ' + usuario.nome);
    irPara('home');
  } catch (err) { toast(err.message); }
}

function renderCadastro(c) {
  c.innerHTML = `
    <div class="card" style="max-width:400px;margin:0 auto">
      <h1>Criar conta</h1>
      <form class="form" onsubmit="fazerCadastro(event)">
        <label>Nome</label>
        <input name="nome" required>
        <label>Email</label>
        <input name="email" type="email" required>
        <label>Senha</label>
        <input name="senha" type="password" minlength="4" required>
        <button class="btn btn-full" type="submit">Cadastrar</button>
      </form>
      <p style="margin-top:12px;text-align:center;font-size:14px">Já tem conta? <a href="#" onclick="irPara('login');return false;">Entrar</a></p>
    </div>
  `;
}

async function fazerCadastro(e) {
  e.preventDefault();
  const f = e.target;
  try {
    const r = await api('/api/auth/cadastro', 'POST', { nome: f.nome.value, email: f.email.value, senha: f.senha.value });
    usuario = r.usuario;
    toast('Conta criada!');
    irPara('home');
  } catch (err) { toast(err.message); }
}

// ---------- CARRINHO ----------
async function atualizarCarrinho() {
  try {
    const r = await api('/api/carrinho');
    carrinho = r.itens;
    document.getElementById('badgeCarrinho').textContent = carrinho.reduce((s, i) => s + i.quantidade, 0);
  } catch {}
}

async function addCarrinho(id) {
  try {
    await api('/api/carrinho/adicionar', 'POST', { produto_id: id, quantidade: 1 });
    await atualizarCarrinho();
    toast('Adicionado ao carrinho!');
  } catch (e) { toast(e.message); }
}

function abrirCarrinho() {
  if (carrinho.length === 0) {
    return modal('<h2>Carrinho vazio</h2><p style="margin:12px 0">Adicione produtos para continuar.</p><button class="btn btn-full" onclick="fecharModal()">Fechar</button>');
  }
  const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
  modal(`
    <h2>Meu Carrinho</h2>
    <div style="margin:16px 0">
      ${carrinho.map(i => `
        <div class="item-carrinho">
          <div class="img">${i.imagem || '📦'}</div>
          <div class="info">
            <div style="font-weight:600">${i.nome}</div>
            <div style="color:#666;font-size:13px">${money(i.preco)} cada</div>
          </div>
          <div class="qtd">
            <button onclick="alterarQtd(${i.id}, ${i.quantidade - 1})">−</button>
            <span>${i.quantidade}</span>
            <button onclick="alterarQtd(${i.id}, ${i.quantidade + 1})">+</button>
          </div>
          <button class="btn btn-perigo" style="padding:6px 10px" onclick="removerItem(${i.id})">X</button>
        </div>
      `).join('')}
    </div>
    <h2 style="text-align:right">Total: ${money(total)}</h2>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button class="btn btn-secundario" style="flex:1" onclick="fecharModal()">Continuar</button>
      <button class="btn btn-sucesso" style="flex:1" onclick="finalizarPedido()">Finalizar Pedido</button>
    </div>
  `);
}

async function alterarQtd(id, qtd) {
  await api('/api/carrinho/' + id, 'PUT', { quantidade: qtd });
  await atualizarCarrinho();
  abrirCarrinho();
}

async function removerItem(id) {
  await api('/api/carrinho/' + id, 'DELETE');
  await atualizarCarrinho();
  abrirCarrinho();
  toast('Item removido');
}

async function finalizarPedido() {
  if (!usuario) {
    fecharModal();
    toast('Faça login para finalizar');
    irPara('login');
    return;
  }
  try {
    const r = await api('/api/pedidos', 'POST');
    await atualizarCarrinho();
    fecharModal();
    toast('Pedido realizado!');
    irPara('pedidos');
  } catch (e) { toast(e.message); }
}

// ---------- MEUS PEDIDOS ----------
async function renderMeusPedidos(c) {
  c.innerHTML = '<p>Carregando...</p>';
  try {
    const pedidos = await api('/api/pedidos/meus');
    if (pedidos.length === 0) {
      c.innerHTML = '<h1>Meus Pedidos</h1><div class="sem-resultados">Você ainda não fez nenhum pedido.</div>';
      return;
    }
    c.innerHTML = `<h1>Meus Pedidos</h1>${pedidos.map(p => `
      <div class="pedido">
        <div class="pedido-head">
          <div>
            <strong>Pedido #${p.id}</strong>
            <span style="color:#888;font-size:13px;margin-left:8px">${new Date(p.criado_em).toLocaleString('pt-BR')}</span>
          </div>
          <span class="status status-${p.status.replace(' ', '-')}">${p.status}</span>
        </div>
        ${p.itens.map(i => `<div style="font-size:14px;color:#555">${i.quantidade}x ${i.imagem || '📦'} ${i.nome} — ${money(i.preco_unitario)}</div>`).join('')}
        <div style="text-align:right;margin-top:8px;font-weight:bold;color:#1a237e">Total: ${money(p.total)}</div>
      </div>
    `).join('')}`;
  } catch (e) {
    c.innerHTML = '<div class="sem-resultados">Faça login para ver seus pedidos</div>';
  }
}

// ---------- ADMIN: PRODUTOS ----------
async function renderAdminProdutos(c) {
  c.innerHTML = '<p>Carregando...</p>';
  try {
    const produtos = await api('/api/produtos');
    c.innerHTML = `
      <div class="grid-acoes">
        <h1 style="flex:1">Gerenciar Produtos</h1>
        <button class="btn btn-sucesso" onclick="irPara('adminNovoProduto')">+ Novo Produto</button>
      </div>
      <div style="overflow-x:auto">
        <table class="tabela">
          <thead><tr><th>Imagem</th><th>Nome</th><th>Departamento</th><th>Preço</th><th>Estoque</th><th>Ações</th></tr></thead>
          <tbody>
            ${produtos.map(p => `
              <tr>
                <td style="font-size:24px">${p.imagem || '📦'}</td>
                <td>${p.nome}</td>
                <td>${p.departamento}</td>
                <td>${money(p.preco)}</td>
                <td>${p.estoque}</td>
                <td>
                  <button class="btn" style="padding:6px 10px;font-size:12px" onclick="irPara('adminEditarProduto', ${p.id})">Editar</button>
                  <button class="btn btn-perigo" style="padding:6px 10px;font-size:12px" onclick="excluirProduto(${p.id})">Excluir</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {
    c.innerHTML = '<div class="sem-resultados">Acesso negado</div>';
  }
}

async function renderFormProduto(c, id) {
  let p = { nome: '', descricao: '', preco: '', departamento: '', estoque: 0, imagem: '📦' };
  if (id) p = await api('/api/produtos/' + id);
  c.innerHTML = `
    <div class="card" style="max-width:500px">
      <h1>${id ? 'Editar' : 'Novo'} Produto</h1>
      <form class="form" onsubmit="salvarProduto(event, ${id})">
        <label>Nome</label>
        <input name="nome" value="${p.nome}" required>
        <label>Descrição</label>
        <textarea name="descricao" rows="3">${p.descricao || ''}</textarea>
        <label>Preço (R$)</label>
        <input name="preco" type="number" step="0.01" min="0" value="${p.preco}" required>
        <label>Departamento</label>
        <input name="departamento" value="${p.departamento}" required list="deps" placeholder="Ex: Roupas, Eletrônicos, Casa">
        <label>Estoque</label>
        <input name="estoque" type="number" min="0" value="${p.estoque}" required>
        <label>Emoji/Imagem</label>
        <input name="imagem" value="${p.imagem || '📦'}" maxlength="4">
        <div style="display:flex;gap:8px">
          <button type="button" class="btn btn-secundario" style="flex:1" onclick="irPara('adminProdutos')">Cancelar</button>
          <button type="submit" class="btn btn-sucesso" style="flex:1">Salvar</button>
        </div>
      </form>
    </div>
  `;
}

async function salvarProduto(e, id) {
  e.preventDefault();
  const f = e.target;
  const dados = {
    nome: f.nome.value, descricao: f.descricao.value, preco: f.preco.value,
    departamento: f.departamento.value, estoque: f.estoque.value, imagem: f.imagem.value
  };
  try {
    if (id) await api('/api/produtos/' + id, 'PUT', dados);
    else await api('/api/produtos', 'POST', dados);
    toast('Produto salvo!');
    await carregarDepartamentos();
    irPara('adminProdutos');
  } catch (e) { toast(e.message); }
}

async function excluirProduto(id) {
  if (!confirm('Excluir este produto?')) return;
  try {
    await api('/api/produtos/' + id, 'DELETE');
    toast('Produto excluído');
    renderAdminProdutos(document.getElementById('conteudo'));
  } catch (e) { toast(e.message); }
}

// ---------- ADMIN: PEDIDOS ----------
async function renderAdminPedidos(c) {
  c.innerHTML = '<p>Carregando...</p>';
  try {
    const pedidos = await api('/api/pedidos');
    if (pedidos.length === 0) {
      c.innerHTML = '<h1>Todos os Pedidos</h1><div class="sem-resultados">Nenhum pedido recebido ainda.</div>';
      return;
    }
    const statusOpcoes = ['Pendente', 'Em preparo', 'Enviado', 'Entregue', 'Cancelado'];
    c.innerHTML = `<h1>Todos os Pedidos</h1>${pedidos.map(p => `
      <div class="pedido">
        <div class="pedido-head">
          <div>
            <strong>Pedido #${p.id}</strong> — ${p.cliente_nome} (${p.cliente_email})
            <div style="color:#888;font-size:13px">${new Date(p.criado_em).toLocaleString('pt-BR')}</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="status status-${p.status.replace(' ', '-')}">${p.status}</span>
            <select onchange="mudarStatus(${p.id}, this.value)" style="padding:6px;border-radius:4px;border:1px solid #ccc">
              ${statusOpcoes.map(s => `<option ${s === p.status ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
        </div>
        ${p.itens.map(i => `<div style="font-size:14px;color:#555">${i.quantidade}x ${i.imagem || '📦'} ${i.nome} — ${money(i.preco_unitario)}</div>`).join('')}
        <div style="text-align:right;margin-top:8px;font-weight:bold;color:#1a237e">Total: ${money(p.total)}</div>
      </div>
    `).join('')}`;
  } catch (e) {
    c.innerHTML = '<div class="sem-resultados">Acesso negado</div>';
  }
}

async function mudarStatus(id, status) {
  try {
    await api('/api/pedidos/' + id + '/status', 'PUT', { status });
    toast('Status atualizado');
  } catch (e) { toast(e.message); }
}

init();
