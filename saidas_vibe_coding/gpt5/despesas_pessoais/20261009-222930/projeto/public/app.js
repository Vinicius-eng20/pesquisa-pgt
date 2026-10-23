function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function showMessage(id, text, type = "error") {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `message ${type}`;
  el.textContent = text;
}

function clearMessage(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = "message";
  el.textContent = "";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    credentials: "same-origin",
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Ocorreu um erro.");
  }

  return data;
}

async function logout() {
  await api("/api/logout", { method: "POST" });
  window.location.href = "/login.html";
}

async function requirePage(role) {
  try {
    const data = await api("/api/me");
    const userName = document.getElementById("userName");
    if (userName) userName.textContent = data.user.name;

    if (role && data.user.role !== role) {
      window.location.href = data.user.role === "admin" ? "/admin.html" : "/dashboard.html";
    }

    return data.user;
  } catch {
    window.location.href = "/login.html";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", logout);

  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearMessage("message");

      try {
        const data = await api("/api/login", {
          method: "POST",
          body: JSON.stringify({
            email: document.getElementById("email").value,
            password: document.getElementById("password").value
          })
        });

        window.location.href = data.role === "admin" ? "/admin.html" : "/dashboard.html";
      } catch (error) {
        showMessage("message", error.message);
      }
    });
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm) {
    registerForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      clearMessage("message");

      try {
        await api("/api/register", {
          method: "POST",
          body: JSON.stringify({
            name: document.getElementById("name").value,
            email: document.getElementById("email").value,
            password: document.getElementById("password").value
          })
        });

        window.location.href = "/dashboard.html";
      } catch (error) {
        showMessage("message", error.message);
      }
    });
  }

  if (document.body.dataset.page === "dashboard") {
    initDashboard();
  }

  if (document.body.dataset.page === "admin") {
    initAdmin();
  }
});

async function initDashboard() {
  await requirePage("user");

  const dateInput = document.getElementById("expense_date");
  const monthInput = document.getElementById("month");
  dateInput.value = today();
  monthInput.value = currentMonth();

  await loadCategories();
  await loadExpenses();

  document.getElementById("expenseForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage("expenseMessage");

    try {
      await api("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          description: document.getElementById("description").value,
          amount: document.getElementById("amount").value,
          category_id: document.getElementById("category_id").value,
          expense_date: document.getElementById("expense_date").value
        })
      });

      document.getElementById("description").value = "";
      document.getElementById("amount").value = "";
      document.getElementById("expense_date").value = today();

      showMessage("expenseMessage", "Despesa registrada com sucesso.", "success");
      await loadExpenses();
    } catch (error) {
      showMessage("expenseMessage", error.message);
    }
  });

  monthInput.addEventListener("change", loadExpenses);
}

async function loadCategories() {
  const data = await api("/api/categories");
  const select = document.getElementById("category_id");
  select.innerHTML = "";

  data.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    select.appendChild(option);
  });
}

async function loadExpenses() {
  const month = document.getElementById("month").value;
  const data = await api(`/api/expenses?month=${encodeURIComponent(month)}`);

  document.getElementById("monthTotal").textContent = money(data.total);

  const tbody = document.getElementById("expensesBody");
  tbody.innerHTML = "";

  if (data.expenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5">Nenhuma despesa encontrada neste mês.</td></tr>`;
    return;
  }

  data.expenses.forEach((expense) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${expense.expense_date.split("-").reverse().join("/")}</td>
      <td>${escapeHtml(expense.description)}</td>
      <td>${escapeHtml(expense.category_name)}</td>
      <td>${money(expense.amount)}</td>
      <td><button class="danger" data-id="${expense.id}">Excluir</button></td>
    `;

    tr.querySelector("button").addEventListener("click", async () => {
      if (!confirm("Deseja excluir esta despesa?")) return;
      await api(`/api/expenses/${expense.id}`, { method: "DELETE" });
      await loadExpenses();
    });

    tbody.appendChild(tr);
  });
}

async function initAdmin() {
  await requirePage("admin");

  await loadAdminAll();

  document.getElementById("categoryForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage("categoryMessage");

    try {
      await api("/api/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          name: document.getElementById("categoryName").value
        })
      });

      document.getElementById("categoryName").value = "";
      showMessage("categoryMessage", "Categoria criada com sucesso.", "success");
      await loadAdminAll();
    } catch (error) {
      showMessage("categoryMessage", error.message);
    }
  });
}

async function loadAdminAll() {
  await Promise.all([loadAdminSummary(), loadAdminUsers(), loadAdminCategories()]);
}

async function loadAdminSummary() {
  const data = await api("/api/admin/summary");

  document.getElementById("totalExpenses").textContent = money(data.totalExpenses);
  document.getElementById("totalUsers").textContent = data.totalUsers;
  document.getElementById("expenseCount").textContent = data.expenseCount;
}

async function loadAdminUsers() {
  const data = await api("/api/admin/users");
  const tbody = document.getElementById("usersBody");
  tbody.innerHTML = "";

  data.users.forEach((user) => {
    const tr = document.createElement("tr");

    const isAdmin = user.role === "admin";
    const nextActive = user.active ? false : true;

    tr.innerHTML = `
      <td>${escapeHtml(user.name)}</td>
      <td>${escapeHtml(user.email)}</td>
      <td>${isAdmin ? "Administrador" : "Usuário"}</td>
      <td><span class="badge ${user.active ? "active" : "inactive"}">${user.active ? "Ativo" : "Desativado"}</span></td>
      <td>${money(user.total_spent)}</td>
      <td>
        ${
          isAdmin
            ? "-"
            : `<button class="${user.active ? "danger" : "success"}">${user.active ? "Desativar" : "Reativar"}</button>`
        }
      </td>
    `;

    const button = tr.querySelector("button");
    if (button) {
      button.addEventListener("click", async () => {
        await api(`/api/admin/users/${user.id}/active`, {
          method: "PATCH",
          body: JSON.stringify({ active: nextActive })
        });
        await loadAdminUsers();
      });
    }

    tbody.appendChild(tr);
  });
}

async function loadAdminCategories() {
  const data = await api("/api/admin/categories");
  const tbody = document.getElementById("categoriesBody");
  tbody.innerHTML = "";

  data.categories.forEach((category) => {
    const tr = document.createElement("tr");
    const nextActive = category.active ? false : true;

    tr.innerHTML = `
      <td>${escapeHtml(category.name)}</td>
      <td><span class="badge ${category.active ? "active" : "inactive"}">${category.active ? "Ativa" : "Desativada"}</span></td>
      <td>${category.expense_count}</td>
      <td>${money(category.total_spent)}</td>
      <td><button class="${category.active ? "danger" : "success"}">${category.active ? "Desativar" : "Reativar"}</button></td>
    `;

    tr.querySelector("button").addEventListener("click", async () => {
      await api(`/api/admin/categories/${category.id}/active`, {
        method: "PATCH",
        body: JSON.stringify({ active: nextActive })
      });
      await loadAdminCategories();
      await loadCategoriesIfExists();
    });

    tbody.appendChild(tr);
  });
}

async function loadCategoriesIfExists() {
  if (document.getElementById("category_id")) {
    await loadCategories();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
