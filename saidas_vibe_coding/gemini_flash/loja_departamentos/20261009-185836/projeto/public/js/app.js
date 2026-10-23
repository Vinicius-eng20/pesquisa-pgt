const app = {
  currentUser: null,
  categories: [],
  products: [],
  cart: { items: [], total: 0 },
  activeCategory: 'todos',
  activeSort: 'recent',
  authMode: 'login',

  async init() {
    await this.checkAuth();
    await this.loadCategories();
    await this.loadProducts();
    if (this.currentUser) {
      await this.loadCart();
    }
  },

  showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = isError ? '#ef4444' : '#1e293b';
    toast.style.display = 'block';
    setTimeout(() => {
      toast.style.display = 'none';
    }, 3500);
  },

  async api(url, options = {}) {
    options.headers = options.headers || {};
    if (!(options.body instanceof FormData)) {
      options.headers['Content-Type'] = 'application/json';
    }
    const res = await fetch(url, options);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Erro na requisição');
    }
    return data;
  },

  formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  },

  async checkAuth() {
    try {
      const data = await this.api('/api/auth/me');
      this.currentUser = data.user;
      this.renderNav();
    } catch (e) {
      this.currentUser = null;
      this.renderNav();
    }
  },

  renderNav() {
    const nav = document.getElementById('userNavActions');
    const cartCount = this.cart.items.reduce((sum, item) => sum + item.quantity, 0);

    if (this.currentUser) {
      const isAdmin = this.currentUser.role === 'admin';
      nav.innerHTML = `
        ${isAdmin ? `
          <button class="action-btn" onclick="app.navigate('admin')">
            <i class="fa-solid fa-gauge-high"></i>
            <span>Painel do Dono</span>
          </button>
        ` : `
          <button class="action-btn" onclick="app.navigate('orders')">
            <i class="fa-solid fa-receipt"></i>
            <span>Meus Pedidos</span>
          </button>
        `}
        <button class="action-btn" onclick="app.toggleCart(true)">
          <i class="fa-solid fa-cart-shopping"></i>
          <span>Carrinho</span>
          <span class="badge-cart">${cartCount}</span>
        </button>
        <button class="action-btn" onclick="app.logout()" title="Sair">
          <i class="fa-solid fa-right-from-bracket"></i>
          <span>Sair (${this.currentUser.name.split(' ')[0]})</span>
        </button>
      `;
    } else {
      nav.innerHTML = `
        <button class="action-btn" onclick="app.openAuthModal('login')">
          <i class="fa-solid fa-arrow-right-to-bracket"></i>
          <span>Entrar / Cadastrar</span>
        </button>
        <button class="action-btn" onclick="app.openAuthModal('login')">
          <i class="fa-solid fa-cart-shopping"></i>
          <span>Carrinho</span>
          <span class="badge-cart">0</span>
        </button>
      `;
    }
  },

  async loadCategories() {
    try {
      this.categories = await this.api('/api/products/categories');
      const catList = document.getElementById('categoriesList');
      const quickDepts = document.getElementById('quickDepartments');
      const selectProdCat = document.getElementById('prodCategory');

      catList.innerHTML = `
        <li class="${this.activeCategory === 'todos' ? 'active' : ''}" onclick="app.filterByCategory('todos')">
          <i class="fa-solid fa-layer-group"></i> Todos os Departamentos
        </li>
      `;

      quickDepts.innerHTML = '';
      selectProdCat.innerHTML = '<option value="">Selecione o departamento</option>';

      this.categories.forEach(cat => {
        catList.innerHTML += `
          <li class="${this.activeCategory === cat.slug ? 'active' : ''}" onclick="app.filterByCategory('${cat.slug}')">
            <i class="${cat.icon}"></i> ${cat.name}
          </li>
        `;

        quickDepts.innerHTML += `
          <div class="quick-dept-card" onclick="app.filterByCategory('${cat.slug}')">
            <i class="${cat.icon}"></i>
            <span>${cat.name}</span>
          </div>
        `;

        selectProdCat.innerHTML += `<option value="${cat.id}">${cat.name}</option>`;
      });
    } catch (e) {
      console.error(e);
    }
  },

  async loadProducts() {
    const grid = document.getElementById('productsGrid');
    grid.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando produtos...</div>';

    try {
      let url = `/api/products?category=${this.activeCategory}&sort=${this.activeSort}`;
      const search = document.getElementById('searchInput').value.trim();
      if (search) url += `&search=${encodeURIComponent(search)}`;

      this.products = await this.api(url);
      document.getElementById('productCount').textContent = `${this.products.length} produtos encontrados`;

      if (this.products.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align: center; padding: 40px; background: #fff; border-radius: 8px;">
            <i class="fa-solid fa-box-open" style="font-size: 3rem; color: #94a3b8; margin-bottom: 12px;"></i>
            <h3>Nenhum produto encontrado neste departamento.</h3>
            <p class="text-muted">Tente buscar por outro termo ou selecione outro departamento acima.</p>
          </div>
        `;
        return;
      }

      grid.innerHTML = this.products.map(p => `
        <div class="product-card">
          <div class="product-img-wrapper">
            <img src="${p.image}" alt="${p.name}" onerror="this.src='https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=700&q=80'">
            <span class="product-dept-tag">${p.category_name}</span>
          </div>
          <div class="product-info">
            <h3 class="product-name" title="${p.name}">${p.name}</h3>
            <p class="product-desc">${p.description || 'Produto de alta qualidade disponível para envio imediato.'}</p>
            <span class="product-stock ${p.stock <= 3 ? 'low' : ''}">
              ${p.stock > 0 ? `<i class="fa-solid fa-check"></i> Em estoque: ${p.stock} unidades` : `<i class="fa-solid fa-xmark"></i> Esgotado no momento`}
            </span>
            <div class="product-price-row">
              <span class="product-price">${this.formatCurrency(p.price)}</span>
              <span class="product-installments">12x de ${this.formatCurrency(p.price / 12)}</span>
            </div>
            <button class="btn btn-primary btn-block" onclick="app.addToCart(${p.id})" ${p.stock <= 0 ? 'disabled' : ''}>
              <i class="fa-solid fa-cart-plus"></i> ${p.stock > 0 ? 'Adicionar ao Carrinho' : 'Indisponível'}
            </button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      grid.innerHTML = `<p class="text-danger">Erro ao carregar produtos: ${e.message}</p>`;
    }
  },

  filterByCategory(slug) {
    this.activeCategory = slug;
    document.querySelectorAll('.categories-list li').forEach(li => li.classList.remove('active'));
    this.navigate('home');

    const catItems = document.querySelectorAll('.categories-list li');
    catItems.forEach(el => {
      if (el.textContent.includes(slug) || (slug === 'todos' && el.textContent.includes('Todos'))) {
        el.classList.add('active');
      }
    });

    const currentCatObj = this.categories.find(c => c.slug === slug);
    document.getElementById('catalogHeading').textContent = currentCatObj ? currentCatObj.name : 'Todos os Produtos';
    this.loadProducts();
    this.scrollToProducts();
  },

  sortProducts(val) {
    this.activeSort = val;
    this.loadProducts();
  },

  searchProducts() {
    this.navigate('home');
    this.loadProducts();
    this.scrollToProducts();
  },

  scrollToProducts() {
    const el = document.getElementById('productsAnchor');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  },

  navigate(view) {
    document.getElementById('viewHome').classList.add('hidden');
    document.getElementById('viewOrders').classList.add('hidden');
    document.getElementById('viewAdmin').classList.add('hidden');

    if (view === 'home') {
      document.getElementById('viewHome').classList.remove('hidden');
    } else if (view === 'orders') {
      if (!this.currentUser) return this.openAuthModal('login');
      document.getElementById('viewOrders').classList.remove('hidden');
      this.loadCustomerOrders();
    } else if (view === 'admin') {
      if (!this.currentUser || this.currentUser.role !== 'admin') {
        this.showToast('Acesso permitido apenas para o dono da loja.', true);
        return this.navigate('home');
      }
      document.getElementById('viewAdmin').classList.remove('hidden');
      this.loadAdminData();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // CARRINHO PERSISTENTE (CROSS-DEVICE)
  async loadCart() {
    if (!this.currentUser) return;
    try {
      this.cart = await this.api('/api/cart');
      this.renderCart();
      this.renderNav();
    } catch (e) {
      console.error(e);
    }
  },

  async addToCart(productId) {
    if (!this.currentUser) {
      this.showToast('Faça login para colocar produtos no carrinho!');
      return this.openAuthModal('login');
    }

    try {
      await this.api('/api/cart/add', {
        method: 'POST',
        body: JSON.stringify({ product_id: productId, quantity: 1 })
      });
      await this.loadCart();
      this.showToast('Produto colocado no seu carrinho!');
      this.toggleCart(true);
    } catch (e) {
      this.showToast(e.message, true);
    }
  },

  async updateCartQty(productId, qty) {
    try {
      await this.api('/api/cart/update', {
        method: 'PUT',
        body: JSON.stringify({ product_id: productId, quantity: qty })
      });
      await this.loadCart();
    } catch (e) {
      this.showToast(e.message, true);
    }
  },

  async removeFromCart(productId) {
    try {
      await this.api(`/api/cart/remove/${productId}`, { method: 'DELETE' });
      await this.loadCart();
      this.showToast('Produto retirado do carrinho.');
    } catch (e) {
      this.showToast(e.message, true);
    }
  },

  renderCart() {
    const body = document.getElementById('cartBody');
    const totalEl = document.getElementById('cartTotalPrice');

    if (!this.cart.items || this.cart.items.length === 0) {
      body.innerHTML = `
        <div style="text-align: center; padding: 40px 10px;">
          <i class="fa-solid fa-basket-shopping" style="font-size: 3rem; color: #cbd5e1; margin-bottom: 14px;"></i>
          <p style="font-weight: 600; color: #64748b;">Seu carrinho está vazio.</p>
          <small class="text-muted">Aproveite nossos departamentos e coloque ofertas incríveis!</small>
        </div>
      `;
      totalEl.textContent = this.formatCurrency(0);
      return;
    }

    body.innerHTML = this.cart.items.map(item => `
      <div class="cart-item">
        <img src="${item.image}" alt="${item.name}" onerror="this.src='https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=700&q=80'">
        <div class="cart-item-details">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-price">${this.formatCurrency(item.price)}</div>
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="app.updateCartQty(${item.product_id}, ${item.quantity - 1})">-</button>
            <span><strong>${item.quantity}</strong></span>
            <button class="qty-btn" onclick="app.updateCartQty(${item.product_id}, ${item.quantity + 1})">+</button>
            <button class="btn btn-sm btn-outline" style="margin-left: auto; color: #ef4444;" onclick="app.removeFromCart(${item.product_id})">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    totalEl.textContent = this.formatCurrency(this.cart.total);
  },

  toggleCart(open) {
    const overlay = document.getElementById('cartOverlay');
    const drawer = document.getElementById('cartDrawer');
    if (open) {
      overlay.style.display = 'block';
      drawer.classList.add('open');
    } else {
      overlay.style.display = 'none';
      drawer.classList.remove('open');
    }
  },

  // AUTHENTICATION
  openAuthModal(mode = 'login') {
    this.setAuthMode(mode);
    this.openModal('authModal');
  },

  setAuthMode(mode) {
    this.authMode = mode;
    const isLogin = mode === 'login';
    document.getElementById('toggleLoginBtn').className = isLogin ? 'active' : '';
    document.getElementById('toggleRegisterBtn').className = isLogin ? '' : 'active';
    document.getElementById('registerNameGroup').classList.toggle('hidden', isLogin);
    document.getElementById('authModalTitle').innerHTML = isLogin ? '<i class="fa-solid fa-user"></i> Entrar na Loja' : '<i class="fa-solid fa-user-plus"></i> Criar Nova Conta';
    document.getElementById('authSubmitBtn').textContent = isLogin ? 'Entrar na Loja' : 'Finalizar Cadastro';
  },

  async handleAuthSubmit(event) {
    event.preventDefault();
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const name = document.getElementById('authName').value;

    const endpoint = this.authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = this.authMode === 'login' ? { email, password } : { name, email, password };

    try {
      const data = await this.api(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      this.currentUser = data.user;
      this.closeModal('authModal');
      this.showToast(data.message);
      this.renderNav();
      await this.loadCart();

      if (this.currentUser.role === 'admin') {
        this.navigate('admin');
      } else {
        this.loadProducts();
      }
    } catch (e) {
      this.showToast(e.message, true);
    }
  },

  async logout() {
    try {
      await this.api('/api/auth/logout', { method: 'POST' });
      this.currentUser = null;
      this.cart = { items: [], total: 0 };
      this.renderNav();
      this.navigate('home');
      this.showToast('Sessão encerrada.');
    } catch (e) {
      console.error(e);
    }
  },

  // CHECKOUT
  openCheckoutModal() {
    if (!this.currentUser) return this.openAuthModal('login');
    if (!this.cart.items || this.cart.items.length === 0) {
      return this.showToast('Coloque itens no carrinho antes de finalizar a compra.', true);
    }

    this.toggleCart(false);
    document.getElementById('summarySubtotal').textContent = this.formatCurrency(this.cart.total);
    document.getElementById('summaryTotal').textContent = this.formatCurrency(this.cart.total);
    this.openModal('checkoutModal');
  },

  async handleCheckout(event) {
    event.preventDefault();
    const shipping_address = document.getElementById('checkoutAddress').value;
    const payment_method = document.getElementById('checkoutPayment').value;

    try {
      const res = await this.api('/api/orders/checkout', {
        method: 'POST',
        body: JSON.stringify({ shipping_address, payment_method })
      });

      this.closeModal('checkoutModal');
      await this.loadCart();
      await this.loadProducts();
      this.showToast(`🎉 Pedido #${res.orderId} realizado com sucesso!`);
      this.navigate('orders');
    } catch (e) {
      this.showToast(e.message, true);
    }
  },

  // MEUS PEDIDOS (CLIENTE)
  async loadCustomerOrders() {
    const list = document.getElementById('customerOrdersList');
    list.innerHTML = '<div class="loading-spinner"><i class="fa-solid fa-circle-notch fa-spin"></i> Carregando seus pedidos...</div>';

    try {
      const orders = await this.api('/api/orders/my-orders');

      if (orders.length === 0) {
        list.innerHTML = `
          <div style="background: #fff; padding: 40px; text-align: center; border-radius: 8px;">
            <i class="fa-solid fa-box" style="font-size: 3rem; color: #94a3b8; margin-bottom: 12px;"></i>
            <h3>Você ainda não fez nenhum pedido.</h3>
            <p class="text-muted">Explore nossos departamentos e faça sua primeira compra agora mesmo!</p>
            <button class="btn btn-primary" style="margin-top: 14px;" onclick="app.navigate('home')">Explorar Produtos</button>
          </div>
        `;
        return;
      }

      list.innerHTML = orders.map(o => `
        <div class="order-card">
          <div class="order-card-header">
            <div>
              <strong>Pedido #${o.id}</strong>
              <div class="text-muted" style="font-size: 0.8rem;">Data: ${new Date(o.created_at).toLocaleString('pt-BR')}</div>
            </div>
            <div>
              <span class="status-badge status-${o.status.replace(/\s+/g, '_')}">${o.status}</span>
            </div>
          </div>
          <div style="margin-bottom: 12px;">
            <strong>Itens Comprados:</strong>
            <ul style="padding-left: 20px; margin-top: 6px; font-size: 0.9rem;">
              ${o.items.map(it => `
                <li>${it.quantity}x ${it.product_name} - ${this.formatCurrency(it.price * it.quantity)}</li>
              `).join('')}
            </ul>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 10px; font-size: 0.9rem;">
            <span><i class="fa-solid fa-location-dot"></i> <strong>Entrega:</strong> ${o.shipping_address} (${o.payment_method})</span>
            <span style="font-size: 1.15rem; font-weight: 800; color: #0066cc;">Total: ${this.formatCurrency(o.total)}</span>
          </div>
        </div>
      `).join('');
    } catch (e) {
      list.innerHTML = `<p class="text-danger">${e.message}</p>`;
    }
  },

  // PAINEL DO DONO (ADMIN)
  async loadAdminData() {
    try {
      const stats = await this.api('/api/admin/stats');
      document.getElementById('statRevenue').textContent = this.formatCurrency(stats.totalRevenue);
      document.getElementById('statOrders').textContent = stats.totalOrders;
      document.getElementById('statProducts').textContent = stats.totalProducts;
      document.getElementById('statCustomers').textContent = stats.totalCustomers;

      await this.loadAdminOrders();
      await this.loadAdminProducts();
    } catch (e) {
      console.error(e);
    }
  },

  switchAdminTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('adminTabOrders').classList.add('hidden');
    document.getElementById('adminTabProducts').classList.add('hidden');

    if (tab === 'orders') {
      document.querySelectorAll('.tab-btn')[0].classList.add('active');
      document.getElementById('adminTabOrders').classList.remove('hidden');
    } else {
      document.querySelectorAll('.tab-btn')[1].classList.add('active');
      document.getElementById('adminTabProducts').classList.remove('hidden');
    }
  },

  async loadAdminOrders() {
    const tbody = document.getElementById('adminOrdersTableBody');
    tbody.innerHTML = '<tr><td colspan="7">Carregando todos os pedidos...</td></tr>';

    try {
      const orders = await this.api('/api/admin/orders');
      if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Nenhum pedido realizado ainda.</td></tr>';
        return;
      }

      tbody.innerHTML = orders.map(o => `
        <tr>
          <td><strong>#${o.id}</strong></td>
          <td>${new Date(o.created_at).toLocaleDateString('pt-BR')}</td>
          <td>
            <strong>${o.customer_name}</strong><br>
            <small class="text-muted">${o.customer_email}</small>
          </td>
          <td>
            ${o.items.map(it => `<div>${it.quantity}x ${it.product_name}</div>`).join('')}
          </td>
          <td><strong>${this.formatCurrency(o.total)}</strong></td>
          <td>
            <select onchange="app.changeOrderStatus(${o.id}, this.value)" style="padding: 4px 8px; border-radius: 4px; font-weight: 600;">
              <option value="Pendente" ${o.status === 'Pendente' ? 'selected' : ''}>Pendente</option>
              <option value="Em Separação" ${o.status === 'Em Separação' ? 'selected' : ''}>Em Separação</option>
              <option value="Enviado" ${o.status === 'Enviado' ? 'selected' : ''}>Enviado</option>
              <option value="Entregue" ${o.status === 'Entregue' ? 'selected' : ''}>Entregue</option>
              <option value="Cancelado" ${o.status === 'Cancelado' ? 'selected' : ''}>Cancelado</option>
            </select>
          </td>
          <td><small>${o.shipping_address}</small></td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-danger">${e.message}</td></tr>`;
    }
  },

  async changeOrderStatus(orderId, newStatus) {
    try {
      await this.api(`/api/admin/orders/${orderId}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
      });
      this.showToast(`Situação do pedido #${orderId} atualizada para "${newStatus}"!`);
      this.loadAdminData();
    } catch (e) {
      this.showToast(e.message, true);
    }
  },

  async loadAdminProducts() {
    const tbody = document.getElementById('adminProductsTableBody');
    tbody.innerHTML = '<tr><td colspan="6">Carregando catálogo de produtos...</td></tr>';

    try {
      const products = await this.api('/api/products?sort=recent');
      tbody.innerHTML = products.map(p => `
        <tr>
          <td><img src="${p.image}" alt="${p.name}" onerror="this.src='https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=700&q=80'"></td>
          <td><strong>${p.name}</strong></td>
          <td><span class="badge-dept">${p.category_name}</span></td>
          <td>${this.formatCurrency(p.price)}</td>
          <td><span style="font-weight: bold; ${p.stock <= 3 ? 'color: red;' : ''}">${p.stock} un.</span></td>
          <td>
            <button class="btn btn-sm btn-outline" onclick="app.openEditProductModal(${p.id})"><i class="fa-solid fa-pen"></i></button>
            <button class="btn btn-sm btn-danger" onclick="app.deleteProduct(${p.id})"><i class="fa-solid fa-trash"></i></button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      tbody.innerHTML = `<tr><td colspan="6" class="text-danger">${e.message}</td></tr>`;
    }
  },

  openNewProductModal() {
    document.getElementById('productForm').reset();
    document.getElementById('prodEditId').value = '';
    document.getElementById('productModalTitle').innerHTML = '<i class="fa-solid fa-box-open"></i> Cadastrar Novo Produto';
    this.openModal('productModal');
  },

  async openEditProductModal(id) {
    try {
      const p = await this.api(`/api/products/${id}`);
      document.getElementById('prodEditId').value = p.id;
      document.getElementById('prodName').value = p.name;
      document.getElementById('prodCategory').value = p.category_id;
      document.getElementById('prodPrice').value = p.price;
      document.getElementById('prodStock').value = p.stock;
      document.getElementById('prodImageUrl').value = p.image.startsWith('http') ? p.image : '';
      document.getElementById('prodDescription').value = p.description || '';
      document.getElementById('productModalTitle').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar Produto';
      this.openModal('productModal');
    } catch (e) {
      this.showToast(e.message, true);
    }
  },

  async handleSaveProduct(event) {
    event.preventDefault();
    const editId = document.getElementById('prodEditId').value;
    const formData = new FormData();

    formData.append('name', document.getElementById('prodName').value);
    formData.append('category_id', document.getElementById('prodCategory').value);
    formData.append('price', document.getElementById('prodPrice').value);
    formData.append('stock', document.getElementById('prodStock').value);
    formData.append('description', document.getElementById('prodDescription').value);

    const imageUrl = document.getElementById('prodImageUrl').value;
    if (imageUrl) formData.append('image_url', imageUrl);

    const fileInput = document.getElementById('prodImageFile');
    if (fileInput.files.length > 0) {
      formData.append('image_file', fileInput.files[0]);
    }

    try {
      const url = editId ? `/api/products/${editId}` : '/api/products';
      const method = editId ? 'PUT' : 'POST';

      const res = await fetch(url, { method, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar produto');

      this.closeModal('productModal');
      this.showToast(editId ? 'Produto alterado com sucesso!' : 'Novo produto cadastrado no shopping!');
      await this.loadAdminProducts();
      await this.loadProducts();
    } catch (e) {
      this.showToast(e.message, true);
    }
  },

  async deleteProduct(id) {
    if (!confirm('Deseja realmente remover este produto do shopping?')) return;
    try {
      await this.api(`/api/products/${id}`, { method: 'DELETE' });
      this.showToast('Produto removido com sucesso!');
      await this.loadAdminProducts();
      await this.loadProducts();
    } catch (e) {
      this.showToast(e.message, true);
    }
  },

  // MODAIS
  openModal(modalId) {
    document.getElementById(modalId).classList.add('show');
  },

  closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
  }
};

document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
