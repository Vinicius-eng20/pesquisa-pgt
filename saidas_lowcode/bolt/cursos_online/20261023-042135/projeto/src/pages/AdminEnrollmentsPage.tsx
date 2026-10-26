import { useEffect, useState } from 'react';
import { Search, Users, Ban, Trash2, Loader2, Clock, XCircle } from 'lucide-react';
import { supabase, type EnrollmentWithDetails } from '@/lib/supabase';
import { PageLoader, EmptyState, ErrorState } from '@/components/ui';

export default function AdminEnrollmentsPage() {
  const [enrollments, setEnrollments] = useState<EnrollmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'cancelled'>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('enrollments')
      .select('*, course:courses(id, title, description, instructor, category, level, duration_hours), profile:profiles(id, name, email)')
      .order('enrolled_at', { ascending: false });

    if (error) {
      setError('Não foi possível carregar as matrículas.');
    } else {
      setEnrollments(data as EnrollmentWithDetails[]);
    }
    setLoading(false);
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancelar esta matrícula? O aluno perderá acesso ao curso.')) return;
    setActionLoading(id);
    const { error } = await supabase.from('enrollments').update({ status: 'cancelled' }).eq('id', id);
    if (error) {
      setError('Não foi possível cancelar a matrícula.');
    } else {
      setEnrollments((prev) =>
        prev.map((e) => (e.id === id ? { ...e, status: 'cancelled' } : e)),
      );
    }
    setActionLoading(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover permanentemente esta matrícula? Esta ação não pode ser desfeita.')) return;
    setActionLoading(id);
    const { error } = await supabase.from('enrollments').delete().eq('id', id);
    if (error) {
      setError('Não foi possível remover a matrícula.');
    } else {
      setEnrollments((prev) => prev.filter((e) => e.id !== id));
    }
    setActionLoading(null);
  };

  const filtered = enrollments.filter((e) => {
    if (statusFilter !== 'all' && e.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.profile?.name?.toLowerCase().includes(q) ||
      e.profile?.email?.toLowerCase().includes(q) ||
      e.course?.title?.toLowerCase().includes(q)
    );
  });

  const activeCount = enrollments.filter((e) => e.status === 'active').length;

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Matrículas</h1>
        <p className="text-slate-500 text-sm">Todas as matrículas de todos os alunos da plataforma.</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-900">{enrollments.length}</div>
          <div className="text-xs text-slate-500 mt-0.5">Total de matrículas</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          <div className="text-xs text-slate-500 mt-0.5">Ativas</div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-2xl font-bold text-slate-400">{enrollments.length - activeCount}</div>
          <div className="text-xs text-slate-500 mt-0.5">Canceladas</div>
        </div>
      </div>

      {error && <div className="mb-6"><ErrorState message={error} /></div>}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por aluno, email ou curso..."
            className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {(['all', 'active', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                statusFilter === s ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s === 'all' ? 'Todas' : s === 'active' ? 'Ativas' : 'Canceladas'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 && !error ? (
        <EmptyState
          icon={Users}
          title="Nenhuma matrícula encontrada"
          description={search ? 'Tente buscar por outro termo.' : 'Quando os alunos se matricularem, as matrículas aparecerão aqui.'}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-left">
                  <th className="px-5 py-3 font-medium">Aluno</th>
                  <th className="px-5 py-3 font-medium">Curso</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">Data</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((enr) => (
                  <tr key={enr.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{enr.profile?.name || '—'}</div>
                      <div className="text-xs text-slate-400">{enr.profile?.email}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-slate-700">{enr.course?.title || '—'}</div>
                      <div className="text-xs text-slate-400">{enr.course?.category}</div>
                    </td>
                    <td className="px-5 py-4 hidden md:table-cell text-slate-500">
                      {new Date(enr.enrolled_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-4">
                      {enr.status === 'active' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md">
                          <Clock className="w-3 h-3" /> Ativa
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                          <XCircle className="w-3 h-3" /> Cancelada
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        {enr.status === 'active' && (
                          <button
                            onClick={() => handleCancel(enr.id)}
                            disabled={actionLoading === enr.id}
                            className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
                            title="Cancelar matrícula"
                          >
                            {actionLoading === enr.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Ban className="w-4 h-4" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handleDelete(enr.id)}
                          disabled={actionLoading === enr.id}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Remover matrícula"
                        >
                          {actionLoading === enr.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
