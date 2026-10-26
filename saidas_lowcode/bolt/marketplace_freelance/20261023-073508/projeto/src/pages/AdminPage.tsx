import { useEffect, useState } from 'react';
import { supabase, type Service, type Profile, type Contract } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { Shield, Check, X, Ban, RotateCcw, Users, Briefcase, FileText, Clock, Trash2 } from 'lucide-react';

type AdminTab = 'services' | 'contracts' | 'users';

export function AdminPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<AdminTab>('services');
  const [services, setServices] = useState<Service[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadAll();
    }
  }, [profile]);

  const loadAll = async () => {
    setLoading(true);
    const [svcRes, ctrRes, usrRes] = await Promise.all([
      supabase.from('services').select('*, provider:profiles(*)').order('created_at', { ascending: false }),
      supabase.from('contracts').select('*, service:services(*), client:profiles!client_id(*), provider:profiles!provider_id(*)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
    ]);

    if (svcRes.data) setServices(svcRes.data as unknown as Service[]);
    if (ctrRes.data) setContracts(ctrRes.data as unknown as Contract[]);
    if (usrRes.data) setUsers(usrRes.data as Profile[]);
    setLoading(false);
  };

  const updateServiceStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('services').update({ status }).eq('id', id);
    if (error) { console.error(error); return; }
    loadAll();
  };

  const toggleSuspend = async (userId: string, currentlySuspended: boolean) => {
    const { error } = await supabase.rpc('admin_set_suspended', { target_user_id: userId, suspend: !currentlySuspended });
    if (error) { console.error(error); return; }
    loadAll();
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center">
        <Shield className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Você não tem permissão para acessar esta página.</p>
      </div>
    );
  }

  const pendingCount = services.filter(s => s.status === 'pending').length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-6 h-6 text-emerald-600" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Painel de administração</h1>
        </div>
        <p className="text-slate-500">Gerencie serviços, contratos e usuários da plataforma</p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-slate-100 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Briefcase className="w-4 h-4" />
            <span className="text-xs font-medium">Serviços</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{services.length}</p>
          {pendingCount > 0 && (
            <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {pendingCount} aguardando aprovação
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-medium">Contratos</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{contracts.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Usuários</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{users.length}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto">
        {([['services', 'Serviços'], ['contracts', 'Contratos'], ['users', 'Usuários']] as [AdminTab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              tab === key ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
            {key === 'services' && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-xs">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/3 mb-3" />
              <div className="h-4 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      ) : tab === 'services' ? (
        <ServicesAdmin services={services} onUpdateStatus={updateServiceStatus} />
      ) : tab === 'contracts' ? (
        <ContractsAdmin contracts={contracts} />
      ) : (
        <UsersAdmin users={users} onToggleSuspend={toggleSuspend} currentUserId={profile?.id} />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700',
    approved: 'bg-emerald-50 text-emerald-700',
    rejected: 'bg-red-50 text-red-700',
    removed: 'bg-slate-100 text-slate-500',
    accepted: 'bg-blue-50 text-blue-700',
    completed: 'bg-emerald-50 text-emerald-700',
    cancelled: 'bg-red-50 text-red-700',
  };
  const labels: Record<string, string> = {
    pending: 'Pendente',
    approved: 'Aprovado',
    rejected: 'Rejeitado',
    removed: 'Removido',
    accepted: 'Aceito',
    completed: 'Concluído',
    cancelled: 'Cancelado',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${config[status] || ''}`}>
      {labels[status] || status}
    </span>
  );
}

function ServicesAdmin({ services, onUpdateStatus }: { services: Service[]; onUpdateStatus: (id: string, status: string) => void }) {
  if (services.length === 0) return <p className="text-slate-500 text-center py-12">Nenhum serviço publicado.</p>;

  return (
    <div className="space-y-3">
      {services.map((service) => {
        const provider = service.provider as unknown as Profile | undefined;
        return (
          <div key={service.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <StatusBadge status={service.status} />
                  <span className="text-xs text-slate-400">{service.category}</span>
                  <span className="text-sm font-bold text-slate-900">
                    R$ {Number(service.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <h3 className="font-semibold text-slate-900 mb-1">{service.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-2">{service.description}</p>
                <p className="text-xs text-slate-400 mt-2">
                  Por: {provider?.display_name || '—'} · {new Date(service.created_at).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 sm:w-auto">
                {service.status === 'pending' && (
                  <>
                    <button
                      onClick={() => onUpdateStatus(service.id, 'approved')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Aprovar
                    </button>
                    <button
                      onClick={() => onUpdateStatus(service.id, 'rejected')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-red-200 text-red-600 text-xs font-medium hover:bg-red-50 transition"
                    >
                      <X className="w-3.5 h-3.5" />
                      Rejeitar
                    </button>
                  </>
                )}
                {service.status === 'approved' && (
                  <button
                    onClick={() => onUpdateStatus(service.id, 'removed')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remover
                  </button>
                )}
                {(service.status === 'rejected' || service.status === 'removed') && (
                  <button
                    onClick={() => onUpdateStatus(service.id, 'approved')}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-medium hover:bg-emerald-600 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reativar
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ContractsAdmin({ contracts }: { contracts: Contract[] }) {
  if (contracts.length === 0) return <p className="text-slate-500 text-center py-12">Nenhum contrato criado.</p>;

  return (
    <div className="space-y-3">
      {contracts.map((contract) => {
        const service = contract.service as unknown as Service | undefined;
        const client = contract.client as unknown as Profile | undefined;
        const provider = contract.provider as unknown as Profile | undefined;
        return (
          <div key={contract.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge status={contract.status} />
              <span className="text-xs text-slate-400">{new Date(contract.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
            <h3 className="font-semibold text-slate-900 mb-2">{service?.title || 'Serviço removido'}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-600">
              <div><span className="text-slate-400">Cliente:</span> {client?.display_name || '—'}</div>
              <div><span className="text-slate-400">Prestador:</span> {provider?.display_name || '—'}</div>
            </div>
            {contract.details && (
              <p className="text-sm text-slate-500 mt-2 line-clamp-2">{contract.details}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function UsersAdmin({ users, onToggleSuspend, currentUserId }: { users: Profile[]; onToggleSuspend: (userId: string, suspended: boolean) => void; currentUserId?: string }) {
  if (users.length === 0) return <p className="text-slate-500 text-center py-12">Nenhum usuário cadastrado.</p>;

  return (
    <div className="space-y-3">
      {users.map((user) => (
        <div key={user.id} className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center text-slate-700 font-semibold flex-shrink-0">
                {user.display_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-slate-900 truncate">{user.display_name}</p>
                  {user.role === 'admin' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-xs font-medium">
                      <Shield className="w-3 h-3 mr-0.5" />
                      Admin
                    </span>
                  )}
                  {user.is_suspended && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-50 text-red-700 text-xs font-medium">
                      <Ban className="w-3 h-3 mr-0.5" />
                      Suspenso
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">Cadastrado em {new Date(user.created_at).toLocaleDateString('pt-BR')}</p>
              </div>
            </div>

            {user.id !== currentUserId && (
              <button
                onClick={() => onToggleSuspend(user.id, user.is_suspended)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap ${
                  user.is_suspended
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'border border-red-200 text-red-600 hover:bg-red-50'
                }`}
              >
                {user.is_suspended ? (
                  <><RotateCcw className="w-3.5 h-3.5" /> Reativar</>
                ) : (
                  <><Ban className="w-3.5 h-3.5" /> Suspender</>
                )}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
