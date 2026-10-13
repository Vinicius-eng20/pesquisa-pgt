(function () {
  const app = document.getElementById('app');
  const nav = document.getElementById('menu-nav');
  const toast = document.getElementById('toast');

  let usuario = null;
  let paginaAtual = 'entrar';
  let carrinho = [];

  function mostrarToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  async function api(url, opcoes = {}) {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      ...opcoes,
      body: opcoes.body ? JSON.stringify(opcoes.body) : undefined
    });
    let dados = null;
    try { dados = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error((dados && dados.erro) || 'Erro na operação');
    return dados;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function dinheiro(v) { return 'R$ ' + Number(v).toFixed(2).replace('.', ','); }

  const nomesStatus = {
    recebido: 'Recebido',
    em_preparo: 'Em preparo',
    pronto: 'Pronto',
    entregue: 'Entregue',
    cancelado: 'Cancelado'
  };

  async function init() {
    try {
      const r = await api('/api/eu');
      usuario = r.user;
    } catch (e) {
      usuario = null;
    }
    renderNav();
    if (usuario) paginaAtual = usuario.role === 'gerente' ? 'pedidos-admin' : 'cardapio';
    else paginaAtual = 'entrar';
    render();
  }

  function renderNav() {
    nav.innerHTML = '';
    if (!usuario) return;
    if (usuario.role === 'cliente') {
      addNavBtn('Cardápio', 'cardapio');
      addNavBtn('Meus Pedidos', 'meus-pedidos');
    } else {
      addNavBtn('Cardápio', 'cardapio');
      addNavBtn('Gerenciar Pratos', 'gerenciar-pratos');
      addNavBtn('Todos os Pedidos', 'pedidos-admin');
    }
    const b = document.createElement('button');
    b.textContent = 'Sair (' + usuario.nome + ')';
    b.onclick = async () => {
      await api('/api/logout', { method: 'POST' });
      usuario = null;
      carrinho = [];
      paginaAtual = 'entrar';
      renderNav();
      render();
    };
    nav.appendChild(b);
  }

  function addNavBtn(texto, pagina) {
    const b = document.createElement('button');
    b.textContent = texto;
    if (paginaAtual === pagina) b.classList.add('ativo');
    b.onclick = () => { paginaAtual = pagina; renderNav(); render(); };
    nav.appendChild(b);
  }

  function render() {
    if (!usuario) {
      if (paginaAtual === 'entrar') renderEntrar();
      else renderRegistrar();
      return;
    }
    switch (paginaAtual) {
      case 'cardapio': return renderCardapio();
      case 'meus-pedidos': return renderMeusPedidos();
      case 'gerenciar-pratos': return renderGerenciarPratos();
      case 'pedidos-admin': return renderPedidosAdmin();
    }
  }

  function renderEntrar() {
    app.innerHTML = `
      <div class="card" style="max-width:420px;margin:40px auto;">
        <h2>Entrar</h2>
        <div id="err" class="erro"></div>
        <input id="email" type="email" placeholder="Email" autocomplete="username">
        <input id="senha" type="password" placeholder="Senha" autocomplete="current-password">
        <button class="principal" id="btn">Entrar</button>
        <p class="aviso" style="margin-top:14px;">
          Não tem conta? <a href="#" id="ir-cad">Cadastre-se</a>
        </p>
      </div>
    `;
    document.getElementById('ir-cad').onclick = e => { e.preventDefault(); paginaAtual = 'registrar'; render(); };
    document.getElementById('btn').onclick = async () => {
      const email = document.getElementById('email').value.trim();
      const senha = document.getElementById('senha').value;
      try {
        const r = await api('/api/login', { method: 'POST', body: { email, senha } });
        usuario = r.user;
        carrinho = [];
        paginaAtual = usuario.role === 'gerente' ? 'pedidos-admin' : 'cardapio';
        renderNav();
        render();
        mostrarToast('Bem-vindo, ' + usuario.nome + '!');
      } catch (e) {
        document.getElementById('err').textContent = e.message;
      }
    };
  }

  function renderRegistrar() {
    app.innerHTML = `
      <div class="card" style="max-width:420px;margin:40px auto;">
        <h2>Criar conta</h2>
        <div id="err" class="erro"></div>
        <input id="nome" type="text" placeholder="Seu nome">
        <input id="email" type="email" placeholder="Email" autocomplete="username">
        <input id="senha" type="password" placeholder="Senha" autocomplete="new-password">
        <button class="principal" id="btn">Criar conta de cliente</button>
        <p class="aviso" style="margin-top:14px;">
          Já tem conta? <a href="#" id="ir-ent">Entrar</a>
        </p>
      </div>
    `;
    document.getElementById('ir-ent').onclick = e => { e.preventDefault(); paginaAtual = 'entrar'; render(); };
    document.getElementById('btn').onclick = async () => {
      const nome = document.getElementById('nome').value.trim();
      const email = document.getElementById('email').value.trim();
      const senha = document.getElementById('senha').value;
      try {
        const r = await api('/api/registrar', { method: 'POST', body: { nome, email, senha } });
        usuario = r.user;
        carrinho = [];
        paginaAtual = 'cardapio';
        renderNav();
        render();
        mostrarToast('Conta criada!');
      } catch (e) {
        document.getElementById('err').textContent = e.message;
      }
    };
  }

  async function renderCardapio() {
    app.innerHTML = `<div class="card"><h2>Cardápio</h2><div id="lista" class="grid">Carregando...</div></div>
      <div id="carrinho"></div>`;
    let pratos = [];
    try { pratos = await api('/api/pratos'); } catch (e) { app.innerHTML = '<div class="card erro">' + esc(e.message) + '</div>'; return; }

    const lista = document.getElementById('lista');
    if (!pratos.length) {
      lista.innerHTML = '<p class="aviso">Nenhum prato cadastrado ainda.</p>';
      return;
    }
    lista.innerHTML = '';
    pratos.forEach(p => {
      const div = document.createElement('div');
      div.className = 'prato';
      div.innerHTML = `
        <div><strong>${esc(p.nome)}</strong></div>
        <div class="desc">${esc(p.descricao || '')}</div>
        <div class="preco">${dinheiro(p.preco)}</div>
      `;
      const btn = document.createElement('button');
      btn.className = 'principal';
      btn.textContent = 'Adicionar';
      btn.onclick = () => {
        const item = carrinho.find(i => i.prato_id === p.id);
        if (item) item.quantidade++;
        else carrinho.push({ prato_id: p.id, nome: p.nome, preco: p.preco, quantidade: 1 });
        renderCarrinho();
        mostrarToast(p.nome + ' adicionado');
      };
      div.appendChild(btn);
      lista.appendChild(div);
    });
    renderCarrinho();
  }

  function renderCarrinho() {
    const el = document.getElementById('carrinho');
    if (!el) return;
    if (!carrinho.length) {
      el.innerHTML = '';
      return;
    }
    const total = carrinho.reduce((s, i) => s + i.preco * i.quantidade, 0);
    el.innerHTML = `
      <div class="card">
        <h2>Seu pedido</h2>
        <div id="itens-carrinho"></div>
        <div class="linha" style="margin-top:10px;justify-content:space-between;">
          <strong>Total: ${dinheiro(total)}</strong>
          <button class="principal" id="enviar">Fazer pedido</button>
        </div>
      </div>
    `;
    const cont = document.getElementById('itens-carrinho');
    carrinho.forEach((it, idx) => {
      const div = document.createElement('div');
      div.className = 'pedido';
      div.innerHTML = `
        <div class="topo">
          <strong>${esc(it.nome)}</strong>
          <span>${dinheiro(it.preco)} × ${it.quantidade} = <span class="total">${dinheiro(it.preco * it.quantidade)}</span></span>
        </div>
      `;
      const acoes = document.createElement('div');
      acoes.className = 'acoes';
      const menos = document.createElement('button');
      menos.className = 'secundario'; menos.textContent = '−';
      menos.onclick = () => { it.quantidade--; if (it.quantidade <= 0) carrinho.splice(idx, 1); renderCarrinho(); };
      const mais = document.createElement('button');
      mais.className = 'secundario'; mais.textContent = '+';
      mais.onclick = () => { it.quantidade++; renderCarrinho(); };
      const rem = document.createElement('button');
      rem.className = 'danger'; rem.textContent = 'Remover';
      rem.onclick = () => { carrinho.splice(idx, 1); renderCarrinho(); };
      acoes.appendChild(menos); acoes.appendChild(mais); acoes.appendChild(rem);
      div.appendChild(acoes);
      cont.appendChild(div);
    });
    document.getElementById('enviar').onclick = async () => {
      try {
        await api('/api/pedidos', { method: 'POST', body: { itens: carrinho.map(i => ({ prato_id: i.prato_id, quantidade: i.quantidade })) } });
        carrinho = [];
        mostrarToast('Pedido enviado!');
        paginaAtual = 'meus-pedidos';
        renderNav();
        render();
      } catch (e) { mostrarToast(e.message); }
    };
  }

  async function renderMeusPedidos() {
    app.innerHTML = `<div class="card"><h2>Meus Pedidos</h2><div id="lista">Carregando...</div></div>`;
    let pedidos = [];
    try { pedidos = await api('/api/meus-pedidos'); } catch (e) { app.innerHTML = '<div class="card erro">' + esc(e.message) + '</div>'; return; }
    const lista = document.getElementById('lista');
    if (!pedidos.length) { lista.innerHTML = '<p class="aviso">Você ainda não fez nenhum pedido.</p>'; return; }
    lista.innerHTML = '';
    pedidos.forEach(p => {
      const div = document.createElement('div');
      div.className = 'pedido';
      const itensHtml = p.itens.map(i => `${esc(i.nome)} × ${i.quantidade}`).join('<br>');
      div.innerHTML = `
        <div class="topo">
          <strong>Pedido #${p.id}</strong>
          <span class="status ${p.status}">${nomesStatus[p.status] || p.status}</span>
        </div>
        <div class="itens">${itensHtml}</div>
        <div class="total">Total: ${dinheiro(p.total)}</div>
      `;
      lista.appendChild(div);
    });
  }

  async function renderGerenciarPratos() {
    app.innerHTML = `
      <div class="card">
        <h2>Novo prato</h2>
        <div id="err" class="erro"></div>
        <input id="nome" placeholder="Nome do prato">
        <textarea id="desc" placeholder="Descrição (opcional)"></textarea>
        <input id="preco" type="number" step="0.01" min="0" placeholder="Preço (ex: 29.90)">
        <button class="principal" id="add">Adicionar prato</button>
      </div>
      <div class="card"><h2>Pratos cadastrados</h2><div id="lista">Carregando...</div></div>
    `;
    document.getElementById('add').onclick = async () => {
      const nome = document.getElementById('nome').value.trim();
      const descricao = document.getElementById('desc').value.trim();
      const preco = parseFloat(document.getElementById('preco').value);
      if (!nome || isNaN(preco)) { document.getElementById('err').textContent = 'Informe nome e preço válidos'; return; }
      try {
        await api('/api/pratos', { method: 'POST', body: { nome, descricao, preco } });
        mostrarToast('Prato adicionado');
        renderGerenciarPratos();
      } catch (e) { document.getElementById('err').textContent = e.message; }
    };
    await listarPratosAdmin();
  }

  async function listarPratosAdmin() {
    let pratos = [];
    try { pratos = await api('/api/pratos'); } catch (e) {}
    const lista = document.getElementById('lista');
    if (!pratos.length) { lista.innerHTML = '<p class="aviso">Nenhum prato.</p>'; return; }
    lista.innerHTML = '';
    pratos.forEach(p => {
      const div = document.createElement('div');
      div.className = 'pedido';
      div.innerHTML = `
        <div class="topo"><strong>${esc(p.nome)}</strong><span>${dinheiro(p.preco)}</span></div>
        <div class="itens">${esc(p.descricao || '')}</div>
      `;
      const acoes = document.createElement('div');
      acoes.className = 'acoes';
      const ed = document.createElement('button');
      ed.className = 'secundario'; ed.textContent = 'Editar';
      ed.onclick = () => editarPrato(p);
      const del = document.createElement('button');
      del.className = 'danger'; del.textContent = 'Remover';
      del.onclick = async () => {
        if (!confirm('Remover o prato "' + p.nome + '"?')) return;
        try { await api('/api/pratos/' + p.id, { method: 'DELETE' }); mostrarToast('Prato removido'); renderGerenciarPratos(); }
        catch (e) { mostrarToast(e.message); }
      };
      acoes.appendChild(ed); acoes.appendChild(del);
      div.appendChild(acoes);
      lista.appendChild(div);
    });
  }

  function editarPrato(p) {
    app.innerHTML = `
      <div class="card">
        <h2>Editar prato</h2>
        <div id="err" class="erro"></div>
        <input id="nome" value="${esc(p.nome)}">
        <textarea id="desc">${esc(p.descricao || '')}</textarea>
        <input id="preco" type="number" step="0.01" min="0" value="${p.preco}">
        <div class="acoes">
          <button class="principal" id="salvar">Salvar</button>
          <button class="secundario" id="cancelar">Cancelar</button>
        </div>
      </div>
    `;
    document.getElementById('cancelar').onclick = () => { paginaAtual = 'gerenciar-pratos'; render(); };
    document.getElementById('salvar').onclick = async () => {
      const nome = document.getElementById('nome').value.trim();
      const descricao = document.getElementById('desc').value.trim();
      const preco = parseFloat(document.getElementById('preco').value);
      if (!nome || isNaN(preco)) { document.getElementById('err').textContent = 'Informe nome e preço válidos'; return; }
      try {
        await api('/api/pratos/' + p.id, { method: 'PUT', body: { nome, descricao, preco } });
        mostrarToast('Prato atualizado');
        paginaAtual = 'gerenciar-pratos';
        render();
      } catch (e) { document.getElementById('err').textContent = e.message; }
    };
  }

  async function renderPedidosAdmin() {
    app.innerHTML = `<div class="card"><h2>Todos os Pedidos</h2><div id="lista">Carregando...</div></div>`;
    let pedidos = [];
    try { pedidos = await api('/api/pedidos'); } catch (e) { app.innerHTML = '<div class="card erro">' + esc(e.message) + '</div>'; return; }
    const lista = document.getElementById('lista');
    if (!pedidos.length) { lista.innerHTML = '<p class="aviso">Ainda não há pedidos.</p>'; return; }
    lista.innerHTML = '';
    pedidos.forEach(p => {
      const div = document.createElement('div');
      div.className = 'pedido';
      const itensHtml = p.itens.map(i => `${esc(i.nome)} × ${i.quantidade}`).join('<br>');
      div.innerHTML = `
        <div class="topo">
          <div>
            <strong>Pedido #${p.id}</strong><br>
            <small>Cliente: ${esc(p.cliente_nome)} (${esc(p.cliente_email)})</small>
          </div>
          <span class="status ${p.status}">${nomesStatus[p.status] || p.status}</span>
        </div>
        <div class="itens">${itensHtml}</div>
        <div class="total">Total: ${dinheiro(p.total)}</div>
      `;
      const acoes = document.createElement('div');
      acoes.className = 'acoes';
      const sel = document.createElement('select');
      sel.style.maxWidth = '200px';
      sel.style.marginBottom = '0';
      Object.keys(nomesStatus).forEach(k => {
        const opt = document.createElement('option');
        opt.value = k; opt.textContent = nomesStatus[k];
        if (k === p.status) opt.selected = true;
        sel.appendChild(opt);
      });
      const btn = document.createElement('button');
      btn.className = 'principal'; btn.textContent = 'Atualizar status';
      btn.onclick = async () => {
        try {
          await api('/api/pedidos/' + p.id + '/status', { method: 'PUT', body: { status: sel.value } });
          mostrarToast('Status atualizado');
          renderPedidosAdmin();
        } catch (e) { mostrarToast(e.message); }
      };
      acoes.appendChild(sel); acoes.appendChild(btn);
      div.appendChild(acoes);
      lista.appendChild(div);
    });
  }

  init();
})();
