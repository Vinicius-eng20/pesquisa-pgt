import { useEffect, useState, useCallback } from 'react';
import { Loader2, BookOpen, Clock, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { LoanWithItem } from '@/lib/types';
import { ITEM_TYPE_LABELS } from '@/lib/types';
import { formatDate, daysUntil, isOverdue } from '@/lib/utils';
import { Modal } from '@/components/Modal';
import { ItemTypeIcon } from '@/components/ItemTypeIcon';

type Tab = 'active' | 'returned' | 'overdue';

export function MyLoansPage() {
  const [loans, setLoans] = useState<LoanWithItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('active');
  const [returnTarget, setReturnTarget] = useState<LoanWithItem | null>(null);
  const [returning, setReturning] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadLoans = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('loans')
      .select('*, item(*)')
      .order('borrowed_at', { ascending: false });
    setLoans((data as LoanWithItem[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadLoans(); }, [loadLoans]);

  const activeLoans = loans.filter((l) => !l.returned_at && !isOverdue(l.due_at));
  const overdueLoans = loans.filter((l) => !l.returned_at && isOverdue(l.due_at));
  const returnedLoans = loans.filter((l) => l.returned_at);

  const tabData = tab === 'active' ? activeLoans : tab === 'overdue' ? overdueLoans : returnedLoans;
  const counts = { active: activeLoans.length, overdue: overdueLoans.length, returned: returnedLoans.length };

  async function handleReturn(loan: LoanWithItem) {
    setReturning(true);
    const { error } = await supabase.rpc('return_item', { p_loan_id: loan.id });
    if (error) {
      setToast({ type: 'error', msg: error.message });
    } else {
      setToast({ type: 'success', msg: `"${loan.item.title}" devolvido com sucesso!` });
      await loadLoans();
    }
    setReturning(false);
    setReturnTarget(null);
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
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Meus empréstimos</h1>
        <p className="text-sm text-gray-500 mt-1">
          Acompanhe e devolva os itens que você pegou emprestado.
        </p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([
          { key: 'active', label: 'Ativos', count: counts.active },
          { key: 'overdue', label: 'Em atraso', count: counts.overdue },
          { key: 'returned', label: 'Devolvidos', count: counts.returned },
        ] as { key: Tab; label: string; count: number }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? t.key === 'overdue'
                  ? 'border-red-500 text-red-600'
                  : 'border-brand-600 text-brand-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                t.key === 'overdue' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tabData.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-gray-400">
            {tab === 'active' && 'Nenhum empréstimo ativo.'}
            {tab === 'overdue' && 'Nenhum item em atraso.'}
            {tab === 'returned' && 'Nenhum empréstimo devolvido ainda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tabData.map((loan) => {
            const overdue = !loan.returned_at && isOverdue(loan.due_at);
            const days = daysUntil(loan.due_at);

            return (
              <div
                key={loan.id}
                className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
              >
                <div className="w-14 h-14 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
                  <ItemTypeIcon type={loan.item.type} className="w-6 h-6 text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 truncate">{loan.item.title}</h3>
                  <p className="text-sm text-gray-500 truncate">
                    {loan.item.author} · {ITEM_TYPE_LABELS[loan.item.type]}
                  </p>
                  <div className="flex items-center gap-4 mt-1.5 text-xs">
                    {loan.returned_at ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Devolvido em {formatDate(loan.returned_at)}
                      </span>
                    ) : overdue ? (
                      <span className="flex items-center gap-1 text-red-600 font-medium">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {Math.abs(days)} dias de atraso
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-gray-500">
                        <Clock className="w-3.5 h-3.5" />
                        {days === 0 ? 'Vence hoje' : days === 1 ? 'Vence amanhã' : `Vence em ${days} dias`}
                        ({formatDate(loan.due_at)})
                      </span>
                    )}
                    <span className="text-gray-400">Pego em {formatDate(loan.borrowed_at)}</span>
                  </div>
                </div>
                {!loan.returned_at && (
                  <button
                    onClick={() => setReturnTarget(loan)}
                    className="flex items-center gap-1.5 bg-ocean-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-ocean-700 transition-colors flex-shrink-0"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Devolver
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={!!returnTarget} onClose={() => setReturnTarget(null)} title="Confirmar devolução">
        {returnTarget && (
          <div>
            <p className="text-gray-600 text-sm mb-1">Você está prestes a devolver:</p>
            <p className="font-medium text-gray-900 mb-6">{returnTarget.item.title}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setReturnTarget(null)}
                disabled={returning}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleReturn(returnTarget)}
                disabled={returning}
                className="flex-1 py-2.5 rounded-xl bg-ocean-600 text-white text-sm font-medium hover:bg-ocean-700 transition-colors flex items-center justify-center gap-2"
              >
                {returning ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                Confirmar devolução
              </button>
            </div>
          </div>
        )}
      </Modal>

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
