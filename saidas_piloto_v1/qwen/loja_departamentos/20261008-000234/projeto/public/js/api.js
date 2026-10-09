// Camada de comunicação com o servidor
const API = {
  async req(method, url, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const r = await fetch(url, opts);
    let data = null;
    try { data = await r.json(); } catch (e) { }
    if (!r.ok) {
      const msg = (data && data.erro) || 'Algo deu errado. Tente de novo.';
      const err = new Error(msg);
      err.status = r.status;
      throw err;
    }
    return data;
  },
  get: (u) => API.req('GET', u),
  post: (u, b) => API.req('POST', u, b),
  put: (u, b) => API.req('PUT', u, b),
  del: (u) => API.req('DELETE', u),

  login: (email, senha) => API.post('/api/login', { email, senha }),
  logout: () => API.post('/api/logout'),
  cadastro: (dados) => API.post('/api/cadastro', dados),
  getUser: () => API.get('/api/usuario'),

  getProdutos: () => API.get('/api/produtos'),
  getProduto: (id) => API.get('/api/produtos/' + id),

  adminGetProdutos: () => API.get('/api/admin/produtos'),
  adminCreateProduto: (dados) => API.post('/api/admin/produtos', dados),
  adminUpdateProduto: (id, dados) => API.put('/api/admin/produtos/' + id, dados),
  adminDeleteProduto: (id) => API.del('/api/admin/produtos/' + id),

  criarPedido: (items, endereco) => API.post('/api/pedidos', { items, endereco }),
  getPedidos: () => API.get('/api/pedidos'),

  adminGetPedidos: () => API.get('/api/admin/pedidos'),
  adminSetStatus: (id, status) => API.put('/api/admin/pedidos/' + id + '/status', { status })
};
