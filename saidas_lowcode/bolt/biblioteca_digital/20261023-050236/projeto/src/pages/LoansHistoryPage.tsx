import { useEffect, useState, useCallback, useMemo } from 'react';
import { Loader2, BookOpen, Search, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { LoanWithDetails } from '@/lib/types';
import { ITEM_TYPE_LABELS } from '@/lib/types';
import { formatDate, formatDateTime, daysUntil, isOverdue } from '@/lib/utils';
import { ItemTypeIcon } from '@/components/ItemTypeIcon';

type Filter = 'all' | 'active' | 'overdue' | 'returned';

export function LoansHistoryPage() {
  const [loans, setLoans] = useState<LoanWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [returning, setReturning] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadLoans = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('loans')
      .select('*, item(*), profile(*)')
      .order('borrowed_at', { ascending: false });
    setLoans((data as LoanWithDetails[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadLoans(); }, [loadLoans]);

  const filtered = useMemo(() => {
    let result = loans;
    if (filter === 'active') result = result.filter((l) => !l.returned_at && !isOverdue(l.due_at));
    else if (filter === 'overdue') result = result.filter((l) => !l.returned_at && isOverdue(l.due_at));
    else if (filter === 'returned') result = result.filter((l) => l.returned_at);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) => l.item?.title.toLowerCase().includes(q) || l.profile?.name.toLowerCase().includes(q)
      );
    }
    return result;
  }, [loans, filter, search]);

  async function handleReturn(loan: LoanWithDetails) {
    setReturning(loan.id);
    const { error } = await supabase.rpc('return_item', { p_loan_id: loan.id });
    if (error) setToast({ type: 'error', msg: error.message });
    else {
      setToast({ type: 'success', msg: `"${loan.item.title}" devolvido.` });
      await loadLoans();
    }
    setReturning(null);
    setTimeout(() => setToast(null), 4000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Histórico de empréstimos</h1>
        <p className="text-sm text-gray-500 mt-1">Todos os empréstimos de todos os leitores.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por item ou leitor..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition cursor-pointer"
        >
          <option value="all">Todos</option>
          <option value="active">Ativos</option>
          <option value="overdue">Em atraso</option>
          <option value="returned">Devolvidos</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-gray-400">Nenhum empréstimo encontrado.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-100">
                <th className="pb-3 pr-4">Item</th>
                <th className="pb-3 pr-4">Leitor</th>
                <th className="pb-3 pr-4">Pego em</th>
                <th className="pb-3 pr-4">Devolução</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((loan) => {
                const overdue = !loan.returned_at && isOverdue(loan.due_at);
                const days = daysUntil(loan.due_at);

                return (
                  <tr key={loan.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                          <ItemTypeIcon type={loan.item.type} className="w-4 h-4 text-brand-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate max-w-[200px]">{loan.item.title}</p>
                          <p className="text-xs text-gray-400">{ITEM_TYPE_LABELS[loan.item.type]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <p className="text-gray-700">{loan.profile?.name ?? '—'}</p>
                    </td>
                    <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{formatDate(loan.borrowed_at)}</td>
                    <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">
                      {loan.returned_at ? formatDateTime(loan.returned_at) : formatDate(loan.due_at)}
                    </td>
                    <td className="py-3 pr-4">
                      {loan.returned_at ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                          Devolvido
                        </span>
                      ) : overdue ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                          {Math.abs(days)}d atraso
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-ocean-50 text-ocean-700">
                          {days === 0 ? 'Vence hoje' : `${days}d restantes`}
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      {!loan.returned_at && (
                        <button
                          onClick={() => handleReturn(loan)}
                          disabled={returning === loan.id}
                          className="flex items-center gap-1.5 text-ocean-600 hover:text-ocean-700 text-xs font-medium disabled:opacity-50"
                        >
                          {returning === loan.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          Devolver
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className={`px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
