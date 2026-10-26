import { useEffect, useState } from 'react';
import { TrendingDown, Users, Calendar, PieChart, Receipt } from 'lucide-react';
import { fetchAdminSummary } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/Loading';
import { CategoryIcon } from '@/components/CategoryIcon';
import type { AdminExpensesSummary } from '@/types/database';

export function AdminDashboard({ onNavigate }: { onNavigate: (page: any) => void }) {
  const [summary, setSummary] = useState<AdminExpensesSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const s = await fetchAdminSummary();
        setSummary(s);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const maxTotal = summary?.expenses_by_category?.reduce(
    (max, c) => Math.max(max, Number(c.total)),
    0
  ) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Administração</h1>
        <p className="text-sm text-slate-500 mt-1">Visão geral de todos os usuários e gastos</p>
      </div>

      {loading ? (
        <LoadingSpinner size={32} className="py-20" />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-50 text-red-600">
                  <TrendingDown className="w-5 h-5" />
                </div>
                <p className="text-sm text-slate-500">Total de gastos</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(Number(summary?.total_expenses || 0))}
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600">
                  <Calendar className="w-5 h-5" />
                </div>
                <p className="text-sm text-slate-500">Gastos este mês</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {formatCurrency(Number(summary?.expenses_this_month || 0))}
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 text-blue-600">
                  <Users className="w-5 h-5" />
                </div>
                <p className="text-sm text-slate-500">Usuários ativos</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {summary?.active_users || 0}<span className="text-base text-slate-400 font-normal"> / {summary?.total_users || 0}</span>
              </p>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-50 text-amber-600">
                  <Receipt className="w-5 h-5" />
                </div>
                <p className="text-sm text-slate-500">Categorias ativas</p>
              </div>
              <p className="text-2xl font-bold text-slate-900">
                {summary?.expenses_by_category?.length || 0}
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category breakdown */}
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-900">Gastos por categoria</h2>
              </div>
              {summary?.expenses_by_category?.filter((c) => Number(c.total) > 0).length ? (
                <div className="space-y-3">
                  {summary.expenses_by_category
                    .filter((c) => Number(c.total) > 0)
                    .sort((a, b) => Number(b.total) - Number(a.total))
                    .map((cat) => {
                      const pct = maxTotal > 0 ? (Number(cat.total) / maxTotal) * 100 : 0;
                      return (
                        <div key={cat.category_id}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-slate-700">{cat.category_name}</span>
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
                <p className="text-sm text-slate-400 py-6 text-center">Nenhum gasto registrado ainda.</p>
              )}
            </Card>

            {/* Quick actions */}
            <Card className="p-5">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Ações rápidas</h2>
              <div className="space-y-2">
                <button
                  onClick={() => onNavigate('admin-users')}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-600">
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900">Gerenciar usuários</p>
                      <p className="text-xs text-slate-400">Ativar e desativar contas</p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={() => onNavigate('admin-categories')}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-50 text-amber-600">
                      <CategoryIcon name="Tag" size={16} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-900">Gerenciar categorias</p>
                      <p className="text-xs text-slate-400">Criar e editar categorias de gasto</p>
                    </div>
                  </div>
                </button>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
