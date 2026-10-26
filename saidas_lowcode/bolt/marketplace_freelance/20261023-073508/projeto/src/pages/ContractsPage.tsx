import { useEffect, useState } from 'react';
import { supabase, type Contract, type Service, type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { FileText, ArrowRight, Clock, CheckCircle2, XCircle, Briefcase } from 'lucide-react';

const STATUS_CONFIG = {
  pending: { label: 'Aguardando', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  accepted: { label: 'Aceito', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: CheckCircle2 },
  completed: { label: 'Concluído', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
};

type Tab = 'all' | 'as_client' | 'as_provider';

export function ContractsPage() {
  const { profile } = useAuth();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');

  useEffect(() => {
    if (profile) loadContracts();
  }, [profile]);

  const loadContracts = async () => {
    if (!profile) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('contracts')
      .select('*, service:services(*), client:profiles!client_id(*), provider:profiles!provider_id(*)')
      .or(`client_id.eq.${profile.id},provider_id.eq.${profile.id}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading contracts:', error);
    } else if (data) {
      setContracts(data as unknown as Contract[]);
    }
    setLoading(false);
  };

  const handleStatusChange = async (contractId: string, newStatus: string) => {
    const { error } = await supabase.from('contracts').update({ status: newStatus }).eq('id', contractId);
    if (error) {
      console.error('Error updating contract:', error);
      return;
    }
    loadContracts();
  };

  const filtered = contracts.filter((c) => {
    if (tab === 'as_client') return c.client_id === profile?.id;
    if (tab === 'as_provider') return c.provider_id === profile?.id;
    return true;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Meus contratos</h1>
        <p className="text-slate-500 mt-1">Acompanhe os serviços que você contratou ou que estão sendo prestados por você</p>
      </div>

      <div className="flex gap-2 mb-6">
        {([['all', 'Todos'], ['as_client', 'Como cliente'], ['as_provider', 'Como prestador']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              tab === key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Você ainda não tem contratos aqui.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((contract) => {
            const service = contract.service as unknown as Service | undefined;
            const client = contract.client as unknown as Profile | undefined;
            const provider = contract.provider as unknown as Profile | undefined;
            const isClient = contract.client_id === profile?.id;
            const isProvider = contract.provider_id === profile?.id;
            const statusInfo = STATUS_CONFIG[contract.status];
            const StatusIcon = statusInfo.icon;

            return (
              <div key={contract.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium ${statusInfo.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusInfo.label}
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(contract.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <h3 className="font-semibold text-slate-900 text-lg mb-1">{service?.title || 'Serviço removido'}</h3>

                    {contract.details && (
                      <p className="text-sm text-slate-500 mb-3 line-clamp-2">{contract.details}</p>
                    )}

                    <div className="flex items-center gap-4 text-sm text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Cliente:</span>
                        <span className="font-medium">{client?.display_name || '—'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Prestador:</span>
                        <span className="font-medium">{provider?.display_name || '—'}</span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5 text-sm">
                      <Briefcase className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-400">Categoria:</span>
                      <span className="font-medium text-slate-700">{service?.category || '—'}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-bold text-slate-900">
                        R$ {service ? Number(service.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:w-44">
                    {isProvider && contract.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleStatusChange(contract.id, 'accepted')}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          Aceitar
                        </button>
                        <button
                          onClick={() => handleStatusChange(contract.id, 'cancelled')}
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
                        >
                          <XCircle className="w-4 h-4" />
                          Recusar
                        </button>
                      </>
                    )}
                    {isProvider && contract.status === 'accepted' && (
                      <button
                        onClick={() => handleStatusChange(contract.id, 'completed')}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        Marcar concluído
                      </button>
                    )}
                    {(isClient || isProvider) && contract.status === 'pending' && isClient && (
                      <button
                        onClick={() => handleStatusChange(contract.id, 'cancelled')}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancelar
                      </button>
                    )}
                    {contract.status === 'accepted' && isClient && (
                      <span className="text-xs text-slate-500 text-center px-2">
                        Aguardando conclusão pelo prestador
                      </span>
                    )}
                    {(contract.status === 'completed' || contract.status === 'cancelled') && (
                      <span className="text-xs text-slate-400 text-center px-2">
                        {contract.status === 'completed' ? 'Contrato finalizado' : 'Contrato cancelado'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
