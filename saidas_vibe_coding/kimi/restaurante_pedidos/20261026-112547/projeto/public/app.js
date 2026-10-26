let me = null;
let menu = [];
let cart = new Map(); // menu_item_id -> qty

const $ = (sel) => document.querySelector(sel);

function fmtMoney(cents){
  return (cents/100).toLocaleString("pt-BR", { style:"currency", currency:"BRL" });
}

async function api(path, opts={}){
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) throw new Error(data.error || "Erro na requisição.");
  return data;
}

function show(id){
  for(const el of ["authCard","menuCard","myOrdersCard","managerCard"]){
    $("#"+el).classList.add("hidden");
  }
  $("#"+id).classList.remove("hidden");
}

function setAuthUI(){
  const logged = !!me;
  $("#btnLogout").classList.toggle("hidden", !logged);
  $("#btnGoManager").classList.toggle("hidden", !(logged && me.role === "manager"));

  if(!logged){
    show("authCard");
    return;
  }
  show("menuCard");
}

function setAuthMessage(msg){
  $("#authMsg").textContent = msg || "";
}

function setOrderMessage(msg){
  $("#orderMsg").textContent = msg || "";
}

function setMenuItemMessage(msg){
  $("#menuItemMsg").textContent = msg || "";
}

async function loadMe(){
  const { user } = await api("/api/me");
  me = user;
  setAuthUI();
}

async function loadMenu(){
  const { items } = await api("/api/menu");
  menu = items;
  renderMenu();
  renderCart();
}

function renderMenu(){
  const box = $("#menuList");
  box.innerHTML = "";
  const active = menu.filter(i => i.is_active === 1);

  if(active.length === 0){
    box.innerHTML = `<p class="muted">Nenhum item disponível no momento.</p>`;
    return;
  }

  for(const item of active){
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <h4>${escapeHtml(item.name)}</h4>
      <div class="muted">${escapeHtml(item.description || "")}</div>
      <div class="row between" style="margin-top:10px">
        <span class="price">${fmtMoney(item.price_cents)}</span>
        <div class="row">
          <button class="btn" data-add="${item.id}">Adicionar</button>
        </div>
      </div>
    `;
    box.appendChild(div);
  }

  box.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = Number(btn.getAttribute("data-add"));
      cart.set(id, (cart.get(id) || 0) + 1);
      renderCart();
    });
  });
}

function renderCart(){
  const box = $("#cartBox");
  const totalEl = $("#cartTotal");

  if(cart.size === 0){
    box.innerHTML = `<p class="muted">Adicione itens do cardápio.</p>`;
    totalEl.textContent = fmtMoney(0);
    return;
  }

  let total = 0;
  const rows = [];
  for(const [id, qty] of cart.entries()){
    const item = menu.find(i => i.id === id);
    if(!item) continue;
    const line = item.price_cents * qty;
    total += line;
    rows.push(`
      <div class="row between" style="padding:6px 0;border-bottom:1px solid var(--border)">
        <div>
          <div><strong>${escapeHtml(item.name)}</strong></div>
          <div class="muted small">${qty} × ${fmtMoney(item.price_cents)}</div>
        </div>
        <div class="row">
          <button class="btn" data-dec="${id}">-</button>
          <button class="btn" data-inc="${id}">+</button>
          <button class="btn danger" data-del="${id}">Remover</button>
        </div>
      </div>
    `);
  }

  box.innerHTML = rows.join("");
  totalEl.textContent = fmtMoney(total);

  box.querySelectorAll("[data-inc]").forEach(b => b.addEventListener("click", () => {
    const id = Number(b.getAttribute("data-inc"));
    cart.set(id, (cart.get(id) || 0) + 1);
    renderCart();
  }));
  box.querySelectorAll("[data-dec]").forEach(b => b.addEventListener("click", () => {
    const id = Number(b.getAttribute("data-dec"));
    const next = (cart.get(id) || 0) - 1;
    if(next <= 0) cart.delete(id); else cart.set(id, next);
    renderCart();
  }));
  box.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => {
    const id = Number(b.getAttribute("data-del"));
    cart.delete(id);
    renderCart();
  }));
}

async function placeOrder(){
  setOrderMessage("");
  if(cart.size === 0){
    setOrderMessage("Seu carrinho está vazio.");
    return;
  }

  const items = [...cart.entries()].map(([menu_item_id, quantity]) => ({ menu_item_id, quantity }));
  const r = await api("/api/orders", { method:"POST", body: JSON.stringify({ items }) });
  cart.clear();
  renderCart();
  setOrderMessage(`Pedido #${r.order_id} criado! Total: ${fmtMoney(r.total_cents)}`);
}

function statusBadge(status){
  const ok = status === "PRONTO" || status === "ENTREGUE";
  return `<span class="badge ${ok ? "ok":""}">${escapeHtml(status)}</span>`;
}

async function loadMyOrders(){
  const { orders } = await api("/api/my-orders");
  const box = $("#myOrdersList");
  box.innerHTML = "";

  if(orders.length === 0){
    box.innerHTML = `<p class="muted">Você ainda não fez pedidos.</p>`;
    return;
  }

  for(const o of orders){
    const div = document.createElement("div");
    div.className = "item";
    div.style.marginBottom = "10px";
    const itemsHtml = o.items.map(it => `
      <li>${escapeHtml(it.name)} — ${it.quantity} × ${fmtMoney(it.unit_price_cents)}</li>
    `).join("");
    div.innerHTML = `
      <div class="row between">
        <div><strong>Pedido #${o.id}</strong> <span class="muted small">(${escapeHtml(o.created_at)})</span></div>
        ${statusBadge(o.status)}
      </div>
      <ul class="muted">${itemsHtml}</ul>
      <div><strong>Total: ${fmtMoney(o.total_cents)}</strong></div>
    `;
    box.appendChild(div);
  }
}

/**
 * GERENTE
 */
async function managerLoadMenu(){
  const { items } = await api("/api/menu");
  const box = $("#managerMenuList");
  box.innerHTML = "";

  if(items.length === 0){
    box.innerHTML = `<p class="muted">Nenhum item cadastrado.</p>`;
    return;
  }

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr><th>Item</th><th>Preço</th><th>Ativo</th><th></th></tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  for(const it of items){
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div><strong>${escapeHtml(it.name)}</strong></div>
        <div class="muted small">${escapeHtml(it.description || "")}</div>
      </td>
      <td>${fmtMoney(it.price_cents)}</td>
      <td>${it.is_active ? "Sim" : "Não"}</td>
      <td class="row">
        <button class="btn" data-edit="${it.id}">Editar</button>
        <button class="btn danger" data-remove="${it.id}">Remover</button>
      </td>
    `;
    tbody.appendChild(tr);
  }

  box.appendChild(table);

  box.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => {
    const id = Number(b.getAttribute("data-edit"));
    const it = items.find(x => x.id === id);
    if(!it) return;

    const f = $("#menuItemForm");
    f.id.value = it.id;
    f.name.value = it.name;
    f.description.value = it.description;
    f.price.value = (it.price_cents/100).toFixed(2).replace(".", ",");
    f.is_active.checked = !!it.is_active;
    setMenuItemMessage("Editando item selecionado. Clique em Salvar.");
  }));

  box.querySelectorAll("[data-remove]").forEach(b => b.addEventListener("click", async () => {
    const id = Number(b.getAttribute("data-remove"));
    if(!confirm("Remover este item do cardápio?")) return;
    await api(`/api/manager/menu/${id}`, { method:"DELETE" });
    await managerLoadMenu();
    await loadMenu();
  }));
}

async function managerSaveMenuItem(ev){
  ev.preventDefault();
  setMenuItemMessage("");
  const f = ev.target;

  const payload = {
    name: f.name.value,
    description: f.description.value,
    price: String(f.price.value).replace(",", "."),
    is_active: f.is_active.checked
  };

  const id = Number(f.id.value || 0);
  if(id){
    await api(`/api/manager/menu/${id}`, { method:"PUT", body: JSON.stringify(payload) });
    setMenuItemMessage("Item atualizado.");
  }else{
    await api(`/api/manager/menu`, { method:"POST", body: JSON.stringify(payload) });
    setMenuItemMessage("Item cadastrado.");
  }

  f.reset();
  f.id.value = "";
  f.is_active.checked = true;

  await managerLoadMenu();
  await loadMenu();
}

async function managerLoadOrders(){
  const { orders } = await api("/api/manager/orders");
  const box = $("#allOrdersList");
  box.innerHTML = "";

  if(orders.length === 0){
    box.innerHTML = `<p class="muted">Nenhum pedido ainda.</p>`;
    return;
  }

  for(const o of orders){
    const div = document.createElement("div");
    div.className = "item";
    div.style.marginBottom = "10px";

    const itemsHtml = o.items.map(it => `
      <li>${escapeHtml(it.name)} — ${it.quantity} × ${fmtMoney(it.unit_price_cents)}</li>
    `).join("");

    div.innerHTML = `
      <div class="row between">
        <div>
          <div><strong>Pedido #${o.id}</strong> <span class="muted small">(${escapeHtml(o.created_at)})</span></div>
          <div class="muted small">Cliente: ${escapeHtml(o.customer_name)} — ${escapeHtml(o.customer_email)}</div>
        </div>
        ${statusBadge(o.status)}
      </div>
      <ul class="muted">${itemsHtml}</ul>
      <div class="row between">
        <strong>Total: ${fmtMoney(o.total_cents)}</strong>
        <div class="row">
          <select data-status="${o.id}">
            ${["RECEBIDO","EM_PREPARO","PRONTO","ENTREGUE","CANCELADO"].map(s =>
              `<option value="${s}" ${s===o.status?"selected":""}>${s}</option>`
            ).join("")}
          </select>
          <button class="btn primary" data-save="${o.id}">Salvar</button>
        </div>
      </div>
    `;
    box.appendChild(div);
  }

  box.querySelectorAll("[data-save]").forEach(btn => btn.addEventListener("click", async () => {
    const id = Number(btn.getAttribute("data-save"));
    const sel = box.querySelector(`select[data-status="${id}"]`);
    const status = sel.value;
    await api(`/api/manager/orders/${id}/status`, { method:"PUT", body: JSON.stringify({ status }) });
    await managerLoadOrders();
  }));
}

function escapeHtml(str){
  return String(str)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/**
 * EVENTOS
 */
function bindUI(){
  $("#tabLogin").addEventListener("click", () => {
    $("#tabLogin").classList.add("active");
    $("#tabRegister").classList.remove("active");
    $("#loginForm").classList.remove("hidden");
    $("#registerForm").classList.add("hidden");
    setAuthMessage("");
  });

  $("#tabRegister").addEventListener("click", () => {
    $("#tabRegister").classList.add("active");
    $("#tabLogin").classList.remove("active");
    $("#registerForm").classList.remove("hidden");
    $("#loginForm").classList.add("hidden");
    setAuthMessage("");
  });

  $("#loginForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    setAuthMessage("");
    const f = ev.target;
    try{
      await api("/api/login", { method:"POST", body: JSON.stringify({
        email: f.email.value,
        password: f.password.value
      })});
      await loadMe();
      await loadMenu();
      await loadMyOrders();
      if(me.role === "manager"){
        await managerLoadMenu();
        await managerLoadOrders();
      }
    }catch(e){
      setAuthMessage(e.message);
    }
  });

  $("#registerForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    setAuthMessage("");
    const f = ev.target;
    try{
      await api("/api/register", { method:"POST", body: JSON.stringify({
        name: f.name.value,
        email: f.email.value,
        password: f.password.value
      })});
      await loadMe();
      await loadMenu();
      await loadMyOrders();
    }catch(e){
      setAuthMessage(e.message);
    }
  });

  $("#btnLogout").addEventListener("click", async () => {
    await api("/api/logout", { method:"POST" });
    me = null;
    cart.clear();
    setAuthUI();
  });

  $("#btnGoMenu").addEventListener("click", async () => {
    if(!me) return;
    show("menuCard");
    await loadMenu();
  });

  $("#btnGoMyOrders").addEventListener("click", async () => {
    if(!me) return;
    show("myOrdersCard");
    await loadMyOrders();
  });

  $("#btnGoManager").addEventListener("click", async () => {
    if(!me || me.role !== "manager") return;
    show("managerCard");
    await managerLoadMenu();
    await managerLoadOrders();
  });

  $("#btnRefreshMenu").addEventListener("click", loadMenu);
  $("#btnPlaceOrder").addEventListener("click", async () => {
    try{ await placeOrder(); }
    catch(e){ setOrderMessage(e.message); }
  });

  $("#btnRefreshMyOrders").addEventListener("click", loadMyOrders);

  // Gerente
  $("#menuItemForm").addEventListener("submit", async (ev) => {
    try{ await managerSaveMenuItem(ev); }
    catch(e){ setMenuItemMessage(e.message); }
  });
  $("#btnClearForm").addEventListener("click", () => {
    const f = $("#menuItemForm");
    f.reset();
    f.id.value = "";
    f.is_active.checked = true;
    setMenuItemMessage("");
  });
  $("#btnReloadManagerMenu").addEventListener("click", managerLoadMenu);
  $("#btnReloadAllOrders").addEventListener("click", managerLoadOrders);
}

(async function main(){
  bindUI();
  await loadMe();
  if(me){
    await loadMenu();
    await loadMyOrders();
    if(me.role === "manager"){
      await managerLoadMenu();
      await managerLoadOrders();
    }
  }else{
    // Ainda assim carrega cardápio para “ver” sem login (se você preferir exigir login, dá pra mudar)
    await loadMenu().catch(() => {});
  }
})();
```

---

Se você me disser **onde quer hospedar** (ex.: “tenho um VPS com Ubuntu” ou “quero o jeito mais simples possível”), eu te passo um passo a passo bem direto para publicar com domínio e HTTPS.
