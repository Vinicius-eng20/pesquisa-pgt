import React, { useEffect, useMemo, useState, useCallback } from "react";
import * as db from "./storage";

// Garante que a conta do bibliotecário e itens de exemplo existam.
useEffect(() => { db.ensureSeed(); }, []);

export default function App() {
  const [session, setSession] = useState(db.getSession());

  const handleLogout = () => {
    db.setSession(null);
    setSession(null);
  };

  if (!session) {
    return <Auth onLoggedIn={(s) => { db.setSession(s); setSession(s); }} />;
  }
  return <Shell session={session} onLogout={handleLogout} />;
}

/* ---------------- Autenticação ---------------- */
function Auth({ onLoggedIn }) {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  return (
    <div className="auth">
      <div className="card">
        <h1>Biblioteca Digital</h1>
        <p className="sub">Entre com sua conta para começar.</p>

        {mode === "login" ? (
          <LoginForm onLoggedIn={onLoggedIn} onSwitch={() => { setMode("register"); setError(""); setInfo(""); }} setError={setError} />
        ) : (
          <RegisterForm
            onLoggedIn={onLoggedIn}
            onSwitch={() => { setMode("login"); setError(""); setInfo(""); }}
            setError={setError}
            setInfo={setInfo}
          />
        )}
      </div>
    </div>
  );
}

function LoginForm({ onLoggedIn, onSwitch, setError }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const user = db.findByEmail(email, password);
    if (!user) { setError("E-mail ou senha incorretos."); return; }
    onLoggedIn({ id: user.id, role: user.role, name: user.name, email: user.email });
  };

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>E-mail</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@biblioteca.local" required />
      </div>
      <div className="field">
        <label>Senha</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="sua senha" required />
      </div>
      <div className="btnrow"><button className="btn" type="submit" style={{ flex: 1 }}>Entrar</button></div>
      <div className="toggle"><button type="button" onClick={onSwitch}>Criar uma conta</button></div>
      <p className="muted" style={{ fontSize: ".8rem" }}>
        Conta inicial do bibliotecário: bibliotecario@biblioteca.local / biblioteca123
      </p>
    </form>
  );
}

function RegisterForm({ onLoggedIn, onSwitch, setError, setInfo }) {
  const [name, setName] = useState("");
  const [isBib, setIsBib] = useState(false);
  const [created, setCreated] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim()) { setError("Digite seu nome."); return; }
    const user = db.createUser({ name, role: isBib ? "admin" : "reader" });
    setCreated(user);
  };

  const loginAs = () => {
    if (!created) return;
    onLoggedIn({ id: created.id, role: created.role, name: created.name, email: created.email });
  };

  return (
    <form onSubmit={submit}>
      <div className="field">
        <label>Nome</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" required />
      </div>
      <label className="checkbox">
        <input type="checkbox" checked={isBib} onChange={(e) => setIsBib(e.target.checked)} />
        Sou bibliotecário
      </label>
      <div className="btnrow" style={{ marginTop: 12 }}>
        <button className="btn" type="submit" style={{ flex: 1 }}>Criar conta</button>
      </div>

      {created && (
        <div className="created">
          <b>Conta criada!</b>
          <div>E-mail: <b>{created.email}</b></div>
          <div>Senha provisória: <b>{created.password}</b></div>
          <button className="btn small" type="button" onClick={loginAs} style={{ marginTop: 10 }}>Fazer login agora</button>
        </div>
      )}

      <div className="toggle"><button type="button" onClick={onSwitch}>Já tenho conta, entrar</button></div>
    </form>
  );
}

/* ---------------- Estrutura principal ---------------- */
function Shell({ session, onLogout }) {
  const [tab, setTab] = useState("acervo");

  const tabs = useMemo(() => {
    if (session.role === "admin") {
      return [
        { id: "acervo", label: "Acervo" },
        { id: "meus", label: "Meus empréstimos" },
        { id: "gestao", label: "Gerenciar acervo" },
        { id: "historico", label: "Histórico" },
        { id: "conta", label: "Minha conta" }
      ];
    }
    return [
      { id: "acervo", label: "Acervo" },
      { id: "meus", label: "Meus empréstimos" },
      { id: "conta", label: "Minha conta" }
    ];
  }, [session.role]);

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">📚 Biblioteca Digital</div>
        <div className="userchip">
          <span>Olá, {session.name}</span>
          <span className="badge">{session.role === "admin" ? "Bibliotecário" : "Leitor"}</span>
          <button className="btn secondary small" onClick={onLogout}>Sair</button>
        </div>
      </div>

      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.id} className={"tab" + (tab === t.id ? " active" : "")} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "acervo" && <Acervo session={session} />}
      {tab === "meus" && <MeusEmprestimos session={session} />}
      {tab === "gestao" && session.role === "admin" && <Gestao />}
      {tab === "historico" && session.role === "admin" && <Historico />}
      {tab === "conta" && <Conta session={session} />}
    </div>
  );
}

/* ---------------- Acervo (busca + ver + pegar emprestado) ---------------- */
function Acervo({ session }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState(db.getItems());
  const [message, setMessage] = useState(null);
  const [blocked, setBlocked] = useState(db.userIsBlocked(session.id));

  const refresh = () => setItems(db.getItems());

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (i) => i.title.toLowerCase().includes(t) || i.author.toLowerCase().includes(t) || i.category.toLowerCase().includes(t)
    );
  }, [items, q]);

  const borrow = (item) => {
    const res = db.borrowItem(session.id, item.id);
    if (!res.ok) {
      setMessage({ type: "error", text: res.error });
      setBlocked(db.userIsBlocked(session.id));
    } else {
      setMessage({ type: "ok", text: `Você pegou "${item.title}" emprestado. Devolva em 14 dias.` });
    }
    refresh();
  };

  return (
    <>
      {blocked && (
        <div className="alert warn">
          Você está com empréstimo em atraso. Novos empréstimos estão bloqueados.
          Devolva o item em "Meus empréstimos".
        </div>
      )}
      {message && (
        <div className={"alert " + (message.type === "ok" ? "ok" : message.type === "warn" ? "warn" : message.type === "info" ? "info" : "error")}>
          {message.text}
          <button className="btn secondary small" style={{ marginLeft: 10 }} onClick={() => setMessage(null)}>fechar</button>
        </div>
      )}

      <div className="card">
        <h2>Acervo</h2>
        <p className="hint">Busque por título, autor ou categoria.</p>
        <div className="search">
          <input placeholder="Buscar..." value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {filtered.length === 0 ? (
          <div className="empty">Nenhum item encontrado.</div>
        ) : (
          <div className="itemlist">
            {filtered.map((item) => {
              const out = (item.available || 0) <= 0;
              return (
                <div className="item" key={item.id}>
                  <h3>{item.title}</h3>
                  <div className="author">{item.author || "Autor desconhecido"}</div>
                  <div className="meta">
                    <span className="stoketag">{item.category}</span>
                    <span className={out ? "stoketag out" : "stoketag"}>
                      {out ? "Indisponível" : `${item.available} em estante`}
                    </span>
                  </div>
                  <div className="btnrow" style={{ marginTop: 12 }}>
                    <button className="btn small" disabled={out || blocked} onClick={() => borrow(item)}>
                      {out ? "Indisponível" : "Pegar emprestado"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

/* ---------------- Meus empréstimos (pegar já emprestado + devolver) ---------------- */
function MeusEmprestimos({ session }) {
  const [loans, setLoans] = useState(() => db.getAllLoansByUser(session.id));
  const [items, setItems] = useState(() => Object.fromEntries(db.getItems().map((i) => [i.id, i])));
  const [message, setMessage] = useState(null);

  const refresh = () => {
    setLoans(db.getAllLoansByUser(session.id));
    setItems(Object.fromEntries(db.getItems().map((i) => [i.id, i])));
  };

  const doReturn = (loan) => {
    const res = db.returnItem(loan.id, loan.itemId);
    if (!res.ok) setMessage({ type: "error", text: res.error });
    else setMessage({ type: "ok", text: "Devolução registrada com sucesso." });
    refresh();
  };

  const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

  const active = loans.filter((l) => l.status === "active");
  const history = loans.filter((l) => l.status === "returned");

  return (
    <>
      {message && (
        <div className={"alert " + (message.type === "ok" ? "ok" : "error")}>
          {message.text}
          <button className="btn secondary small" style={{ marginLeft: 10 }} onClick={() => setMessage(null)}>fechar</button>
        </div>
      )}

      <div className="card">
        <h2>Meus empréstimos</h2>
        <p className="hint">Itens que você pegou. Devolva dentro do prazo.</p>
        {active.length === 0 ? (
          <div className="empty">Você não tem nada emprestado agora.</div>
        ) : (
          <table>
            <thead><tr><th>Item</th><th>Autor</th><th>Emprestado</th><th>Devolva até</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {active.map((l) => {
                const it = items[l.itemId];
                const overdue = db.isOverdue(l);
                return (
                  <tr key={l.id}>
                    <td>{it ? it.title : "?"}</td>
                    <td>{it ? it.author : "—"}</td>
                    <td>{fmt(l.borrowedAt)}</td>
                    <td>{fmt(l.dueAt)}</td>
                    <td><span className={"status " + (overdue ? "overdue" : "active")}>{overdue ? "Em atraso" : "Emprestado"}</span></td>
                    <td><button className="btn small" onClick={() => doReturn(l)}>Devolver</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Histórico de devoluções</h2>
        {history.length === 0 ? (
          <div className="empty">Nenhuma devolução registrada ainda.</div>
        ) : (
          <table>
            <thead><tr><th>Item</th><th>Emprestado</th><th>Devolvido</th><th></th></tr></thead>
            <tbody>
              {history.map((l) => {
                const it = items[l.itemId];
                return (
                  <tr key={l.id}>
                    <td>{it ? it.title : "?"}</td>
                    <td>{fmt(l.borrowedAt)}</td>
                    <td>{fmt(l.returnedAt)}</td>
                    <td><span className="status returned">Devolvido</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ---------------- Gerenciar acervo (bibliotecário) ---------------- */
function Gestao() {
  const [items, setItems] = useState(db.getItems());
  const [form, setForm] = useState({ title: "", author: "", category: "", available: 1 });
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState(null);
  const [loans, setLoans] = useState(() => db.getLoans());

  const refresh = () => {
    setItems(db.getItems());
    setLoans(db.getLoans());
  };

  const reset = () => {
    setForm({ title: "", author: "", category: "", available: 1 });
    setEditing(null);
  };

  const save = (e) => {
    e.preventDefault();
    if (!form.title.trim()) { setMessage({ type: "error", text: "Título é obrigatório." }); return; }
    if (editing) {
      db.updateItem(editing, form);
      setMessage({ type: "ok", text: "Item atualizado." });
    } else {
      db.createItem(form);
      setMessage({ type: "ok", text: "Item adicionado ao acervo." });
    }
    reset();
    refresh();
  };

  const edit = (item) => {
    setEditing(item.id);
    setForm({ title: item.title, author: item.author, category: item.category, available: item.available });
  };

  const remove = (item) => {
    const res = db.deleteItem(item.id);
    if (!res.ok) setMessage({ type: "error", text: res.error });
    else { setMessage({ type: "ok", text: "Item removido." }); reset(); refresh(); }
  };

  // Empréstimos ativos de cada item (para a tabela)
  const activeByItem = useMemo(() => {
    const map = {};
    loans.filter((l) => l.status === "active").forEach((l) => {
      map[l.itemId] = (map[l.itemId] || 0) + 1;
    });
    return map;
  }, [loans]);

  return (
    <>
      {message && (
        <div className={"alert " + (message.type === "ok" ? "ok" : "error")}>
          {message.text}
          <button className="btn secondary small" style={{ marginLeft: 10 }} onClick={() => setMessage(null)}>fechar</button>
        </div>
      )}

      <div className="card">
        <h2>{editing ? "Editar item" : "Cadastrar item"}</h2>
        <p className="hint">Preencha os dados e salve.</p>
        <form onSubmit={save}>
          <div className="field">
            <label>Título</label>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título do item" />
          </div>
          <div className="row">
            <div className="field">
              <label>Autor</label>
              <input value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} placeholder="Autor" />
            </div>
            <div className="field">
              <label>Categoria</label>
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Ex.: Romance" />
            </div>
          </div>
          <div className="field" style={{ maxWidth: 160 }}>
            <label>Exemplares disponíveis</label>
            <input type="number" min="0" value={form.available} onChange={(e) => setForm({ ...form, available: Math.max(0, parseInt(e.target.value, 10) || 0) })} />
          </div>
          <div className="btnrow">
            <button className="btn" type="submit">{editing ? "Salvar alterações" : "Adicionar ao acervo"}</button>
            {editing && <button className="btn secondary" type="button" onClick={reset}>Cancelar</button>}
          </div>
        </form>
      </div>

      <div className="card">
        <h2>Acervo cadastrado</h2>
        {items.length === 0 ? (
          <div className="empty">Nenhum item cadastrado.</div>
        ) : (
          <table>
            <thead><tr><th>Título</th><th>Autor</th><th>Categoria</th><th>Disponíveis</th><th>Empréstimos</th><th></th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td>{it.title}</td>
                  <td>{it.author || "—"}</td>
                  <td>{it.category}</td>
                  <td>{it.available}</td>
                  <td>{activeByItem[it.id] || 0}</td>
                  <td>
                    <div className="btnrow">
                      <button className="btn secondary small" onClick={() => edit(it)}>Editar</button>
                      <button className="btn danger small" onClick={() => remove(it)}>Remover</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/* ---------------- Histórico (bibliotecário) ---------------- */
function Historico() {
  const [loans, setLoans] = useState(db.getAllLoansSorted());
  const [users, setUsers] = useState(Object.fromEntries(db.getUsers().map((u) => [u.id, u])));
  const [items, setItems] = useState(Object.fromEntries(db.getItems().map((i) => [i.id, i])));
  const [filterUser, setFilterUser] = useState("");

  const refresh = () => {
    setLoans(db.getAllLoansSorted());
    setUsers(Object.fromEntries(db.getUsers().map((u) => [u.id, u])));
    setItems(Object.fromEntries(db.getItems().map((i) => [i.id, i])));
  };

  const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";

  const visible = filterUser ? loans.filter((l) => l.userId === filterUser) : loans;

  return (
    <div className="card">
      <h2>Histórico de empréstimos</h2>
      <p className="hint">Todos os empréstimos de todos os leitores.</p>
      <div className="field" style={{ maxWidth: 320, marginBottom: 14 }}>
        <label>Filtrar por leitor</label>
        <select value={filterUser} onChange={(e) => { setFilterUser(e.target.value); refresh(); }}>
          <option value="">Todos os leitores</option>
          {Object.values(users).map((u) => (
            <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
          ))}
        </select>
      </div>
      {visible.length === 0 ? (
        <div className="empty">Nenhum empréstimo registrado.</div>
      ) : (
        <table>
          <thead><tr><th>Leitor</th><th>Item</th><th>Emprestado</th><th>Devolva até</th><th>Devolvido</th><th>Status</th></tr></thead>
          <tbody>
            {visible.map((l) => {
              const u = users[l.userId];
              const it = items[l.itemId];
              const overdue = db.isOverdue(l);
              return (
                <tr key={l.id}>
                  <td>{u ? u.name : "?"}</td>
                  <td>{it ? it.title : "?"}</td>
                  <td>{fmt(l.borrowedAt)}</td>
                  <td>{fmt(l.dueAt)}</td>
                  <td>{fmt(l.returnedAt)}</td>
                  <td>
                    <span className={"status " + (l.status === "returned" ? "returned" : overdue ? "overdue" : "active")}>
                      {l.status === "returned" ? "Devolvido" : overdue ? "Em atraso" : "Emprestado"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

/* ---------------- Minha conta (trocar senha) ---------------- */
function Conta({ session }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [message, setMessage] = useState(null);

  const change = (e) => {
    e.preventDefault();
    const user = db.getUsers().find((u) => u.id === session.id);
    if (!user) { setMessage({ type: "error", text: "Usuário não encontrado." }); return; }
    if (current !== user.password) { setMessage({ type: "error", text: "Senha atual incorreta." }); return; }
    if (next.length < 4) { setMessage({ type: "error", text: "A nova senha deve ter pelo menos 4 caracteres." }); return; }
    db.updateUserPassword(session.id, next);
    setCurrent(""); setNext("");
    setMessage({ type: "ok", text: "Senha alterada com sucesso." });
  };

  return (
    <div className="card" style={{ maxWidth: 460 }}>
      <h2>Minha conta</h2>
      <p className="hint">Nome: {session.name}</p>
      <p className="hint">E-mail: {session.email}</p>
      {message && (
        <div className={"alert " + (message.type === "ok" ? "ok" : "error")} style={{ marginBottom: 12 }}>{message.text}</div>
      )}
      <form onSubmit={change}>
        <div className="field">
          <label>Senha atual</label>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="field">
          <label>Nova senha</label>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        <div className="btnrow"><button className="btn" type="submit">Alterar senha</button></div>
      </form>
    </div>
  );
}
