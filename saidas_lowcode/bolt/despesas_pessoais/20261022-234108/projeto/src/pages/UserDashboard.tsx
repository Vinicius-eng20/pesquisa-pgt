import { useEffect, useState } from 'react';
import { TrendingDown, Calendar, ArrowLeft, ArrowRight, PieChart, Receipt } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { fetchUserMonthlySummary, fetchExpenses } from '@/lib/api';
import { formatCurrency, formatDate, monthName } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/Loading';
import { CategoryIcon } from '@/components/CategoryIcon';
import type { UserMonthlySummary, Expense } from '@/types/database';

export function UserDashboard({ onNavigate }: { onNavigate: (page: any) => void }) {
  const { user } = useAuth();
  const [monthDate, setMonthDate] = useState(new Date());
  const [summary, setSummary] = useState<UserMonthlySummary | null>(null);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [s, expenses] = await Promise.all([
          fetchUserMonthlySummary(monthDate),
          fetchExpenses(monthDate),
        ]);
        setSummary(s);
        setRecentExpenses(expenses.slice(0, 5));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [monthDate]);

  function changeMonth(delta: number) {
    setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + delta, 1));
  }

  const maxCategoryTotal = summary?.by_category?.reduce(
    (max, c) => Math.max(max, Number(c.total)),
    0
  ) || 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Painel</h1>
          <p className="text-sm text-slate-500 mt-1">Acompanhe seus gastos do mês</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth(-1)}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-medium text-slate-900 min-w-[140px] text-center">
              {monthName(monthDate)}
            </span>
          </div>
          <button
            onClick={() => changeMonth(1)}
            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner size={32} className="py-20" />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 text-red-600">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Total gasto no mês</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {formatCurrency(Number(summary?.total || 0))}
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Registros no mês</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">{summary?.count || 0}</p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600">
                  <PieChart className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Categorias usadas</p>
                </div>
              </div>
              <p className="text-3xl font-bold text-slate-900">
                {summary?.by_category?.filter((c) => Number(c.total) > 0).length || 0}
              </p>
            </Card>
          </div>

          {/* Category Breakdown */}
          <Card className="p-5">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Gastos por categoria</h2>
            {summary?.by_category?.filter((c) => Number(c.total) > 0).length ? (
              <div className="space-y-3">
                {summary.by_category
                  .filter((c) => Number(c.total) > 0)
                  .sort((a, b) => Number(b.total) - Number(a.total))
                  .map((cat) => {
                    const pct = maxCategoryTotal > 0 ? (Number(cat.total) / maxCategoryTotal) * 100 : 0;
                    return (
                      <div key={cat.category_id}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div
                              className="flex items-center justify-center w-7 h-7 rounded-lg"
                              style={{ backgroundColor: `${cat.color}15` }}
                            >
                              <CategoryIcon name={cat.icon} size={14} color={cat.color} />
                            </div>
                            <span className="text-sm font-medium text-slate-700">{cat.category_name}</span>
                            <span className="text-xs text-slate-400">{cat.count} {cat.count === 1 ? 'registro' : 'registros'}</span>
                          </div>
                          <span className="text-sm font-semibold text-slate-900">
                            {formatCurrency(Number(cat.total))}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: cat.color }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400">Nenhum gasto registrado neste mês ainda.</p>
              </div>
            )}
          </Card>

          {/* Recent Expenses */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Registros recentes</h2>
              <button
                onClick={() => onNavigate('expenses')}
                className="text-sm text-emerald-600 font-medium hover:underline"
              >
                Ver todos
              </button>
            </div>
            {recentExpenses.length ? (
              <div className="space-y-2">
                {recentExpenses.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center justify-center w-9 h-9 rounded-lg"
                        style={{ backgroundColor: `${exp.category?.color}15` }}
                      >
                        <CategoryIcon name={exp.category?.icon || 'Tag'} size={16} color={exp.category?.color} />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{exp.description || exp.category?.name}</p>
                        <p className="text-xs text-slate-400">
                          {exp.category?.name} · {formatDate(exp.expense_date)}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">
                      {formatCurrency(Number(exp.amount))}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-sm text-slate-400">Nenhum gasto registrado ainda.</p>
                <button
                  onClick={() => onNavigate('expenses')}
                  className="mt-3 text-sm text-emerald-600 font-medium hover:underline"
                >
                  Registrar primeiro gasto
                </button>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
