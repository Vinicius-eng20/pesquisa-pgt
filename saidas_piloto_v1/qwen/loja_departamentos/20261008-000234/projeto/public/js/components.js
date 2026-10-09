// Componentes visuais reutilizáveis
const C = {};

C.header = function (state) {
  const u = state.user;
  const cartN = cartCount(state.cart);
  const cat = state.cat || '';
  let actions;
  if (u) {
    const isAd = u.papel === 'admin';
    actions = `
      <button class="hbtn" data-nav="${isAd ? 'admin' : 'pedidos'}">${ICON.box}<span class="hbtn-label">${isAd ? 'Painel' : 'Meus pedidos'}</span></button>
      ${isAd ? '<button class="hbtn" data-nav="loja">' + ICON.home + '<span class="hbtn-label">Loja</span></button>' : ''}
      <div class="header-actions" style="display:flex;align-items:center;gap:10px">
        <button class="hbtn" data-nav="carrinho" title="Carrinho">${ICON.bag}${cartN ? '<span class="cart-badge">' + cartN + '</span>' : ''}</button>
        <div style="display:flex;align-items:center;gap:9px;background:var(--paper-2);padding:5px 12px 5px 6px;border-radius:999px">
          <div class="avatar">${(u.nome || '?').charAt(0).toUpperCase()}</div>
          <span style="font-family:var(--font-head);font-weight:600;font-size:14px;max-width:90px;overflow:hidden;text-overflow:ellipsis">${escapeHtml(u.nome.split(' ')[0])}</span>
        </div>
        <button class="hbtn" data-logout title="Sair da conta" style="padding:11px">${ICON.logout}</button>
      </div>`;
  } else {
    actions = `
      <div class="header-actions">
        <button class="hbtn" data-nav="carrinho" title="Carrinho">${ICON.bag}${cartN ? '<span class="cart-badge">' + cartN + '</span>' : ''}</button>
        <button class="btn btn-primary btn-sm" data-nav="login">${ICON.user}<span>Entrar</span></button>
      </div>`;
  }

  return `
  <div class="topbar">
    <div class="marquee">
      <span>🚚 Frete grátis para compras acima de <b>R$ 399</b></span>
      <span>💳 Até <b>12x sem juros</b> no cartão</span>
      <span>↩️ Devolução fácil em até <b>30 dias</b></span>
      <span>🛡️ Compra 100% segura</span>
      <span>🚚 Frete grátis para compras acima de <b>R$ 399</b></span>
      <span>💳 Até <b>12x sem juros</b> no cartão</span>
      <span>↩️ Devolução fácil em até <b>30 dias</b></span>
      <span>🛡️ Compra 100% segura</span>
    </div>
  </div>
  <header class="site-header">
    <div class="header-inner">
      <div class="brand" data-nav="${u && u.papel === 'admin' ? 'admin' : 'loja'}">
        <div class="brand-mark">${ICON.bag}</div>
        <div class="brand-name">Central<small>Departamentos</small></div>
      </div>
      <div class="search">
        <span class="search-ic">${ICON.search}</span>
        <input id="busca" type="text" placeholder="Buscar produtos, marcas e mais…" value="${escapeHtml(state.q || '')}">
      </div>
      ${actions}
    </div>
  </header>`;
};

C.catStrip = function (state) {
  const cats = state.cats;
  const active = state.cat || '';
  const chips = [{ id: '', nome: 'Todos' }, ...cats].map(c =>
    `<button class="cat-chip ${active === c.id ? 'active' : ''}" data-cat="${escapeHtml(c.id)}">${escapeHtml(c.nome || c.id)}</button>`
  ).join('');
  return `<div class="cat-strip"><div class="cat-inner">${chips}</div></div>`;
};

C.hero = function () {
  return `
  <section class="hero">
    <div class="hero-grid">
      <div class="hero-main">
        <div class="hero-badge-float">★ 4.9 / 5</div>
        <div class="hero-kicker">Tudo em um só lugar</div>
        <h1 class="hero-title">Do eletrônico à cozinha, <em>tudo</em> para sua casa.</h1>
        <p class="hero-sub">Milhares de produtos de diversos departamentos com preços imbatíveis e entrega rápida.</p>
        <div class="hero-cta">
          <button class="btn btn-light" data-nav="loja" data-scroll="#produtos">Ver ofertas</button>
          <button class="btn btn-ghost" style="background:transparent;color:#fff;border:1.5px solid rgba(255,255,255,.3)" data-cat="Eletronicos">Eletrônicos</button>
        </div>
      </div>
      <div class="hero-side">
        <div class="hero-card a">
          <h4>Ofertas da semana</h4>
          <div class="big">-40%</div>
          <p>em uma seleção de itens selecionados</p>
          <span class="ic">🏷️</span>
        </div>
        <div class="hero-card b">
          <h4>Novidades</h4>
          <p>chegaram esta semana na loja</p>
          <span class="ic">✨</span>
        </div>
      </div>
    </div>
  </section>`;
};

C.productCard = function (p, i) {
  const out = p.quantidade <= 0;
  return `
  <article class="card" data-prod="${p.id}" style="animation-delay:${Math.min(i, 12) * 40}ms">
    <div class="card-media">
      ${imgWithFallback(p.imagem)}
      <span class="card-tag">${escapeHtml(p.categoria || 'Geral')}</span>
      ${out ? '' : '<button class="card-add" data-add="' + p.id + '" title="Adicionar ao carrinho">' + ICON.plus + '</button>'}
    </div>
    <div class="card-body">
      <div class="card-cat">${escapeHtml(p.categoria || 'Geral')}</div>
      <h3 class="card-name">${escapeHtml(p.nome)}</h3>
      <p class="card-desc">${escapeHtml(p.descricao || '')}</p>
      <div class="card-foot">
        <div class="price">${fmtPrice(p.preco)}</div>
        ${out ? '<span style="font-size:12px;color:#c02626;font-weight:600">Esgotado</span>' : '<button class="add-full" data-add="' + p.id + '">Adicionar</button>'}
      </div>
    </div>
  </article>`;
};

C.grid = function (state) {
  if (!state.list.length) {
    return `<div class="empty-state"><div class="big">🔍</div><h4>Nenhum produto encontrado</h4><p>Tente outra categoria ou termo de busca.</p></div>`;
  }
  return '<div class="grid">' + state.list.map((p, i) => C.productCard(p, i)).join('') + '</div>';
};

C.footer = function () {
  return `
  <footer class="site-footer">
    <div class="footer-inner">
      <div class="footer-brand">
        <div class="brand" style="color:#fff">
          <div class="brand-mark">${ICON.bag}</div>
          <div class="brand-name" style="color:#fff">Central<small style="color:var(--gold)">Departamentos</small></div>
        </div>
        <p>Loja virtual de departamentos: eletrônicos, moda, casa, esportes e beleza em um só lugar. Tudo dentro do próprio site.</p>
      </div>
      <div>
        <h5>Departamentos</h5>
        <span data-cat="Eletronicos">Eletrônicos</span>
        <span data-cat="Moda">Moda</span>
        <span data-cat="Casa e Cozinha">Casa &amp; Cozinha</span>
        <span data-cat="Esportes">Esportes</span>
