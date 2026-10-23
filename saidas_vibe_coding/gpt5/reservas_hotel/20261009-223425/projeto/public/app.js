let currentUser = null;
let lastSearch = null;

const authView = document.getElementById("authView");
const guestView = document.getElementById("guestView");
const managerView = document.getElementById("managerView");
const nav = document.getElementById("nav");
const toast = document.getElementById("toast");

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const searchForm = document.getElementById("searchForm");
const availableRooms = document.getElementById("availableRooms");
const myReservations = document.getElementById("myReservations");

const roomForm = document.getElementById("roomForm");
const roomFormTitle = document.getElementById("roomFormTitle");
const cancelEditRoom = document.getElementById("cancelEditRoom");
const managerRooms = document.getElementById("managerRooms");
const managerReservations = document.getElementById("managerReservations");

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3500);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Erro ao comunicar com o servidor.");
  }

  return data;
}

function money(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function statusText(status) {
  return {
    pending: "Pendente",
    confirmed: "Confirmada",
    rejected: "Recusada",
    cancelled: "Cancelada"
  }[status] || status;
}

function formatDate(date) {
  return new Date(date + "T00:00:00").toLocaleDateString("pt-BR");
}

function setTodayLimits() {
  const today = new Date().toISOString().slice(0, 10);
  searchForm.checkin.min = today;
  searchForm.checkout.min = today;
}

function renderNav() {
  if (!currentUser) {
    nav.innerHTML = "";
    return;
  }

  nav.innerHTML = `
    <span>Olá, <strong>${escapeHtml(currentUser.name)}</strong></span>
    <button class="secondary" id="logoutBtn">Sair</button>
  `;

  document.getElementById("logoutBtn").onclick = async () => {
    await api("/api/logout", { method: "POST" });
    currentUser = null;
    renderApp();
  };
}

function renderApp() {
  renderNav();

  authView.classList.toggle("hidden", !!currentUser);
  guestView.classList.toggle("hidden", !currentUser || currentUser.role !== "guest");
  managerView.classList.toggle("hidden", !currentUser || currentUser.role !== "manager");

  if (currentUser?.role === "guest") {
    loadMyReservations();
  }

  if (currentUser?.role === "manager") {
    loadManagerRooms();
    loadManagerReservations();
  }
}

function escapeHtml(text) {
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const form = new FormData(loginForm);
    const data = await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        email: form.get("email"),
        password: form.get("password")
      })
    });

    currentUser = data.user;
    loginForm.reset();
    renderApp();
    showToast("Login realizado com sucesso.");
  } catch (error) {
    showToast(error.message);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  try {
    const form = new FormData(registerForm);
    const data = await api("/api/register", {
      method: "POST",
      body: JSON.stringify({
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password")
      })
    });

    currentUser = data.user;
    registerForm.reset();
    renderApp();
    showToast("Conta criada com sucesso.");
  } catch (error) {
    showToast(error.message);
  }
});

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = new FormData(searchForm);
  lastSearch = {
    checkin: form.get("checkin"),
    checkout: form.get("checkout"),
    guests: form.get("guests")
  };

  await loadAvailableRooms();
});

searchForm.checkin.addEventListener("change", () => {
  searchForm.checkout.min = searchForm.checkin.value;
});

async function loadAvailableRooms() {
  if (!lastSearch) return;

  try {
    availableRooms.innerHTML = `<div class="empty">Buscando quartos disponíveis...</div>`;

    const params = new URLSearchParams(lastSearch);
    const data = await api(`/api/rooms/available?${params}`);

    if (data.rooms.length === 0) {
      availableRooms.innerHTML = `<div class="empty">Nenhum quarto disponível para estas datas.</div>`;
      return;
    }

    availableRooms.innerHTML = data.rooms.map(room => `
      <article class="card">
        ${room.image ? `<img class="room-img" src="${escapeHtml(room.image)}" alt="${escapeHtml(room.name)}">` : ""}
        <h3>${escapeHtml(room.name)}</h3>
        <p>${escapeHtml(room.description)}</p>
        <div class="meta">
          <span class="badge">Até ${room.capacity} hóspedes</span>
          <span class="badge">${money(room.price)} / diária</span>
        </div>
        <button onclick="createReservation(${room.id})">Reservar</button>
      </article>
    `).join("");
  } catch (error) {
    availableRooms.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

async function createReservation(roomId) {
  if (!lastSearch) {
    showToast("Escolha as datas antes de reservar.");
    return;
  }

  try {
    await api("/api/reservations", {
      method: "POST",
      body: JSON.stringify({
        roomId,
        checkin: lastSearch.checkin,
        checkout: lastSearch.checkout,
        guests: Number(lastSearch.guests)
      })
    });

    showToast("Reserva criada. Aguarde confirmação do gerente.");
    await loadAvailableRooms();
    await loadMyReservations();
  } catch (error) {
    showToast(error.message);
  }
}

async function loadMyReservations() {
  try {
    const data = await api("/api/my-reservations");

    if (data.reservations.length === 0) {
      myReservations.innerHTML = `<div class="empty">Você ainda não tem reservas.</div>`;
      return;
    }

    myReservations.innerHTML = data.reservations.map(res => `
      <article class="card">
        ${res.room_image ? `<img class="room-img" src="${escapeHtml(res.room_image)}" alt="${escapeHtml(res.room_name)}">` : ""}
        <h3>${escapeHtml(res.room_name)}</h3>
        <div class="meta">
          <span class="badge ${res.status}">${statusText(res.status)}</span>
          <span class="badge">${formatDate(res.checkin)} até ${formatDate(res.checkout)}</span>
          <span class="badge">${res.guests} hóspede(s)</span>
          <span class="badge">${money(res.room_price)} / diária</span>
        </div>
        ${["pending", "confirmed"].includes(res.status) ? `
          <button class="danger" onclick="cancelReservation(${res.id})">Cancelar reserva</button>
        ` : ""}
      </article>
    `).join("");
  } catch (error) {
    myReservations.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

async function cancelReservation(id) {
  if (!confirm("Tem certeza que deseja cancelar esta reserva?")) return;

  try {
    await api(`/api/my-reservations/${id}/cancel`, { method: "POST" });
    showToast("Reserva cancelada.");
    await loadMyReservations();
    if (lastSearch) await loadAvailableRooms();
  } catch (error) {
    showToast(error.message);
  }
}

roomForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const form = new FormData(roomForm);
  const id = form.get("id");

  const payload = {
    name: form.get("name"),
    description: form.get("description"),
    capacity: Number(form.get("capacity")),
    price: Number(form.get("price")),
    image: form.get("image"),
    active: roomForm.active.checked
  };

  try {
    if (id) {
      await api(`/api/manager/rooms/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      showToast("Quarto atualizado.");
    } else {
      await api("/api/manager/rooms", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showToast("Quarto cadastrado.");
    }

    resetRoomForm();
    await loadManagerRooms();
  } catch (error) {
    showToast(error.message);
  }
});

cancelEditRoom.addEventListener("click", resetRoomForm);

function resetRoomForm() {
  roomForm.reset();
  roomForm.id.value = "";
  roomForm.active.checked = true;
  roomFormTitle.textContent = "Cadastrar quarto";
  cancelEditRoom.classList.add("hidden");
}

async function loadManagerRooms() {
  try {
    const data = await api("/api/manager/rooms");

    if (data.rooms.length === 0) {
      managerRooms.innerHTML = `<div class="empty">Nenhum quarto cadastrado.</div>`;
      return;
    }

    managerRooms.innerHTML = data.rooms.map(room => `
      <article class="card">
        ${room.image ? `<img class="room-img" src="${escapeHtml(room.image)}" alt="${escapeHtml(room.name)}">` : ""}
        <h3>${escapeHtml(room.name)}</h3>
        <p>${escapeHtml(room.description)}</p>
        <div class="meta">
          <span class="badge">Até ${room.capacity} hóspedes</span>
          <span class="badge">${money(room.price)} / diária</span>
          <span class="badge ${room.active ? "confirmed" : "cancelled"}">${room.active ? "Ativo" : "Inativo"}</span>
        </div>
        <div class="row">
          <button onclick='editRoom(${JSON.stringify(room).replaceAll("'", "&apos;")})'>Editar</button>
          <button class="danger" onclick="deleteRoom(${room.id})">Remover</button>
        </div>
      </article>
    `).join("");
  } catch (error) {
    managerRooms.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

function editRoom(room) {
  roomForm.id.value = room.id;
  roomForm.name.value = room.name;
  roomForm.description.value = room.description;
  roomForm.capacity.value = room.capacity;
  roomForm.price.value = room.price;
  roomForm.image.value = room.image || "";
  roomForm.active.checked = !!room.active;
  roomFormTitle.textContent = "Editar quarto";
  cancelEditRoom.classList.remove("hidden");
  roomForm.scrollIntoView({ behavior: "smooth" });
}

async function deleteRoom(id) {
  if (!confirm("Tem certeza que deseja remover este quarto?")) return;

  try {
    await api(`/api/manager/rooms/${id}`, { method: "DELETE" });
    showToast("Quarto removido ou desativado.");
    await loadManagerRooms();
  } catch (error) {
    showToast(error.message);
  }
}

async function loadManagerReservations() {
  try {
    const data = await api("/api/manager/reservations");

    if (data.reservations.length === 0) {
      managerReservations.innerHTML = `<div class="empty">Nenhuma reserva encontrada.</div>`;
      return;
    }

    managerReservations.innerHTML = data.reservations.map(res => `
      <article class="card">
        <h3>Reserva #${res.id} - ${escapeHtml(res.room_name)}</h3>
        <p><strong>Hóspede:</strong> ${escapeHtml(res.guest_name)} (${escapeHtml(res.guest_email)})</p>
        <div class="meta">
          <span class="badge ${res.status}">${statusText(res.status)}</span>
          <span class="badge">${formatDate(res.checkin)} até ${formatDate(res.checkout)}</span>
          <span class="badge">${res.guests} hóspede(s)</span>
          <span class="badge">${money(res.room_price)} / diária</span>
        </div>
        ${res.status === "pending" ? `
          <div class="row">
            <button class="success" onclick="changeReservationStatus(${res.id}, 'confirmed')">Confirmar</button>
            <button class="warning" onclick="changeReservationStatus(${res.id}, 'rejected')">Recusar</button>
          </div>
        ` : ""}
      </article>
    `).join("");
  } catch (error) {
    managerReservations.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

async function changeReservationStatus(id, status) {
  try {
    await api(`/api/manager/reservations/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status })
    });

    showToast(status === "confirmed" ? "Reserva confirmada." : "Reserva recusada.");
    await loadManagerReservations();
  } catch (error) {
    showToast(error.message);
  }
}

async function init() {
  setTodayLimits();

  try {
    const data = await api("/api/me");
    currentUser = data.user;
  } catch {
    currentUser = null;
  }

  renderApp();
}

init();
