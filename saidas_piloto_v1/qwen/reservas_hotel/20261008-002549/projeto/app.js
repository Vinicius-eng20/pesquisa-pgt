(() => {
  "use strict";

  // ---------- Storage ----------
  const DB_KEY = "hotel_aurora_db_v1";
  const SESSION_KEY = "hotel_aurora_session_v1";
  const SALT_KEY = "hotel_aurora_salt_v1";
  const SALT_PREFIX = "hotel-aurora-2024";

  function getSalt() {
    let s = localStorage.getItem(SALT_KEY);
    if (!s) {
      s = (crypto.getRandomValues ? Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, "0")).join("") : Math.random().toString(36).repeat(6));
      localStorage.setItem(SALT_KEY, s);
    }
    return s;
  }

  // SHA-256 (pure JS) — evita depender de Web Crypto em contextos http
  function sha256(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let result = "";
    const words = [];
    const asciiBitLength = ascii.length * 8;
    let hash = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    ascii += "\x80";
    while ((ascii.length % 64) - 56) ascii += "\x00";
    for (let i = 0; i < ascii.length; i++) {
      const j = ascii.charCodeAt(i);
      if (j >> 8) return "";
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words.length] = (asciiBitLength / maxWord) | 0;
    words[words.length] = asciiBitLength;
    for (let j = 0; j < words.length; ) {
      const w = words.slice(j, j += 16);
      const oldHash = hash;
      hash = hash.slice(0, 8);
      for (let i = 0; i < 64; i++) {
        let a, b;
        if (i < 16) {
          a = w[i];
          b = w[(i + 14) % 16];
        } else {
          const w15 = w[i - 15], w2 = w[i - 2];
          a = w[(i + 14) % 16];
          a = (a + ((w15 >>> 7) | (w15 << 25)) + ((w15 >>> 18) | (w15 << 14)) + (w15 >>> 3)) | 0;
          b = w[(i + 14) % 16];
          b = (b + ((w2 >>> 17) | (w2 << 15)) + ((w2 >>> 19) | (w2 << 13)) + (w2 >>> 10)) | 0;
          w[i] = (a + b) | 0;
        }
        const c = (hash[4] + ((hash[0] >>> 2) | (hash[0] << 30)) + ((hash[0] >>> 13) | (hash[0] << 19)) + ((hash[0] >>> 22) | (hash[0] << 10))) | 0;
        const d = (hash[1] + ((hash[0] >>> 6) | (hash[0] << 26)) + ((hash[0] >>> 11) | (hash[0] << 21)) + ((hash[0] >>> 25) | (hash[0] << 7))) | 0;
        const e = ((hash[3] + ((hash[2] >>> 11) | (hash[2] << 21)) + ((hash[2] >>> 14) | (hash[2] << 18)) + ((hash[2] >>> 25) | (hash[2] << 7))) | 0) + c + k[i] + w[i] | 0;
        const f = (hash[0] + ((hash[3] >>> 14) | (hash[3] << 18)) + ((hash[3] >>> 18) | (hash[3] << 14)) + ((hash[3] >>> 23) | (hash[3] << 9))) | 0;
        hash = [((hash[1] + ((hash[0] >>> 14) | (hash[0] << 18)) + ((hash[0] >>> 18) | (hash[0] << 14)) + ((hash[0] >>> 23) | (hash[0] << 9)) + d + e) | 0), hash[0], hash[1], hash[2], hash[3], (hash[4] + f) | 0, c, d, e, f].slice(0, 8);
      }
      for (let i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }
    for (let i = 0; i < 8; i++) {
      for (let j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? "0" : "") + b.toString(16);
      }
    }
    return result;
  }

  function hashPassword(password) {
    return sha256(SALT_PREFIX + "::" + getSalt() + "::" + password);
  }

  function loadDB() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return { users: [], rooms: [], bookings: [] };
      const parsed = JSON.parse(raw);
      return {
        users: parsed.users || [],
        rooms: parsed.rooms || [],
        bookings: parsed.bookings || []
      };
    } catch { return { users: [], rooms: [], bookings: [] }; }
  }
  function saveDB(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---------- State ----------
  let db = loadDB();
  let currentUserId = localStorage.getItem(SESSION_KEY) || null;

  // ---------- DOM helpers ----------
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function toast(msg, type = "success") {
    const t = $("#toast");
    t.textContent = msg;
    t.className = "toast " + type;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.className = "toast hidden", 2600);
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  // ---------- Date helpers ----------
  function todayStr() {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  }
  function addDays(dateStr, days) {
    const d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
  function nightsBetween(a, b) {
    const d1 = new Date(a + "T00:00:00");
    const d2 = new Date(b + "T00:00:00");
    return Math.round((d2 - d1) / 86400000);
  }
  function overlaps(bStart, bEnd, qStart, qEnd) {
    // bEnd é a data de check-out (dia que sai). qStart/qEnd idem.
    return bStart < qEnd && qStart < bEnd;
  }
  function fmtDate(s) {
    if (!s) return "";
    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }

  // ---------- Access ----------
  function currentUser() {
    return db.users.find(u => u.id === currentUserId) || null;
  }
  function isOwner(u = currentUser()) {
    return u && u.role === "gerente" && u.isOwner;
  }

  // ---------- Booking availability ----------
  function isRoomAvailable(roomId, checkIn, checkOut) {
    const active = db.bookings.filter(b =>
      b.roomId === roomId &&
      ["pendente", "confirmada", "finalizada"].includes(b.status) &&
      overlaps(b.checkIn, b.checkOut, checkIn, checkOut)
    );
    return active.length === 0;
  }

  // ---------- Navigation ----------
  const routes = {
    home: { label: "Início", roles: ["hospede", "gerente"] },
    "minhas-reservas": { label: "Minhas Reservas", roles: ["hospede", "gerente"] },
    quartos: { label: "Quartos", roles: ["gerente"] },
    reservas: { label: "Reservas", roles: ["gerente"] },
    conta: { label: "Minha Conta", roles: ["hospede", "gerente"] },
    contas: { label: "Gerenciar Contas", roles: ["owner"] }
  };

  function setNav(route) {
    const user = currentUser();
    const nav = $("#nav");
    nav.innerHTML = "";
    for (const [key, cfg] of Object.entries(routes)) {
      const allowed = cfg.roles.includes("owner")
        ? isOwner(user)
        : cfg.roles.includes(user.role);
      if (!allowed) continue;
      const a = document.createElement("a");
      a.textContent = cfg.label;
      a.href = "#/" + key;
      if (key === route) a.classList.add("active");
      nav.appendChild(a);
    }
  }

  // ---------- Modal ----------
  function openModal(title, bodyHTML) {
    $("#modal-title").textContent = title;
    $("#modal-body").innerHTML = bodyHTML;
    $("#modal-overlay").classList.remove("hidden");
  }
  function closeModal() {
    $("#modal-overlay").classList.add("hidden");
  }
  $("#modal-close").addEventListener("click", closeModal);
  $("#modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeModal();
  });

  // ---------- Views: AUTH ----------
  function showAuth() {
    $("#app-view").classList.add("hidden");
    $("#auth-view").classList.remove("hidden");
  }

  function switchTab(tab) {
    $$(".tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    $("#login-form").classList.toggle("active", tab === "login");
    $("#register-form").classList.toggle("active", tab === "register");
  }
  $$(".tab").forEach(t => t.addEventListener("click", () => switchTab(t.dataset.tab)));

  let regRole = "hospede";
  $$("#reg-role .seg-btn").forEach(b => b.addEventListener("click", () => {
    $$("#reg-role .seg-btn").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    regRole = b.dataset.value;
  }));

  $("#login-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("#login-email").value.trim().toLowerCase();
    const password = $("#login-password").value;
    const err = $("#login-error");
    err.textContent = "";
    const user = db.users.find(u => u.email === email);
    if (!user || user.passwordHash !== hashPassword(password)) {
      err.textContent = "E-mail ou senha inválidos.";
      return;
    }
    currentUserId = user.id;
    localStorage.setItem(SESSION_KEY, currentUserId);
    enterApp();
  });

  $("#register-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const err = $("#register-error");
    err.textContent = "";
    const name = $("#reg-name").value.trim();
    const email = $("#reg-email").value.trim().toLowerCase();
    const password = $("#reg-password").value;
    const confirm = $("#reg-confirm").value;

    if (!name || !email || !password) { err.textContent = "Preencha todos os campos."; return; }
    if (password.length < 4) { err.textContent = "A senha deve ter ao menos 4 caracteres."; return; }
    if (password !== confirm) { err.textContent = "As senhas não conferem."; return; }
    if (db.users.some(u => u.email === email)) { err.textContent = "Já existe uma conta com esse e-mail."; return; }

    const existingOwner = db.users.some(u => u.role === "gerente" && u.isOwner);
    const isOwnerAccount = (regRole === "gerente") && !existingOwner;

    const user = {
      id: genId(),
      name, email,
      role: regRole,
      passwordHash: hashPassword(password),
      isOwner: !!isOwnerAccount,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    saveDB(db);
    currentUserId = user.id;
    localStorage.setItem(SESSION_KEY, currentUserId);
    toast("Conta criada com sucesso!");
    enterApp();
  });

  // ---------- Views: APP shell ----------
  function enterApp() {
    const user = currentUser();
    if (!user) { showAuth(); return; }
    $("#auth-view").classList.add("hidden");
    $("#app-view").classList.remove("hidden");
    $("#user-name").textContent = user.name;
    $("#user-role").textContent = user.isOwner ? "Gerente principal" : (user.role === "gerente" ? "Gerente" : "Hóspede");
    $("#user-avatar").textContent = user.name.charAt(0).toUpperCase();
    window.location.hash = window.location.hash || "#/home";
    render();
  }

  $("#logout-btn").addEventListener("click", () => {
    currentUserId = null;
    localStorage.removeItem(SESSION_KEY);
    window.location.hash = "";
    showAuth();
    // reset forms
    $("#login-form").reset();
    $("#register-form").reset();
    switchTab("login");
  });

  window.addEventListener("hashchange", render);

  function render() {
    const user = currentUser();
    if (!user) { showAuth(); return; }
    setNav(user);
    const route = (window.location.hash || "#/home").slice(2);
    const main = $("#main");
    const allowed = isAllowedRoute(user, route);
    if (!allowed) {
      main.innerHTML = `<div class="empty">Página indisponível.</div>`;
      return;
    }
    if (route === "home") viewHome(main);
    else if (route === "minhas-reservas") viewMyBookings(main);
    else if (route === "quartos") viewRooms(main);
    else if (route === "reservas") viewBookings(main);
    else if (route === "conta") viewProfile(main);
    else if (route === "contas") viewAccounts(main);
    else main.innerHTML = `<div class="empty">Página não encontrada.</div>`;
  }

  function isAllowedRoute(user, route) {
    const cfg = routes[route];
    if (!cfg) return false;
    if (cfg.roles.includes("owner")) return isOwner(user);
    return cfg.roles.includes(user.role);
  }

  // ---------- Views: HOSPEDE (home + minhas reservas) ----------
  function viewHome(main) {
    const rooms = db.rooms;
    main.innerHTML = `
      <h2 class="page-title">Escolha seu quarto</h2>
      <p class="page-desc">Veja a disponibilidade nas datas que preferir e reserve em poucos cliques.</p>
      ${rooms.length === 0 ? `<div class="empty">Ainda não há quartos cadastrados. Volte em breve.</div>` : `
        <div class="filter-bar">
          <label>Check-in <input type="date" id="f-checkin" value="${todayStr()}" /></label>
          <label>Check-out <input type="date" id="f-checkout" value="${addDays(todayStr(), 1)}" /></label>
          <button class="btn ghost" id="f-clear" type="button">Limpar</button>
        </div>
        <div class="grid" id="room-grid"></div>
      `}
    `;
    if (rooms.length === 0) return;

    const g = $("#room-grid");
    function refresh() {
      const ci = $("#f-checkin").value;
      const co = $("#f-checkout").value;
      const valid = ci && co && co > ci;
      g.innerHTML = rooms.map(room => {
        const avail = !valid || isRoomAvailable(room.id, ci, co);
        const nights = valid ? nightsBetween(ci, co) : 0;
        const total = valid ? nights * room.price : 0;
        return `
          <div class="card">
            <div class="thumb">${room.image ? `<img src="${esc(room.image)}" alt="" />` : "🛏️"}</div>
            <h3>${esc(room.name)}</h3>
            <div class="meta">${esc(room.type)} • ${esc(room.capacity)} pessoa(s)</div>
            <div class="price">R$ ${room.price.toLocaleString("pt-BR")} <span style="color:var(--muted);font-size:12px">/noite</span></div>
            ${valid ? `
              <div class="meta" style="color:${avail ? "var(--success)" : "var(--danger)"}">${avail ? "Disponível" : "Indisponível"} nas datas</div>
              ${avail ? `<div class="meta" style="color:var(--primary);font-weight:600">Total: R$ ${total.toLocaleString("pt-BR")}</div>` : ""}
            ` : `<div class="meta" style="color:var(--muted)">Escolha as datas para ver a disponibilidade.</div>`}
            <div class="actions">
              <button class="btn primary" data-book="${room.id}" ${avail ? "" : "disabled"} style="${avail ? "" : "opacity:.5;cursor:not-allowed"}">Reservar</button>
            </div>
          </div>`;
      }).join("");
      g.querySelectorAll("[data-book]").forEach(b => b.addEventListener("click", () => {
        openBookingModal(b.dataset.book);
      }));
    }
    $("#f-checkin").addEventListener("change", refresh);
    $("#f-checkout").addEventListener("change", refresh);
    $("#f-clear").addEventListener("click", () => {
      $("#f-checkin").value = todayStr();
      $("#f-checkout").value = addDays(todayStr(), 1);
      refresh();
    });
    refresh();
  }

  function openBookingModal(roomId) {
    const room = db.rooms.find(r => r.id === roomId);
    if (!room) return;
    const user = currentUser();
    openModal("Reservar quarto", `
      <form id="booking-form">
        <div style="display:flex;gap:12px;align-items:center;padding:12px;background:#f9fafb;border-radius:10px;margin-bottom:4px">
          <div class="thumb" style="width:64px;height:64px">${room.image ? `<img src="${esc(room.image)}" alt="" style="width:64px;height:64px" />` : "🛏️"}</div>
          <div>
            <strong>${esc(room.name)}</strong><br/>
            <span style="color:var(--muted);font-size:13px">${esc(room.type)} • R$ ${room.price}/noite</span>
          </div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <label style="flex:1;min-width:140px">
            <span>Check-in</span>
            <input type="date" id="b-checkin" value="${todayStr()}" />
          </label>
          <label style="flex:1;min-width:140px">
            <span>Check-out</span>
            <input type="date" id="b-checkout" value="${addDays(todayStr(), 1)}" />
          </label>
        </div>
        <label>
          <span>Nome do hóspede</span>
          <input type="text" id="b-guest" value="${esc(user.name)}" />
        </label>
        <label>
          <span>Observações (opcional)</span>
          <textarea id="b-notes" rows="3" placeholder="Ex.: quarto silencioso, criança extra..."></textarea>
        </label>
        <div id="b-avail" style="font-size:13px"></div>
        <div class="btn-row">
          <button type="button" class="btn ghost" onclick="document.getElementById('modal-close').click()">Cancelar</button>
          <button type="submit" class="btn primary" id="b-submit">Confirmar reserva</button>
        </div>
        <p class="error" id="b-error"></p>
      </form>
    `);

    const ci = $("#b-checkin"), co = $("#b-checkout");
    function check() {
      const a = ci.value, b = co.value;
      const el = $("#b-avail");
      const submit = $("#b-submit");
      if (!a || !b || b <= a) {
        el.textContent = "Escolha uma data de check-out posterior ao check-in.";
        el.style.color = "var(--danger)";
        submit.disabled = true;
        return;
      }
      const nights = nightsBetween(a, b);
      const ok = isRoomAvailable(room.id, a, b);
      submit.disabled = !ok;
      if (ok) {
        el.innerHTML = `<span style="color:var(--success);font-weight:600">Disponível</span> • ${nights} noite(s) • Total: <strong>R$ ${(nights * room.price).toLocaleString("pt-BR")}</strong>`;
      } else {
        el.innerHTML = `<span style="color:var(--danger);font-weight:600">Indisponível</span> nas datas escolhidas.`;
      }
    }
    ci.addEventListener("change", check);
    co.addEventListener("change", check);
    check();

    $("#booking-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const a = ci.value, b = co.value;
      const guest = $("#b-guest").value.trim();
      const notes = $("#b-notes").value.trim();
      const err = $("#b-error");
      err.textContent = "";
      if (!guest) { err.textContent = "Informe o nome do hóspede."; return; }
      if (b <= a) { err.textContent = "Check-out deve ser depois do check-in."; return; }
      if (!isRoomAvailable(room.id, a, b)) { err.textContent = "O quarto ficou indisponível. Tente outras datas."; return; }

      db.bookings.push({
        id: genId(),
        roomId: room.id,
        userId: currentUserId,
        guest: guest,
        checkIn: a,
        checkOut: b,
        status: "pendente",
        notes: notes || "",
        createdAt: new Date().toISOString()
      });
      saveDB(db);
      closeModal();
      toast("Reserva enviada! Aguardando confirmação do hotel.");
      if (window.location.hash !== "#/minhas-reservas") {
        window.location.hash = "#/minhas-reservas";
      } else {
        render();
      }
    });
  }

  function viewMyBookings(main) {
    const user = currentUser();
    const mine = db.bookings
      .filter(b => b.userId === user.id)
      .sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1));

    main.innerHTML = `
      <h2 class="page-title">Minhas Reservas</h2>
      <p class="page-desc">Acompanhe o status, cancele reservas pendentes ou finalize as concluídas.</p>
      ${mine.length === 0 ? `<div class="empty">Você ainda não fez nenhuma reserva. <a href="#/home" style="color:var(--primary);font-weight:600">Ver quartos disponíveis</a>.</div>` : `
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Quarto</th><th>Datas</th><th>Valor</th><th>Status</th><th>Ações</th></tr>
            </thead>
            <tbody id="my-res-body"></tbody>
          </table>
        </div>`
      }
    `;
    const tbody = $("#my-res-body");
    tbody.innerHTML = mine.map(b => {
      const room = db.rooms.find(r => r.id === b.roomId);
      const nights = nightsBetween(b.checkIn, b.checkOut);
      const total = room ? nights * room.price : 0;
      let actions = "";
      if (b.status === "pendente") actions = `<button class="btn danger small" data-cancel="${b.id}">Cancelar</button>`;
      else if (b.status === "confirmada" && todayStr() >= b.checkOut) actions = `<button class="btn success small" data-done="${b.id}">Finalizar estadia</button>`;
      else actions = `<span style="color:var(--muted);font-size:13px">—</span>`;
      return `
        <tr>
          <td><strong>${esc(room ? room.name : "Quarto removido")}</strong><br/><span style="color:var(--muted);font-size:12px">${esc(b.guest)}</span></td>
          <td>${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)}<br/><span style="color:var(--muted);font-size:12px">${nights} noite(s)</span></td>
          <td>R$ ${total.toLocaleString("pt-BR")}</td>
          <td><span class="badge ${b.status}">${b.status}</span></td>
          <td>${actions}</td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll("[data-cancel]").forEach(el => el.addEventListener("click", () => {
      if (!confirm("Cancelar esta reserva?")) return;
      const b = db.bookings.find(x => x.id === el.dataset.cancel);
      b.status = "cancelada";
      saveDB(db);
      toast("Reserva cancelada.");
      render();
    }));
    tbody.querySelectorAll("[data-done]").forEach(el => el.addEventListener("click", () => {
      const b = db.bookings.find(x => x.id === el.dataset.done);
      b.status = "finalizada";
      saveDB(db);
      toast("Estadia finalizada. Obrigado por vir!");
      render();
    }));
  }

  // ---------- Views: GERENTE ----------
  function viewRooms(main) {
    const rooms = db.rooms;
    main.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h2 class="page-title" style="margin:0">Quartos</h2>
        <button class="btn primary" id="add-room" type="button">+ Novo quarto</button>
      </div>
      ${rooms.length === 0 ? `<div class="empty">Nenhum quarto cadastrado. Clique em "Novo quarto".</div>` : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Quarto</th><th>Tipo</th><th>Cap.</th><th>Preço/noite</th><th>Ações</th></tr></thead>
            <tbody id="rooms-body"></tbody>
          </table>
        </div>`
      }
    `;
    $("#add-room").addEventListener("click", () => openRoomModal(null));
    const tbody = $("#rooms-body");
    tbody.innerHTML = rooms.map(r => `
      <tr>
        <td><strong>${esc(r.name)}</strong></td>
        <td>${esc(r.type)}</td>
        <td>${esc(r.capacity)}</td>
        <td>R$ ${r.price.toLocaleString("pt-BR")}</td>
        <td>
          <button class="btn ghost small" data-edit="${r.id}">Editar</button>
          <button class="btn danger small" data-del="${r.id}">Remover</button>
        </td>
      </tr>`).join("");
    tbody.querySelectorAll("[data-edit]").forEach(el => el.addEventListener("click", () => openRoomModal(el.dataset.edit)));
    tbody.querySelectorAll("[data-del]").forEach(el => el.addEventListener("click", () => {
      const id = el.dataset.del;
      const bCount = db.bookings.filter(b => b.roomId === id && b.status !== "cancelada" && b.status !== "recusada").length;
      if (bCount && !confirm(`Este quarto tem ${bCount} reserva(s) ativa(s). Remover mesmo assim? As reservas ficarão marcadas como de "Quarto removido".`)) return;
      if (!confirm("Remover este quarto?")) return;
      db.rooms = db.rooms.filter(r => r.id !== id);
      saveDB(db);
      toast("Quarto removido.");
      render();
    }));
  }

  function openRoomModal(id) {
    const existing = id ? db.rooms.find(r => r.id === id) : null;
    openModal(existing ? "Editar quarto" : "Novo quarto", `
      <form id="room-form">
        <label><span>Nome *</span><input type="text" id="r-name" value="${esc(existing ? existing.name : "")}" placeholder="Ex.: Suíte Master" required /></label>
        <label><span>Tipo *</span><input type="text" id="r-type" value="${esc(existing ? existing.type : "")}" placeholder="Ex.: Casal, Solteiro, Família" required /></label>
        <label><span>Capacidade (pessoas) *</span><input type="number" id="r-cap" min="1" value="${existing ? existing.capacity : 2}" required /></label>
        <label><span>Preço por noite (R$) *</span><input type="number" id="r-price" min="0" step="1" value="${existing ? existing.price : 0}" required /></label>
        <label><span>Imagem (opcional)</span>
          <input type="file" id="r-image" accept="image/*" />
          <div class="file-preview ${existing && existing.image ? "" : "empty"}" id="r-prev">${existing && existing.image ? `<img src="${esc(existing.image)}" alt="" />` : "Sem imagem"}</div>
        </label>
        <div class="btn-row">
          <button type="button" class="btn ghost" onclick="document.getElementById('modal-close').click()">Cancelar</button>
          <button type="submit" class="btn primary">${existing ? "Salvar" : "Cadastrar"}</button>
        </div>
        <p class="error" id="r-error"></p>
      </form>
    `);

    const fileInput = $("#r-image");
    const prev = $("#r-prev");
    let pendingImage = existing ? existing.image : null;
    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) { pendingImage = existing ? "" : null; prev.className = "file-preview empty"; prev.textContent = "Sem imagem"; return; }
      const reader = new FileReader();
      reader.onload = (e) => {
        pendingImage = e.target.result;
        prev.className = "file-preview";
        prev.innerHTML = `<img src="${e.target.result}" alt="" />`;
      };
      reader.readAsDataURL(file);
    });

    $("#room-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const err = $("#r-error");
      err.textContent = "";
      const name = $("#r-name").value.trim();
      const type = $("#r-type").value.trim();
      const capacity = parseInt($("#r-cap").value, 10);
      const price = parseFloat($("#r-price").value);
      if (!name || !type) { err.textContent = "Preencha nome e tipo."; return; }
      if (!(capacity >= 1)) { err.textContent = "Capacidade inválida."; return; }
      if (!(price >= 0)) { err.textContent = "Preço inválido."; return; }

      if (existing) {
        Object.assign(existing, { name, type, capacity, price, image: pendingImage || "" });
      } else {
        db.rooms.push({ id: genId(), name, type, capacity, price, image: pendingImage || "" });
      }
      saveDB(db);
      closeModal();
      toast(existing ? "Quarto atualizado." : "Quarto cadastrado.");
      render();
    });
  }

  function viewBookings(main) {
    const all = db.bookings
      .sort((a, b) => (a.checkIn < b.checkIn ? 1 : -1));
    const statusFilter = { pendente: 0, confirmada: 0, recusada: 0, cancelada: 0, finalizada: 0 };
    all.forEach(b => statusFilter[b.status]++);

    main.innerHTML = `
      <h2 class="page-title">Reservas</h2>
      <p class="page-desc">Todas as reservas de todos os hóspedes. Clique para confirmar ou recusar.</p>
      <div class="filter-bar">
        <div class="grow"></div>
        ${Object.entries(statusFilter).map(([k, n]) => `<span style="font-size:13px;color:var(--muted)"><span class="badge ${k}" style="margin-right:6px">${k}</span>${n}</span>`).join("")}
      </div>
      ${all.length === 0 ? `<div class="empty">Nenhuma reserva ainda.</div>` : `
        <div class="table-wrap">
          <table>
            <thead><tr><th>Hóspede</th><th>Conta</th><th>Quarto</th><th>Datas</th><th>Valor</th><th>Status</th><th>Ações</th></tr></thead>
            <tbody id="bk-body"></tbody>
          </table>
        </div>`
      }
    `;
    const tbody = $("#bk-body");
    tbody.innerHTML = all.map(b => {
      const room = db.rooms.find(r => r.id === b.roomId);
      const owner = db.users.find(u => u.id === b.userId);
      const nights = nightsBetween(b.checkIn, b.checkOut);
      const total = room ? nights * room.price : 0;
      let actions = `<span style="color:var(--muted);font-size:13px">—</span>`;
      if (b.status === "pendente") {
        actions = `
          <button class="btn success small" data-confirm="${b.id}">Confirmar</button>
          <button class="btn danger small" data-reject="${b.id}">Recusar</button>`;
      }
      return `
        <tr>
          <td><strong>${esc(b.guest)}</strong></td>
          <td style="color:var(--muted);font-size:13px">${esc(owner ? owner.email : "—")}</td>
          <td>${esc(room ? room.name : "Quarto removido")}</td>
          <td>${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)}</td>
          <td>R$ ${total.toLocaleString("pt-BR")}</td>
          <td><span class="badge ${b.status}">${b.status}</span></td>
          <td>${actions}</td>
        </tr>`;
    }).join("");
    tbody.querySelectorAll("[data-confirm]").forEach(el => el.addEventListener("click", () => {
      const b = db.bookings.find(x => x.id === el.dataset.confirm);
      b.status = "confirmada";
      saveDB(db);
      toast("Reserva confirmada.");
      render();
    }));
    tbody.querySelectorAll("[data-reject]").forEach(el => el.addEventListener("click", () => {
      if (!confirm("Recusar esta reserva?")) return;
      const b = db.bookings.find(x => x.id === el.dataset.reject);
      b.status = "recusada";
      saveDB(db);
      toast("Reserva recusada.");
      render();
    }));
  }

  function viewProfile(main) {
    const u = currentUser();
    main.innerHTML = `
      <h2 class="page-title">Minha Conta</h2>
      <div class="profile">
        <div class="avatar">${esc(u.name.charAt(0).toUpperCase())}</div>
        <div class="profile-info">
          <h2>${esc(u.name)}</h2>
          <p>${esc(u.email)}</p>
          <span class="tag">${u.isOwner ? "Gerente principal" : (u.role === "gerente" ? "Gerente" : "Hóspede")}</span>
        </div>
      </div>
    `;
  }

  function viewAccounts(main) {
    const users = db.users;
    main.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h2 class="page-title" style="margin:0">Gerenciar Contas</h2>
        <button class="btn primary" id="add-user" type="button">+ Nova conta de hóspede</button>
      </div>
      <p class="page-desc">Apenas o gerente principal pode criar contas. Use isso para cadastrar hóspedes do hotel.</p>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>E-mail</th><th>Tipo</th><th>Contato</th></tr></thead>
          <tbody id="ac-body"></tbody>
        </table>
      </div>
    `;
    $("#add-user").addEventListener("click", () => {
      openModal("Nova conta de hóspede", `
        <form id="ac-form">
          <label><span>Nome *</span><input type="text" id="ac-name" required /></label>
          <label><span>E-mail *</span><input type="email" id="ac-email" required /></label>
          <label><span>Senha inicial *</span><input type="text" id="ac-pass" required minlength="4" placeholder="Sugira uma senha temporária" /></label>
          <p class="hint">Entregue a senha inicial ao hóspede. Ele pode alterá-la após o login (se quiser, adicione um campo de troca de senha no perfil depois).</p>
          <div class="btn-row">
            <button type="button" class="btn ghost" onclick="document.getElementById('modal-close').click()">Cancelar</button>
            <button type="submit" class="btn primary">Criar conta</button>
          </div>
          <p class="error" id="ac-error"></p>
        </form>
      `);
      $("#ac-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const err = $("#ac-error");
        err.textContent = "";
        const name = $("#ac-name").value.trim();
        const email = $("#ac-email").value.trim().toLowerCase();
        const pass = $("#ac-pass").value;
        if (!name || !email) { err.textContent = "Preencha todos os campos."; return; }
        if (pass.length < 4) { err.textContent = "Senha muito curta."; return; }
        if (db.users.some(u => u.email === email)) { err.textContent = "E-mail já cadastrado."; return; }
        db.users.push({
          id: genId(),
          name, email,
          role: "hospede",
          passwordHash: hashPassword(pass),
          isOwner: false,
          createdAt: new Date().toISOString()
        });
        saveDB(db);
        closeModal();
        toast("Conta criada.");
        render();
      });
    });

    const tbody = $("#ac-body");
    tbody.innerHTML = users.map(u => `
      <tr>
        <td><strong>${esc(u.name)}</strong></td>
        <td style="color:var(--muted)">${esc(u.email)}</td>
        <td><span class="tag">${u.isOwner ? "Gerente principal" : (u.role === "gerente" ? "Gerente" : "Hóspede")}</span></td>
        <td><span style="color:var(--muted);font-size:13px">Criada em ${fmtDate(u.createdAt.slice(0, 10))}</span></td>
      </tr>`).join("");
  }

  // ---------- Init ----------
  (function init() {
    // garante salt
    getSalt();
    const user = currentUser();
    if (user) enterApp();
    else showAuth();
  })();
})();
