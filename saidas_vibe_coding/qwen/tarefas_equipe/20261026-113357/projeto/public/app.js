const state = {
  usuario: null,
  config: { status: [], prioridades: [] },
  users: [],
  tasks: [],
  filtro: "todas",
  busca: "",
  polling: null
};

const $ = (id) => document.getElementById(id);

/* ---------- helpers ---------- */
function slug(s) {
  return String(s || "A fazer").replace(/[^a-z0-9]/gi, "");
}
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function iniciais(nome) {
  return String(nome || "?").split(" ").filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
}
function formatarData(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("pt-BR");
}
function estaAtrasada(task) {
  if (!task.dataEntrega || task.status === "Concluída") return false;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const d = new Date(task.dataEntrega + "T00:00:00");
  return d < hoje;
}
function ehGerente() { return state.usuario && state.usuario.papel === "gerente"; }
function estouAtribuido(task) {
  return (task.atribuidas || []).some(a => a.userId === state.usuario.id);
}

/* ---------- api ---------- */
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Algo deu errado.");
  return data;
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, tipo = "") {
  const el = $("toast");
  el.textContent = msg;
  el.className = "toast " + tipo;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 3200);
}

/* ---------- auth ---------- */
$("tab-login").addEventListener("click", () => trocarAba("login"));
$("tab-registro").addEventListener("click", () => trocarAba("registro"));

function trocarAba(aba) {
  const eLogin = aba === "login";
  $("tab-login").classList.toggle("active", eLogin);
  $("tab-registro").classList.toggle("active", !eLogin);
  $("form-login").classList.toggle("hidden", !eLogin);
  $("form-registro").classList.toggle("hidden", eLogin);
  $("login-erro").textContent = "";
  $("reg-erro").textContent = "";
}

$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-erro").textContent = "";
  try {
    const { usuario } = await api("/api/auth/login", {
      method: "POST",
      body: { email: $("login-email").value, senha: $("login-senha").value }
    });
    entrar(usuario);
  } catch (err) {
    $("login-erro").textContent = err.message;
  }
});

$("form-registro").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("reg-erro").textContent = "";
  try {
    const { usuario } = await api("/api/auth/registro", {
      method: "POST",
      body: {
        nome: $("reg-nome").value,
        email: $("reg-email").value,
        senha: $("reg-senha").value
      }
    });
    entrar(usuario, usuario.papel === "gerente");
  } catch (err) {
    $("reg-erro").textContent = err.message;
  }
});

$("btn-logout").addEventListener("click", async () => {
  try { await api("/api/auth/logout", { method: "POST" }); } catch (e) {}
  pararPolling();
  state.usuario = null;
  location.reload();
});

async function entrar(usuario, ehPrimeiro = false) {
  state.usuario = usuario;
  await carregarDados();
  mostrarApp(ehPrimeiro);
}

function mostrarApp(ehPrimeiro) {
  $("auth-screen").classList.add("hidden");
  $("app-screen").classList.remove("hidden");
  $("user-nome").textContent = state.usuario.nome;
  $("user-papel").textContent = ehGerente() ? "Gerente" : "Membro";
  montarFiltros();
  render();
  iniciarPolling();
  if (ehPrimeiro) {
    toast("Conta de gerente criada! Convide a equipe para criar as demais contas.", "ok");
  }
}

/* ---------- dados ---------- */
async function carregarDados() {
  const [cfg, us, tk] = await Promise.all([
    api("/api/config"),
    api("/api/users"),
    api("/api/tasks")
  ]);
  state.config = cfg;
  state.users = us.users;
  state.tasks = tk.tasks;
}

function iniciarPolling() {
  pararPolling();
  state.polling = setInterval(async () => {
    if (!$("app-screen").classList.contains("hidden")) {
      try { await carregarDados(); montarFiltros(); render(); }
      catch (e) {}
    }
  }, 5000);
}
function pararPolling() { if (state.polling) { clearInterval(state.polling); state.polling = null; } }

/* ---------- filtros ---------- */
function montarFiltros() {
  const conts = { todas: state.tasks.length };
  state.config.status.forEach(s => conts[s] = state.tasks.filter(t => t.status === s).length);
  const el = $("filter-tabs");
  let html = `<button class="ftab ${state.filtro==='todas'?'active':''}" data-f="todas">Todas <span class="count">${conts.todas}</span></button>`;
  state.config.status.forEach(s => {
    html += `<button class="ftab ${state.filtro===s?'active':''}" data-f="${esc(s)}">${esc(s)} <span class="count">${conts[s]}</span></button>`;
  });
  el.innerHTML = html;
  el.querySelectorAll(".ftab").forEach(b => b.addEventListener("click", () => {
    state.filtro = b.dataset.f;
    montarFiltros(); render();
  }));
}

$("busca").addEventListener("input", (e) => { state.busca = e.target.value.toLowerCase(); render(); });

function tarefasFiltradas() {
  let t = state.tasks;
  if (state.filtro !== "todas") t = t.filter(x => x.status === state.filtro);
  if (state.busca) {
    t = t.filter(x =>
      x.titulo.toLowerCase().includes(state.busca) ||
      x.descricao.toLowerCase().includes(state.busca) ||
      (x.atribuidas || []).some(a => a.nome.toLowerCase().includes(state.busca))
    );
  }
  return t;
}

/* ---------- render ---------- */
function render() {
  const tarefas = tarefasFiltradas();
  const lista = $("lista");
  const vazio = $("vazio");
  if (!tarefas.length) {
    lista.innerHTML = "";
    vazio.classList.remove("hidden");
    $("vazio-txt").textContent = state.busca ? "Nenhuma tarefa encontrada." : "Nenhuma tarefa por aqui. Crie a primeira!";
    return;
  }
  vazio.classList.add("hidden");

  lista.innerHTML = tarefas.map(cardHTML).join("");
  ligarCardEventos();
}

function cardHTML(task) {
  const atrasada = estaAtrasada(task);
  const podeGerenciar = ehGerente();
  const sou = estouAtribuido(task);
  const podeMudarStatus = podeGerenciar || sou;

  // avatares
  let avs = task.atribuidas.map(a => `<span class="avatar" title="${esc(a.nome)}">${esc(iniciais(a.nome))}</span>`).join("");
  if (!task.atribuidas.length) avs = `<span class="avatar more">–</span>`;

  const st = slug(task.status);
  const pri = slug(task.prioridade);

  // mini opcoes de status
  let statusHtml = "";
  if (podeMudarStatus) {
    statusHtml = state.config.status.map(s =>
      `<button class="mini st-mini ${s===task.status?'sel':''}" data-id="${task.id}" data-st="${esc(s)}">${esc(s)}</button>`
    ).join(" ");
  }

  let acoesHtml = `
    <div class="tarefa-acoes">
      <button class="mini" data-ver="${task.id}">Detalhes</button>`;
  if (podeGerenciar) {
    acoesHtml += `<button class="mini" data-editar="${task.id}">Editar</button>`;
    acoesHtml += `<button class="mini danger" data-del="${task.id}">Remover</button>`;
  }
  acoesHtml += `</div>`;

  let entregaHtml = "";
  if (task.dataEntrega) {
    entregaHtml = `<span class="${atrasada ? 'atrasado' : ''}">📅 ${esc(formatarData(task.dataEntrega))}${atrasada ? " (atrasado)" : ""}</span>`;
  }

  return `
    <div class="tarefa" data-id="${task.id}">
      <div class="tarefa-coluna">
        <div class="tarefa-top">
          <span class="badge st-${st}">${esc(task.status)}</span>
          <span class="badge pri-${pri}">${esc(task.prioridade)}</span>
          <span class="tarefa-titulo">${esc(task.titulo)}</span>
        </div>
        ${task.descricao ? `<div class="tarefa-desc">${esc(task.descricao)}</div>` : ""}
        <div class="tarefa-meta">
          <div class="avatares" title="${esc(task.atribuidas.map(a=>a.nome).join(', '))}">${avs}</div>
          <span>Por <b>${esc(task.criadaPorNome)}</b></span>
          ${entregaHtml}
        </div>
        ${statusHtml ? `<div class="status-opcoes" style="margin-top:10px">${statusHtml}</div>` : ""}
      </div>
      ${acoesHtml}
    </div>`;
}

function ligarCardEventos() {
  document.querySelectorAll(".st-mini").forEach(b => b.addEventListener("click", () => mudarStatus(b.dataset.id, b.dataset.st)));
  document.querySelectorAll("[data-ver]").forEach(b => b.addEventListener("click", () => abrirDetalhes(b.dataset.ver)));
  document.querySelectorAll("[data-editar]").forEach(b => b.addEventListener("click", () => abrirModalTarefa(b.dataset.editar)));
  document.querySelectorAll("[data-del]").forEach(b => b.addEventListener("click", () => removerTarefa(b.dataset.del)));
}

async function mudarStatus(id, status) {
  try {
    await api(`/api/tasks/${id}/status`, { method: "PUT", body: { status } });
    await carregarDados(); montarFiltros(); render();
  } catch (e) { toast(e.message, "erro"); }
}

async function removerTarefa(id) {
  if (!confirm("Remover esta tarefa?")) return;
  try {
    await api(`/api/tasks/${id}`, { method: "DELETE" });
    await carregarDados(); montarFiltros(); render();
    toast("Tarefa removida.", "ok");
  } catch (e) { toast(e.message, "erro"); }
}

/* ---------- modal tarefa (criar/editar) ---------- */
$("btn-nova").addEventListener("click", () => abrirModalTarefa(null));

function abrirModalTarefa(id) {
  $("t-erro").textContent = "";
  const editando = id ? state.tasks.find(t => t.id === id) : null;
  $("modal-titulo").textContent = editando ? "Editar tarefa" : "Nova tarefa";
  $("t-id").value = editando ? editando.id : "";
  $("t-titulo").value = editando ? editando.titulo : "";
  $("t-descricao").value = editando ? editando.descricao : "";
  $("t-data").value = editando ? editando.dataEntrega : "";

  // prioridade
  const sel = $("t-prioridade");
  sel.innerHTML = state.config.prioridades.map(p =>
    `<option value="${esc(p)}" ${editando && editando.prioridade===p ? "selected" : ""}>${esc(p)}</option>`
  ).join("");
  if (editando && !state.config.prioridades.includes(editando.prioridade)) {
    sel.innerHTML += `<option value="${esc(editando.prioridade)}" selected>${esc(editando.prioridade)}</option>`;
  }

  // atribuir (so gerente)
  const bloco = $("bloco-atribuir");
  if (ehGerente()) {
    bloco.classList.remove("hidden");
    const lista = $("lista-atribuir");
    lista.innerHTML = state.users.map(u => {
      const marcado = editando && (editando.atribuidas || []).some(a => a.userId === u.id);
      return `
        <label class="item-atribuir">
          <input type="checkbox" value="${u.id}" ${marcado ? "checked" : ""} />
          <span class="nome">${esc(u.nome)}</span>
          <span class="papel">${u.papel === 'gerente' ? 'Gerente' : 'Membro'}</span>
        </label>`;
    }).join("");
  } else {
    bloco.classList.add("hidden");
  }

  $("modal-tarefa").classList.remove("hidden");
}

document.querySelectorAll("[data-close]").forEach(b => b.addEventListener("click", fecharModais));
document.querySelectorAll(".modal").forEach(m => m.addEventListener("click", (e) => {
  if (e.target === m) fecharModais();
}));
function fecharModais() {
  $("modal-tarefa").classList.add("hidden");
  $("modal-detalhes").classList.add("hidden");
}

$("form-tarefa").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("t-erro").textContent = "";
  const id = $("t-id").value;
  const titulo = $("t-titulo").value.trim();
  if (!titulo) { $("t-erro").textContent = "Dê um título para a tarefa."; return; }

  const payload = {
    titulo,
    descricao: $("t-descricao").value.trim(),
    prioridade: $("t-prioridade").value,
    dataEntrega: $("t-data").value
  };

  try {
    if (id) {
      // gerente editando
      payload.atribuidas = [...document.querySelectorAll("#lista-atribuir input:checked")].map(i => i.value);
      await api(`/api/tasks/${id}`, { method: "PUT", body: payload });
    } else {
      if (ehGerente()) {
        payload.atribuidas = [...document.querySelectorAll("#lista-atribuir input:checked")].map(i => i.value);
      } else {
        payload.paraSi = true;
      }
      await api("/api/tasks", { method: "POST", body: payload });
    }
    fecharModais();
    await carregarDados(); montarFiltros(); render();
    toast(id ? "Tarefa atualizada." : "Tarefa criada.", "ok");
  } catch (err) {
    $("t-erro").textContent = err.message;
  }
});

/* ---------- modal detalhes ---------- */
function abrirDetalhes(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  const atrasada = estaAtrasada(task);
  const podeMudarStatus = ehGerente() || estouAtribuido(task);
  const st = slug(task.status);
  const pri = slug(task.prioridade);

  const statusHtml = podeMudarStatus
    ? state.config.status.map(s =>
        `<button class="status-opcao ${s===task.status?'sel':''}" data-id="${task.id}" data-st="${esc(s)}">${esc(s)}</button>`
      ).join(" ")
    : `<span class="badge st-${st}">${esc(task.status)}</span>`;

  const pessoas = (task.atribuidas || []).map(a => `<span class="avatar" title="${esc(a.nome)}">${esc(iniciais(a.nome))}</span>`).join("") || "—";

  $("detalhes-corpo").innerHTML = `
    <div class="det-topo" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <span class="badge st-${st}">${esc(task.status)}</span>
      <span class="badge pri-${pri}">${esc(task.prioridade)}</span>
    </div>
    <div class="det-titulo">${esc(task.titulo)}</div>
    ${task.descricao ? `<div class="det-desc">${esc(task.descricao)}</div>` : ""}
    <div class="tarefa-meta" style="margin-top:10px">
      <div class="avatares">${pessoas}</div>
      <span>Por <b>${esc(task.criadaPorNome)}</b></span>
      ${task.dataEntrega ? `<span class="${atrasada?'atrasado':''}">📅 ${esc(formatarData(task.dataEntrega))}${atrasada?' (atrasado)':''}</span>` : ""}
    </div>
    <div class="det-bloco">
      <h4>Status</h4>
      <div class="status-opcoes">${statusHtml}</div>
    </div>
    <div class="modal-acoes">
      ${ehGerente() ? `<button class="btn btn-primary" data-editar="${task.id}" style="margin-left:auto">Editar</button>` : ""}
      <button class="btn btn-ghost" data-close>Fechar</button>
    </div>
  `;

  $("modal-detalhes").classList.remove("hidden");
  $("modal-detalhes").querySelectorAll(".status-opcao[data-st]").forEach(b =>
    b.addEventListener("click", async () => {
      try {
        await api(`/api/tasks/${b.dataset.id}/status`, { method: "PUT", body: { status: b.dataset.st } });
        await carregarDados(); montarFiltros(); render();
        abrirDetalhes(b.dataset.id);
      } catch (e) { toast(e.message, "erro"); }
    })
  );
  const ed = $("modal-detalhes").querySelector("[data-editar]");
  if (ed) ed.addEventListener("click", () => { abrirDetalhesFechar(); abrirModalTarefa(ed.dataset.editar); });
}
function abrirDetalhesFechar() { $("modal-detalhes").classList.add("hidden"); }

/* ---------- init ---------- */
(async function init() {
  try {
    const { usuario } = await api("/api/auth/me");
    state.usuario = usuario;
    await carregarDados();
    mostrarApp(false);
  } catch (e) {
    $("auth-screen").classList.remove("hidden");
    // dica sobre primeira conta
    try {
      // se nao ha nenhum usuario, avisa
      const r = await fetch("/api/config").catch(() => null);
      // nao importa; apenas mostra hint
      $("login-info").textContent = "A primeira conta criada será o gerente da equipe.";
    } catch (e2) {}
  }
})();
