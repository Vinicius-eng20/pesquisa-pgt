import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase, formatCurrency, formatDate, type Category, type Profile, type Expense } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getIcon, ICON_NAMES, CATEGORY_COLORS } from '@/lib/icons';
import {
  ArrowLeft,
  Tag,
  Users,
  BarChart3,
  Plus,
  Pencil,
  Trash2,
  X,
  Power,
  AlertCircle,
  Wallet,
  TrendingDown,
  CheckCircle2,
  Search,
} from 'lucide-react';

type Tab = 'categories' | 'users' | 'overview';

export default function AdminPanel() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [expenses, setExpenses] = useState<(Expense & { user_email?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCatForm, setShowCatForm] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [monthOffset, setMonthOffset] = useState(0);

  const target = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);
  const monthLabel = target.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const loadAll = async () => {
    setLoading(true);
    setError(null);
    const year = target.getFullYear();
    const month = target.getMonth();
    const start = new Date(year, month, 1).toISOString().slice(0, 10);
    const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    const [catRes, userRes, expRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase
        .from('expenses')
        .select('*, category:categories(*), user:profiles(email)')
        .gte('expense_date', start)
        .lte('expense_date', end)
        .order('expense_date', { ascending: false }),
    ]);

    if (catRes.error) setError(catRes.error.message);
    if (userRes.error) setError(userRes.error.message);
    if (expRes.error) setError(expRes.error.message);

    setCategories((catRes.data as Category[]) ?? []);
    setUsers((userRes.data as Profile[]) ?? []);
    setExpenses(
      ((expRes.data as Expense[]) ?? []).map((e) => ({
        ...e,
        user_email: (e as unknown as { user?: { email?: string } }).user?.email,
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOffset]);

  const monthTotal = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const activeUsers = users.filter((u) => u.active).length;
  const adminCount = users.filter((u) => u.role === 'admin').length;

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => u.email.toLowerCase().includes(q) || (u.full_name || '').toLowerCase().includes(q));
  }, [users, userSearch]);

  const toggleActive = async (u: Profile) => {
    if (u.id === profile?.id) {
      setError('Você não pode desativar sua própria conta.');
      return;
    }
    const newActive = !u.active;
    const { error: err } = await supabase
      .from('profiles')
      .update({ active: newActive })
      .eq('id', u.id);
    if (err) {
      setError(err.message);
      return;
    }
    await loadAll();
  };

  const saveCategory = async (data: Partial<Category> & { name: string; color: string; icon: string }) => {
    if (data.id) {
      const { error: err } = await supabase
        .from('categories')
        .update({ name: data.name, color: data.color, icon: data.icon, active: data.active ?? true })
        .eq('id', data.id);
      if (err) {
        setError(err.message);
        return false;
      }
    } else {
      const { error: err } = await supabase
        .from('categories')
        .insert({ name: data.name, color: data.color, icon: data.icon });
      if (err) {
        setError(err.message);
        return false;
      }
    }
    setShowCatForm(false);
    setEditingCat(null);
    await loadAll();
    return true;
  };

  const toggleCategoryActive = async (c: Category) => {
    const { error: err } = await supabase
      .from('categories')
      .update({ active: !c.active })
      .eq('id', c.id);
    if (err) {
      setError(err.message);
      return;
    }
    await loadAll();
  };

  const deleteCategory = async (c: Category) => {
    const count = expenses.filter((e) => e.category_id === c.id).length;
    const msg = count
      ? `Existem gastos usando "${c.name}". Eles ficarão sem categoria. Continuar?`
      : `Excluir a categoria "${c.name}"?`;
    if (!confirm(msg)) return;
    const { error: err } = await supabase.from('categories').delete().eq('id', c.id);
    if (err) {
      setError(err.message);
      return;
    }
    await loadAll();
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-slate-900 text-sm">FinControl · Admin</div>
              <div className="text-xs text-slate-500">{profile?.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('navigate-dashboard'))}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-teal-700 hover:bg-slate-50 transition"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Meus gastos</span>
            </button>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-rose-400 hover:text-rose-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit">
          {([
            ['overview', 'Visão geral', BarChart3],
            ['categories', 'Categorias', Tag],
            ['users', 'Usuários', Users],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
                tab === key
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-400 text-sm">
            Carregando...
          </div>
        ) : (
          <>
            {tab === 'overview' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setMonthOffset((m) => m - 1)}
                      className="w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center transition"
                    >
                      ‹
                    </button>
                    <span className="font-semibold text-slate-900 capitalize min-w-44 text-center">{monthLabel}</span>
                    <button
                      onClick={() => setMonthOffset((m) => m + 1)}
                      className="w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center transition"
                    >
                      ›
                    </button>
                    {monthOffset !== 0 && (
                      <button
                        onClick={() => setMonthOffset(0)}
                        className="ml-1 text-xs text-teal-700 hover:text-teal-800 font-medium"
                      >
                        Hoje
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Gastos totais (mês)</span>
                      <TrendingDown className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{formatCurrency(monthTotal)}</div>
                    <div className="text-xs text-slate-400 mt-1">{expenses.length} lançamentos de todos os usuários</div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Usuários ativos</span>
                      <Users className="w-4 h-4 text-teal-600" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{activeUsers}</div>
                    <div className="text-xs text-slate-400 mt-1">de {users.length} cadastrados</div>
                  </div>
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Categorias</span>
                      <Tag className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{categories.length}</div>
                    <div className="text-xs text-slate-400 mt-1">{categories.filter((c) => c.active).length} ativas</div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-900">Todos os gastos · {monthLabel}</h2>
                  </div>
                  {expenses.length === 0 ? (
                    <div className="p-10 text-center text-sm text-slate-400">Nenhum gasto neste mês.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wide">
                          <tr>
                            <th className="text-left font-medium px-5 py-3">Usuário</th>
                            <th className="text-left font-medium px-5 py-3">Categoria</th>
                            <th className="text-left font-medium px-5 py-3">Descrição</th>
                            <th className="text-left font-medium px-5 py-3">Data</th>
                            <th className="text-right font-medium px-5 py-3">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {expenses.map((e) => {
                            const Icon = getIcon(e.category?.icon ?? 'Tag');
                            return (
                              <tr key={e.id} className="hover:bg-slate-50/70">
                                <td className="px-5 py-3 text-slate-600">{e.user_email ?? '—'}</td>
                                <td className="px-5 py-3">
                                  <span className="inline-flex items-center gap-1.5">
                                    <Icon className="w-4 h-4" style={{ color: e.category?.color }} />
                                    {e.category?.name ?? '—'}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-slate-600 max-w-xs truncate">{e.description || '—'}</td>
                                <td className="px-5 py-3 text-slate-500">{formatDate(e.expense_date)}</td>
                                <td className="px-5 py-3 text-right font-semibold text-slate-900">
                                  {formatCurrency(e.amount)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'categories' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="font-semibold text-slate-900">Categorias de gasto</h2>
                    <p className="text-sm text-slate-500">Cadastre, edite ou desative as categorias disponíveis.</p>
                  </div>
                  <button
                    onClick={() => {
                      setEditingCat(null);
                      setShowCatForm(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 shadow-sm transition"
                  >
                    <Plus className="w-4 h-4" /> Nova categoria
                  </button>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    {categories.map((c) => {
                      const Icon = getIcon(c.icon);
                      return (
                        <li key={c.id} className="group p-4 sm:px-5 flex items-center gap-3 hover:bg-slate-50/70 transition">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                            style={{ backgroundColor: c.color, opacity: c.active ? 1 : 0.4 }}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-slate-900 text-sm flex items-center gap-2">
                              {c.name}
                              {!c.active && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">inativa</span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400">{c.icon} · {c.color}</div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => toggleCategoryActive(c)}
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 flex items-center justify-center transition"
                              title={c.active ? 'Desativar' : 'Ativar'}
                            >
                              <Power className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingCat(c);
                                setShowCatForm(true);
                              }}
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 flex items-center justify-center transition"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteCategory(c)}
                              className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}

            {tab === 'users' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="font-semibold text-slate-900">Usuários</h2>
                    <p className="text-sm text-slate-500">Ative ou desative contas. {adminCount} administrador(es).</p>
                  </div>
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Buscar usuário..."
                      className="rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm w-56 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition"
                    />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <ul className="divide-y divide-slate-100">
                    {filteredUsers.map((u) => (
                      <li key={u.id} className="p-4 sm:px-5 flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm shrink-0 ${
                            u.active ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-400'
                          }`}
                        >
                          {(u.full_name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-900 text-sm flex items-center gap-2 flex-wrap">
                            {u.full_name || u.email}
                            {u.role === 'admin' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-900 text-white">admin</span>
                            )}
                            {!u.active && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">desativada</span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 truncate">{u.email}</div>
                        </div>
                        {u.id !== profile?.id && (
                          <button
                            onClick={() => toggleActive(u)}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                              u.active
                                ? 'text-rose-600 hover:bg-rose-50 border border-rose-200'
                                : 'text-emerald-600 hover:bg-emerald-50 border border-emerald-200'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            {u.active ? 'Desativar' : 'Ativar'}
                          </button>
                        )}
                        {u.id === profile?.id && (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400 px-3">
                            <CheckCircle2 className="w-3.5 h-3.5" /> você
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {showCatForm && (
        <CategoryForm
          category={editingCat}
          onClose={() => {
            setShowCatForm(false);
            setEditingCat(null);
          }}
          onSave={saveCategory}
        />
      )}
    </div>
  );
}

function CategoryForm({
  category,
  onClose,
  onSave,
}: {
  category: Category | null;
  onClose: () => void;
  onSave: (data: { id?: string; name: string; color: string; icon: string; active?: boolean }) => Promise<boolean>;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState(category?.icon ?? 'Tag');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Informe um nome.');
      return;
    }
    setSaving(true);
    await onSave({ id: category?.id, name: name.trim(), color, icon, active: category?.active ?? true });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-900">{category ? 'Editar categoria' : 'Nova categoria'}</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          {formError && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Ex: Restaurante"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Cor</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-8 h-8 rounded-full transition ring-offset-2 ${
                    color === c ? 'ring-2 ring-slate-900' : ''
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor ${c}`}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Ícone</label>
            <div className="grid grid-cols-6 gap-2">
              {ICON_NAMES.map((name) => {
                const Icon = getIcon(name);
                return (
                  <button
                    type="button"
                    key={name}
                    onClick={() => setIcon(name)}
                    className={`aspect-square rounded-lg flex items-center justify-center transition border ${
                      icon === name
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60 transition"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
