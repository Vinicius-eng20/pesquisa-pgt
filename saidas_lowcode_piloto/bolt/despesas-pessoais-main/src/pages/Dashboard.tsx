import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { supabase, formatCurrency, formatDate, type Expense, type Category } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { getIcon } from '@/lib/icons';
import {
  Plus,
  Trash2,
  Pencil,
  X,
  TrendingDown,
  CalendarDays,
  PieChart,
  Receipt,
  LogOut,
  Wallet,
  Search,
  AlertCircle,
} from 'lucide-react';

type Summary = { total: number; byCategory: { category: Category; total: number; count: number }[] };

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [monthOffset, setMonthOffset] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const target = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  const monthLabel = useMemo(
    () => target.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    [target]
  );

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const year = target.getFullYear();
    const month = target.getMonth();
    const start = new Date(year, month, 1).toISOString().slice(0, 10);
    const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);

    const [expRes, catRes] = await Promise.all([
      supabase
        .from('expenses')
        .select('*, category:categories(*)')
        .gte('expense_date', start)
        .lte('expense_date', end)
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false }),
      supabase.from('categories').select('*').eq('active', true).order('name'),
    ]);

    if (expRes.error) setError(expRes.error.message);
    if (catRes.error) setError(catRes.error.message);

    setExpenses((expRes.data as Expense[]) ?? []);
    setCategories((catRes.data as Category[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthOffset]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.category?.name.toLowerCase().includes(q)
    );
  }, [expenses, search]);

  const summary: Summary = useMemo(() => {
    const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const map = new Map<string, { category: Category; total: number; count: number }>();
    for (const e of expenses) {
      if (!e.category) continue;
      const existing = map.get(e.category.id);
      if (existing) {
        existing.total += Number(e.amount);
        existing.count += 1;
      } else {
        map.set(e.category.id, { category: e.category, total: Number(e.amount), count: 1 });
      }
    }
    const byCategory = Array.from(map.values()).sort((a, b) => b.total - a.total);
    return { total, byCategory };
  }, [expenses]);

  const handleSave = async (data: {
    id?: string;
    amount: number;
    category_id: string;
    description: string;
    expense_date: string;
  }) => {
    if (data.id) {
      const { error: err } = await supabase
        .from('expenses')
        .update({
          amount: data.amount,
          category_id: data.category_id,
          description: data.description,
          expense_date: data.expense_date,
        })
        .eq('id', data.id);
      if (err) {
        setError(err.message);
        return false;
      }
    } else {
      const { error: err } = await supabase.from('expenses').insert({
        amount: data.amount,
        category_id: data.category_id,
        description: data.description,
        expense_date: data.expense_date,
      });
      if (err) {
        setError(err.message);
        return false;
      }
    }
    setShowForm(false);
    setEditing(null);
    await loadData();
    return true;
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este gasto?')) return;
    const { error: err } = await supabase.from('expenses').delete().eq('id', id);
    if (err) {
      setError(err.message);
      return;
    }
    await loadData();
  };

  const maxCatTotal = summary.byCategory[0]?.total ?? 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center text-white">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-slate-900 text-sm">FinControl</div>
              <div className="text-xs text-slate-500">Olá, {profile?.full_name || profile?.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {profile?.role === 'admin' && (
              <a
                href="/#admin"
                onClick={(e) => {
                  e.preventDefault();
                  window.dispatchEvent(new CustomEvent('navigate-admin'));
                }}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-teal-700 hover:bg-slate-50 transition"
              >
                Painel admin
              </a>
            )}
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sair</span>
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

        {/* Month navigation */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMonthOffset((m) => m - 1)}
              className="w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center transition"
              aria-label="Mês anterior"
            >
              ‹
            </button>
            <div className="flex items-center gap-2 min-w-44 justify-center">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              <span className="font-semibold text-slate-900 capitalize">{monthLabel}</span>
            </div>
            <button
              onClick={() => setMonthOffset((m) => m + 1)}
              className="w-9 h-9 rounded-lg border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 flex items-center justify-center transition"
              aria-label="Próximo mês"
            >
              ›
            </button>
            {monthOffset !== 0 && (
              <button
                onClick={() => setMonthOffset(0)}
                className="ml-1 text-xs text-teal-700 hover:text-teal-800 font-medium"
              >
                Voltar para hoje
              </button>
            )}
          </div>

          <button
            onClick={() => {
              setEditing(null);
              setShowForm(true);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700 shadow-sm transition"
          >
            <Plus className="w-4 h-4" />
            Novo gasto
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total do mês</span>
              <TrendingDown className="w-4 h-4 text-rose-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">{formatCurrency(summary.total)}</div>
            <div className="text-xs text-slate-400 mt-1">{expenses.length} lançamentos</div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Maior categoria</span>
              <PieChart className="w-4 h-4 text-teal-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {summary.byCategory[0] ? formatCurrency(summary.byCategory[0].total) : '—'}
            </div>
            <div className="text-xs text-slate-400 mt-1">
              {summary.byCategory[0]?.category.name ?? 'Sem dados'}
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Média por gasto</span>
              <Receipt className="w-4 h-4 text-amber-500" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {expenses.length > 0 ? formatCurrency(summary.total / expenses.length) : '—'}
            </div>
            <div className="text-xs text-slate-400 mt-1">em {monthLabel}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Expenses list */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-semibold text-slate-900">Gastos do mês</h2>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar..."
                  className="rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm w-44 sm:w-56 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-10 text-center text-slate-400 text-sm">Carregando...</div>
            ) : filtered.length === 0 ? (
              <div className="p-10 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <Receipt className="w-6 h-6" />
                </div>
                <p className="text-slate-600 font-medium text-sm">
                  {search ? 'Nenhum gasto encontrado na busca.' : 'Nenhum gasto neste mês ainda.'}
                </p>
                {!search && (
                  <button
                    onClick={() => {
                      setEditing(null);
                      setShowForm(true);
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-teal-700 hover:text-teal-800"
                  >
                    <Plus className="w-4 h-4" /> Adicionar primeiro gasto
                  </button>
                )}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtered.map((e) => {
                  const Icon = getIcon(e.category?.icon ?? 'Tag');
                  return (
                    <li key={e.id} className="group p-4 sm:px-5 flex items-center gap-3 hover:bg-slate-50/70 transition">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white"
                        style={{ backgroundColor: e.category?.color ?? '#64748b' }}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-slate-900 text-sm">
                            {formatCurrency(e.amount)}
                          </span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{
                              backgroundColor: `${e.category?.color}15`,
                              color: e.category?.color ?? '#64748b',
                            }}
                          >
                            {e.category?.name ?? 'Sem categoria'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {e.description || 'Sem descrição'} · {formatDate(e.expense_date)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button
                          onClick={() => {
                            setEditing(e);
                            setShowForm(true);
                          }}
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 flex items-center justify-center transition"
                          aria-label="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(e.id)}
                          className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition"
                          aria-label="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Category breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="font-semibold text-slate-900 mb-4">Por categoria</h2>
            {summary.byCategory.length === 0 ? (
              <p className="text-sm text-slate-400 py-8 text-center">Nada para mostrar este mês.</p>
            ) : (
              <ul className="space-y-4">
                {summary.byCategory.map(({ category, total, count }) => {
                  const pct = maxCatTotal > 0 ? (total / maxCatTotal) * 100 : 0;
                  const Icon = getIcon(category.icon);
                  return (
                    <li key={category.id}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon className="w-4 h-4 shrink-0" style={{ color: category.color }} />
                          <span className="text-sm font-medium text-slate-700 truncate">{category.name}</span>
                          <span className="text-xs text-slate-400">({count})</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(total)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, backgroundColor: category.color }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </main>

      {showForm && (
        <ExpenseForm
          expense={editing}
          categories={categories}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function ExpenseForm({
  expense,
  categories,
  onClose,
  onSave,
}: {
  expense: Expense | null;
  categories: Category[];
  onClose: () => void;
  onSave: (data: {
    id?: string;
    amount: number;
    category_id: string;
    description: string;
    expense_date: string;
  }) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState(expense ? String(Number(expense.amount).toFixed(2).replace('.', ',')) : '');
  const [categoryId, setCategoryId] = useState(expense?.category_id ?? categories[0]?.id ?? '');
  const [description, setDescription] = useState(expense?.description ?? '');
  const [date, setDate] = useState(expense?.expense_date ?? new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const numericAmount = Number(amount.replace(/\s/g, '').replace(',', '.'));
    if (!numericAmount || numericAmount <= 0) {
      setFormError('Informe um valor válido.');
      return;
    }
    if (!categoryId) {
      setFormError('Escolha uma categoria.');
      return;
    }
    setSaving(true);
    await onSave({
      id: expense?.id,
      amount: numericAmount,
      category_id: categoryId,
      description: description.trim(),
      expense_date: date,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-900">{expense ? 'Editar gasto' : 'Novo gasto'}</h3>
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
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Valor (R$)</label>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              placeholder="0,00"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Categoria</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Data</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Descrição <span className="text-slate-400 font-normal">(opcional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Ex: almoço, conta de luz..."
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition resize-none"
            />
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
              {saving ? 'Salvando...' : expense ? 'Salvar alterações' : 'Adicionar gasto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
