import htmx from "htmx.min.js";

/* ---------- helpers ---------- */
const state = { user: null, filter: { checkin: "", checkout: "" }, tab: "quartos", mgrTab: "bookings" };

function todayStr(){
  const d = new Date();
  const p = n => String(n).padStart(2,"0");
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());
}
function addDays(s, n){
  const d = new Date(s + "T00:00:00");
  d.setDate(d.getDate()+n);
  const p = x => String(x).padStart(2,"0");
  return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate());
}
function fmtDate(s){
  if(!s) return "";
  const p = s.split("-");
  return p.length===3 ? (p[2]+"/"+p[1]+"/"+p[0]) : s;
}
function fmtPrice(x){
  return (Number(x)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
}
function daysBetween(a,b){
  if(!a||!b) return 0;
  const ms = new Date(b+"T00:00:00") - new Date(a+"T00:00:00");
  return Math.round(ms/86400000);
}
const statusLabel = { pending:"Pendente", confirmed:"Confirmada", rejected:"Recusada", cancelled:"Cancelada" };
const statusChip  = { pending:"warn", confirmed:"ok", rejected:"bad", cancelled:"off" };

function toast(msg, kind){
  const box = document.getElementById("toasts") || (() => {
    const el = document.createElement("div"); el.id="toasts"; el.className="toasts";
    document.body.appendChild(el); return el;
  })();
  const t = document.createElement("div");
  t.className = "toast " + (kind||"");
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(()=>{ t.style.opacity="0"; t.style.transition="opacity .3s"; setTimeout(()=>t.remove(),300); }, 2600);
}

async function api(path, opts={}){
  const res = await fetch(path, {
    method: opts.method || "GET",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify(opts.body || {})
  });
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error || ("Erro " + res.status));
  return data;
}

/* ---------- root ---------- */
const root = document.getElementById("root");

function render(){
  if(!state.user){ root.innerHTML = authView(); return; }
  root.innerHTML = appView();
}

/* ---------- auth ---------- */
let authMode = "login";
function authView(){
  return `
  <div class="auth">
    <div class="auth-card">
      <div class="brand"><div class="logo">H</div><b>Hotel Azul</b></div>
      <div class="auth-tabs">
        <button id="t-login" class="${authMode==='login'?'active':''}">Entrar</button>
        <button id="t-reg" class="${authMode==='reg'?'active':''}">Criar conta</button>
      </div>
      <div id="auth-msg"></div>
      ${authMode==="login" ? `
        <form id="f-login">
          <div class="field"><label>Nome de usuário</label><input name="username" autocomplete="username" required></div>
          <div class="field"><label>Senha</label><input name="password" type="password" autocomplete="current-password" required></div>
          <button class="btn btn-primary btn-block" type="submit">Entrar</button>
        </form>` : `
        <form id="f-reg">
          <div class="field"><label>Nome de usuário</label><input name="username" autocomplete="username" required></div>
          <div class="field"><label>Nome completo</label><input name="name" required></div>
          <div class="field"><label>Senha</label><input name="password" type="password" autocomplete="new-password" required></div>
          <button class="btn btn-teal btn-block" type="submit">Criar conta de hóspede</button>
        </form>`}
      <div class="hint">Os dados ficam salvos no servidor — entre de qualquer lugar.</div>
    </div>
  </div>`;
}

function bindAuth(){
  const tl = document.getElementById("t-login"), tr = document.getElementById("t-reg");
  const msg = document.getElementById("auth-msg");
  const show = (txt, ok) => { msg.innerHTML = txt ? `<div class="form-msg ${ok?"ok":"err"}">${txt}</div>` : ""; };
  if(tl) tl.onclick = () => { authMode="login"; render(); };
  if(tr) tr.onclick = () => { authMode="reg"; render(); };
  const fl = document.getElementById("f-login");
  if(fl) fl.onsubmit = async e => {
    e.preventDefault();
    try{
      const fd = new FormData(fl);
      const data = await api("/api/login",{method:"POST",body:{username:fd.get("username"),password:fd.get("password")}});
      enter(data.user);
    }catch(err){ show(err.message); }
  };
  const fr = document.getElementById("f-reg");
  if(fr) fr.onsubmit = async e => {
    e.preventDefault();
    try{
      const fd = new FormData(fr);
      const data = await api("/api/register",{method:"POST",body:{
        username:fd.get("username"), name:fd.get("name"), password:fd.get("password")}});
      enter(data.user);
    }catch(err){ show(err.message); }
  };
}

function enter(user){
  state.user = user;
  try{ localStorage.setItem("ha_user", JSON.stringify(user)); }catch(e){}
  state.filter = { checkin:"", checkout:"" };
  toast("Olá, " + user.name.split(" ")[0] + "!", "ok");
  render();
}

function logout(){
  state.user = null;
  try{ localStorage.removeItem("ha_user"); }catch(e){}
  authMode = "login";
  render();
}

/* ---------- app shell ---------- */
function appView(){
  const isMgr = state.user.role === "manager";
  const tabs = isMgr
    ? [{id:"bookings",label:"Reservas"},{id:"rooms",label:"Quartos"}]
    : [{id:"quartos",label:"Quartos"},{id:"minhas",label:"Minhas reservas"}];
  const activeTab = isMgr ? state.mgrTab : state.tab;
  const content = isMgr ? managerView() : guestView();
  return `
  <div class="app">
    <div class="topbar"><div class="topbar-inner">
      <div class="logo">H</div>
      <div class="title">Hotel Azul <small>${isMgr ? "Painel do gerente" : "Reservas de hóspede"}</small></div>
      <div class="spacer"></div>
      <span class="badge-role">${isMgr?"Gerente":"Hóspede"} · ${state.user.name.split(" ")[0]}</span>
      <button class="btn-loginout" id="btn-out">Sair</button>
    </div></div>
    <div class="tabs">${tabs.map(t=>`<button class="tab ${t.id===activeTab?'active':''}" data-tab="${t.id}">${t.label}</button>`).join("")}</div>
    <div class="content" id="content"></div>
  </div>`;
}

function bindShell(){
  document.getElementById("btn-out").onclick = logout;
  document.querySelectorAll(".tab").forEach(b=>{
    b.onclick = ()=>{
      const id = b.dataset.tab;
      if(state.user.role==="manager") state.mgrTab=id; else state.tab=id;
      render();
    };
  });
  bindContent();
}

function bindContent(){
  const isMgr = state.user.role==="manager";
  if(isMgr){
    if(state.mgrTab==="bookings") bindManagerBookings();
    else bindManagerRooms();
  } else {
    if(state.tab==="quartos") bindGuestRooms();
    else bindGuestBookings();
  }
}

/* ---------- guest: rooms ---------- */
function guestView(){
  if(state.tab==="minhas") return guestBookingsView();
  const f = state.filter;
  const valid = !!(f.checkin && f.checkout && f.checkin < f.checkout);
  const minOut = f.checkin ? addDays(f.checkin,1) : "";
  return `
  <h2 class="section-title">Quartos disponíveis</h2>
  <p class="section-sub">Escolha as datas e reserve um quarto. Você também pode navegar sem datas.</p>
  <div class="filterbar">
    <div class="field"><label>Entrada</label><input type="date" id="f-in" value="${f.checkin}" min="${todayStr()}"></div>
    <div class="field"><label>Saída</label><input type="date" id="f-out" value="${f.checkout}" min="${minOut}"></div>
    <button class="btn btn-ghost" id="f-clear">Limpar</button>
    <div class="pill-count" id="pill"></div>
  </div>
  <div class="grid" id="rooms-grid"></div>`;
}

async function bindGuestRooms(){
  const fin = document.getElementById("f-in");
  const fout = document.getElementById("f-out");
  fin.min = todayStr();
  fin.onchange = async ()=>{ state.filter.checkin = fin.value;
    if(state.filter.checkout && state.filter.checkout <= fin.value) state.filter.checkout="";
    fout.min = state.filter.checkin ? addDays(state.filter.checkin,1):""; await loadGuestRooms(); };
  fout.onchange = async ()=>{ state.filter.checkout = fout.value; await loadGuestRooms(); };
  document.getElementById("f-clear").onclick = async ()=>{
    state.filter = {checkin:"",checkout:""}; await loadGuestRooms(); };
  await loadGuestRooms();
}

async function loadGuestRooms(){
  const f = state.filter;
  const grid = document.getElementById("rooms-grid");
  const pill = document.getElementById("pill");
  let rooms;
  try{ rooms = (await api("/api/rooms",{method:"POST",body:{user:state.user,checkin:f.checkin,checkout:f.checkout}})).rooms; }
  catch(err){ grid.innerHTML = `<div class="empty"><div class="big">!</div>${err.message}</div>`; return; }
  const valid = !!(f.checkin && f.checkout && f.checkin < f.checkout);
  const n = rooms.filter(r=>r.available_selected).length;
  pill.textContent = valid ? `${n} quarto(s) para ${fmtDate(f.checkin)} – ${fmtDate(f.checkout)}` : "Mostre os quartos selecionando datas acima";
  if(!rooms.length){ grid.innerHTML = `<div class="empty"><div class="big">🏨</div>Nenhum quarto cadastrado ainda.</div>`; return; }
  grid.innerHTML = rooms.map(r=>{
    const off = !r.available;
    const taken = off || (valid && !r.available_selected);
    const sub = off ? "Indisponível"
      : (taken ? "Ocupado nestas datas"
      : (valid ? "Disponível para suas datas" : "Disponível"));
    return `
    <div class="room-card">
      <div class="room-thumb">
        <span class="cap">${r.capacity} pessoas</span>
        <span class="type">${r.type}</span>
      </div>
      <div class="room-body">
        <div class="room-name">${r.name}</div>
        <div class="room-desc">${r.description||"–"}</div>
        <span class="chip ${taken?"off":"ok"}" style="margin-bottom:10px">${sub}</span>
        <div class="room-foot">
          <div class="price">${fmtPrice(r.price)}<small>/noite</small></div>
          <button class="btn btn-teal btn-sm" data-book="${r.id}" ${taken?"disabled style='opacity:.45;cursor:not-allowed'":""}>Reservar</button>
        </div>
      </div>
    </div>`;
  }).join("");
  grid.querySelectorAll("[data-book]").forEach(b=>{
    b.onclick = ()=>{ const r = rooms.find(x=>x.id==b.dataset.book); openBookingModal(r); };
  });
}

function openBookingModal(room){
  const f = state.filter;
  let inD = f.checkin || todayStr(), outD = f.checkout || addDays(inD,1);
  const ov = document.createElement("div");
  ov.className="overlay";
  ov.innerHTML = `
    <div class="modal">
      <h3>Reservar ${room.name}</h3>
      <div class="sub">${room.type} · até ${room.capacity} pessoas · ${fmtPrice(room.price)}/noite</div>
      <div class="two-col">
        <div class="field"><label>Entrada</label><input type="date" id="m-in" value="${inD}" min="${todayStr()}"></div>
        <div class="field"><label>Saída</label><input type="date" id="m-out" value="${outD}"></div>
      </div>
      <div class="field"><label>Nome do hóspede</label><input id="m-guest" value="${state.user.name}"></div>
      <div id="m-msg"></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="m-cancel">Cancelar</button>
        <button class="btn btn-teal" id="m-ok">Confirmar reserva</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const mi = ov.querySelector("#m-in"), mo = ov.querySelector("#m-out");
  mo.min = addDays(mi.value,1);
  mi.onchange = ()=> mo.min = addDays(mi.value,1);
  const msg = ov.querySelector("#m-msg");
  const say = (t,ok)=> msg.innerHTML = t?`<div class="form-msg ${ok?"ok":"err"}">${t}</div>`:"";
  ov.querySelector("#m-cancel").onclick = ()=> ov.remove();
  ov.querySelector("#m-ok").onclick = async ()=>{
    const checkin = mi.value, checkout = mo.value;
    if(!checkin||!checkout) return say("Escolha as datas.",false);
    if(checkin>=checkout) return say("Saída deve ser após a entrada.",false);
    try{
      await api("/api/bookings",{method:"POST",body:{user:state.user,room_id:room.id,checkin,checkout}});
      ov.remove();
      toast("Reserva criada!", "ok");
      state.tab="minhas"; render();
    }catch(err){ say(err.message,false); }
  };
}

/* ---------- guest: my bookings ---------- */
function guestBookingsView(){
  return `
    <h2 class="section-title">Minhas reservas</h2>
    <p class="section-sub">Veja e cancele as reservas que você fez.</p>
    <div id="my-list"></div>`;
}
async function bindGuestBookings(){
  const el = document.getElementById("my-list");
  let rows;
  try{ rows = (await api("/api/bookings",{method:"POST",body:{user:state.user}})).bookings; }
  catch(err){ el.innerHTML = `<div class="empty"><div class="big">!</div>${err.message}</div>`; return; }
  if(!rows.length){ el.innerHTML = `<div class="empty"><div class="big">🛏️</div>Você ainda não tem reservas. Vá em "Quartos".</div>`; return; }
  el.innerHTML = rows.map(b=>{
    const cancellable = (b.status==="pending"||b.status==="confirmed");
    return `
    <div class="book-card">
      <div class="book-main">
        <div class="book-room">${b.room_name}</div>
        <div class="book-dates">${fmtDate(b.checkin)} → ${fmtDate(b.checkout)} · ${daysBetween(b.checkin,b.checkout)} noite(s)</div>
        <div class="book-guest">${b.guest_name}</div>
        <div class="book-meta">Reservado em ${fmtDate((b.created_at||"").slice(0,10))}</div>
      </div>
      <div style="align-self:center"><span class="chip ${statusChip[b.status]}">${statusLabel[b.status]}</span></div>
      <div class="book-actions">
        ${cancellable ? `<button class="btn btn-danger btn-sm" data-cancel="${b.id}">Cancelar reserva</button>` : ""}
      </div>
    </div>`;
  }).join("");
  el.querySelectorAll("[data-cancel]").forEach(b=>{
    b.onclick = async ()=>{
      if(!confirm("Cancelar esta reserva?")) return;
      try{
        await api("/api/bookings/"+b.dataset.cancel+"/status",{method:"DELETE",body:{user:state.user}});
        toast("Reserva cancelada.", "ok");
        render();
      }catch(err){ toast(err.message,"err"); }
    };
  });
}

/* ---------- manager ---------- */
function managerView(){
  if(state.mgrTab==="rooms") return managerRoomsView();
  return managerBookingsView();
}

function managerBookingsView(){
  return `
    <div class="mgr-tabs">
      <button class="mgr-tab" data-mt="pending" data-filter="pending">Pendentes</button>
      <button class="mgr-tab" data-mt="all" data-filter="all">Todas</button>
    </div>
    <div id="mb-table"></div>`;
}

let mgrFilter = "pending";
function bindManagerBookings(){
  document.querySelectorAll("[data-mt]").forEach(b=>{
    b.className = "mgr-tab" + (b.dataset.mt===mgrFilter?" active":"");
    b.onclick = ()=>{ mgrFilter=b.dataset.mt; bindManagerBookings(); };
  });
  loadManagerBookings();
}

async function loadManagerBookings(){
  document.querySelectorAll("[data-mt]").forEach(b=> b.className = "mgr-tab" + (b.dataset.mt===mgrFilter?" active":""));
  const el = document.getElementById("mb-table");
  let rows;
  try{ rows = (await api("/api/bookings",{method:"POST",body:{user:state.user}})).bookings; }
  catch(err){ el.innerHTML = `<div class="empty"><div class="big">!</div>${err.message}</div>`; return; }
  if(mgrFilter==="pending") rows = rows.filter(r=>r.status==="pending");
  if(!rows.length){ el.innerHTML = `<div class="empty"><div class="big">✅</div>Nenhuma reserva aqui.</div>`; return; }
  el.innerHTML = `
    <div class="tbl-wrap"><table>
      <thead><tr>
        <th>Hóspede</th><th>Quarto</th><th>Datas</th><th>Noites</th><th>Status</th><th>Ações</th>
      </tr></thead>
      <tbody>
      ${rows.map(b=>{
        const acts = [];
        if(b.status==="pending"){
          acts.push(`<button class="btn btn-teal btn-sm" data-act="confirm" data-id="${b.id}">Confirmar</button>`);
          acts.push(`<button class="btn btn-ghost btn-sm" data-act="reject" data-id="${b.id}">Recusar</button>`);
        }
        if(b.status!=="cancelled"){
          acts.push(`<button class="btn btn-danger btn-sm" data-act="del" data-id="${b.id}">Excluir</button>`);
        }
        return `<tr>
          <td>${b.guest_name}<div style="font-size:12px;color:var(--muted)">${b.guest_username}</div></td>
          <td>${b.room_name}</td>
          <td>${fmtDate(b.checkin)} → ${fmtDate(b.checkout)}</td>
          <td>${daysBetween(b.checkin,b.checkout)}</td>
          <td><span class="chip ${statusChip[b.status]}">${statusLabel[b.status]}</span></td>
          <td><div class="actions-cell">${acts.join("")}</div></td>
        </tr>`;
      }).join("")}
      </tbody>
    </table></div>`;
  el.querySelectorAll("[data-act]").forEach(btn=>{
    btn.onclick = async ()=>{
      const id = btn.dataset.id, act = btn.dataset.act;
      try{
        if(act==="confirm") await api(`/api/bookings/${id}/status`,{method:"POST",body:{user:state.user,status:"confirmed"}});
        else if(act==="reject") await api(`/api/bookings/${id}/status`,{method:"POST",body:{state,user:state.user,status:"rejected"}});
        else { if(!confirm("Excluir esta reserva?")) return; await api("/api/bookings/"+id,{method:"DELETE",body:{user:state.user}}); }
        toast("Atualizado.", "ok");
        loadManagerBookings();
      }catch(err){ toast(err.message,"err"); }
    };
  });
}

/* manager rooms */
let editingRoomId = null;
function managerRoomsView(){
  return `
    <div style="display:flex; gap:10px; align-items:center; margin-bottom:16px; flex-wrap:wrap">
      <h2 class="section-title" style="margin:0">Quartos</h2>
      <div class="spacer"></div>
      <button class="btn btn-teal btn-sm" id="add-room">+ Novo quarto</button>
    </div>
    <div class="tbl-wrap" id="rm-table"></div>`;
}

function bindManagerRooms(){
  document.getElementById("add-room").onclick = ()=> openRoomModal(null);
  loadManagerRooms();
}

async function loadManagerRooms(){
  const el = document.getElementById("rm-table");
  let rooms;
  try{ rooms = (await api("/api/rooms",{method:"POST",body:{user:state.user}})).rooms; }
  catch(err){ el.innerHTML = `<div class="empty"><div class="big">!</div>${err.message}</div>`; return; }
  if(!rooms.length){ el.innerHTML = `<div class="empty"><div class="big">🏨</div>Nenhum quarto. Clique em “Novo quarto”.</div>`; return; }
  el.innerHTML = `<table>
    <thead><tr><th>Quarto</th><th>Tipo</th><th>Preço</th><th>Ocup.</th><th>Status</th><th>Ações</th></tr></thead>
    <tbody>
    ${rooms.map(r=>`<tr>
      <td><b>${r.name}</b><div style="font-size:12px;color:var(--muted)">${r.description||"–"}</div></td>
      <td>${r.type}</td>
      <td>${fmtPrice(r.price)}/noite</td>
      <td>${r.capacity}</td>
      <td>${r.status && r.status!=="pendente" ? `<span class="chip off">Indisponível</span>` : (r.available?`<span class="chip ok">Ativo</span>`:`<span class="chip off">Inativo</span>`)}</td>
      <td><div class="actions-cell">
        <button class="btn btn-ghost btn-sm" data-edit="${r.id}">Editar</button>
        <button class="btn btn-danger btn-sm" data-del="${r.id}">Excluir</button>
      </div></td>
    </tr>`).join("")}
    </tbody></table>`;
  el.querySelectorAll("[data-edit]").forEach(b=> b.onclick = ()=> openRoomModal(rooms.find(x=>x.id==b.dataset.edit)));
  el.querySelectorAll("[data-del]").forEach(b=> b.onclick = async ()=>{
    if(!confirm("Excluir este quarto?")) return;
    try{ await api("/api/rooms/"+b.dataset.del,{method:"DELETE",body:{user:state.user}}); toast("Quarto excluído.","ok"); loadManagerRooms(); }
    catch(err){ toast(err.message,"err"); }
  });
}

function openRoomModal(room){
  const ov = document.createElement("div");
  ov.className="overlay";
  const isEdit = !!room;
  ov.innerHTML = `
    <div class="modal">
      <h3>${isEdit?"Editar quarto":"Novo quarto"}</h3>
      <div class="sub">${isEdit?room.name:"Preencha os dados do quarto."}</div>
      <div class="field"><label>Nome do quarto</label><input id="r-name" value="${isEdit?room.name:""}" required></div>
      <div class="two-col">
        <div class="field"><label>Tipo</label>
          <select id="r-type">
            ${["Simples","Suíte","Apartamento","Luxo"].map(t=>`<option ${isEdit&&room.type===t?"selected":""}>${t}</option>`).join("")}
          </select></div>
        <div class="field"><label>Ocupação (pessoas)</label><input type="number" id="r-cap" min="1" value="${isEdit?room.capacity:2}"></div>
      </div>
      <div class="two-col">
        <div class="field"><label>Preço por noite (R$)</label><input type="number" step="0.01" id="r-price" value="${isEdit?room.price:""}"></div>
        <div class="field"><label>Disponível?</label>
          <select id="r-avail"><option value="1" ${isEdit&&room.available?"selected":""}>Sim</option><option value="0" ${isEdit&&!room.available?"selected":""}>Não</option></select></div>
      </div>
      <div class="field"><label>Descrição</label><textarea id="r-desc" rows="2">${isEdit?room.description:""}</textarea></div>
      <div id="r-msg"></div>
      <div class="modal-actions">
        <button class="btn btn-ghost" id="r-cancel">Cancelar</button>
        <button class="btn btn-teal" id="r-ok">${isEdit?"Salvar":"Cadastrar"}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const msg = ov.querySelector("#r-msg");
  const say = (t,ok)=> msg.innerHTML = t?`<div class="form-msg ${ok?"ok":"err"}">${t}</div>`:"";
  ov.querySelector("#r-cancel").onclick = ()=> ov.remove();
  ov.querySelector("#r-ok").onclick = async ()=>{
    const body = {
      name: ov.querySelector("#r-name").value.trim(),
      type: ov.querySelector("#r-type").value,
      capacity: ov.querySelector("#r-cap").value,
      price: ov.querySelector("#r-price").value,
      available: ov.querySelector("#r-avail").value==="1",
      description: ov.querySelector("#r-desc").value.trim()
    };
    try{
      if(isEdit) await api("/api/rooms/"+room.id,{method:"PUT",body:{user:state.user,...body}});
      else await api("/api/rooms",{method:"POST",body:{user:state.user,...body}});
      ov.remove(); toast(isEdit?"Quarto atualizado.":"Quarto cadastrado.","ok"); loadManagerRooms();
    }catch(err){ say(err.message,false); }
  };
}

/* ---------- boot ---------- */
function boot(){
  try{
    const u = JSON.parse(localStorage.getItem("ha_user"));
    if(u && u.id && u.role) state.user = u;
  }catch(e){}
  render();
  if(state.user) bindShell(); else bindAuth();
}
boot();
