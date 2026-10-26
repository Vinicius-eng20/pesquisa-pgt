import { useEffect, useState } from 'react';
import { Users, Search, ShieldCheck, UserCheck, UserX } from 'lucide-react';
import { fetchAllProfiles, updateProfileStatus, fetchAdminUserExpenses } from '@/lib/api';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/Loading';
import { useToast } from '@/components/ui/Toast';
import { CategoryIcon } from '@/components/CategoryIcon';
import { useAuth } from '@/context/AuthContext';
import type { Profile, Expense } from '@/types/database';
import { formatDate } from '@/lib/format';

export function AdminUsers() {
  const { profile: currentUser } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detailUser, setDetailUser] = useState<Profile | null>(null);
  const [userExpenses, setUserExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState<Profile | null>(null);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const p = await fetchAllProfiles();
      setProfiles(p);
    } catch (err) {
      console.error(err);
      toast('Erro ao carregar usuários', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function openUserDetail(p: Profile) {
    setDetailUser(p);
    setLoadingExpenses(true);
    try {
      const exps = await fetchAdminUserExpenses(p.id);
      setUserExpenses(exps);
    } catch (err) {
      console.error(err);
      setUserExpenses([]);
    } finally {
      setLoadingExpenses(false);
    }
  }

  async function handleToggle() {
    if (!confirmToggle) return;
    try {
      await updateProfileStatus(confirmToggle.id, !confirmToggle.is_active);
      toast(confirmToggle.is_active ? 'Conta desativada' : 'Conta ativada', 'success');
      setConfirmToggle(null);
      load();
      if (detailUser?.id === confirmToggle.id) {
        setDetailUser({ ...confirmToggle, is_active: !confirmToggle.is_active });
      }
    } catch (err: any) {
      toast(err.message || 'Erro ao atualizar conta', 'error');
    }
  }

  const filtered = profiles.filter((p) =>
    !search ||
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    p.full_name.toLowerCase().includes(search.toLowerCase())
  );

  const userTotal = userExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Usuários</h1>
        <p className="text-sm text-slate-500 mt-1">Gerencie contas de usuários</p>
      </div>

      <Input
        placeholder="Buscar por nome ou email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        icon={<Search className="w-4 h-4" />}
      />

      {loading ? (
        <LoadingSpinner size={32} className="py-20" />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => {
            const isSelf = p.id === currentUser?.id;
            return (
              <Card key={p.id} className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0 ${
                      p.role === 'admin' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {p.role === 'admin' ? <ShieldCheck className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {p.full_name || p.email}
                        </p>
                        {p.role === 'admin' && (
                          <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                            Admin
                          </span>
                        )}
                        {isSelf && (
                          <span className="text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                            Você
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-slate-400 truncate">{p.email}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          p.is_active
                            ? 'text-emerald-700 bg-emerald-50'
                            : 'text-red-600 bg-red-50'
                        }`}>
                          {p.is_active ? 'Ativa' : 'Desativada'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => openUserDetail(p)}>
                      Ver gastos
                    </Button>
                    {!isSelf && (
                      <Button
                        variant={p.is_active ? 'danger' : 'primary'}
                        size="sm"
                        onClick={() => setConfirmToggle(p)}
                      >
                        {p.is_active ? (
                          <>
                            <UserX className="w-3.5 h-3.5" />
                            Desativar
                          </>
                        ) : (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            Ativar
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <Card className="p-12 text-center">
              <p className="text-sm text-slate-400">Nenhum usuário encontrado.</p>
            </Card>
          )}
        </div>
      )}

      {/* User Detail Modal */}
      <Modal
        open={!!detailUser}
        onClose={() => setDetailUser(null)}
        title={`Gastos de ${detailUser?.full_name || detailUser?.email || ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">Total registrado</p>
              <p className="text-xl font-bold text-slate-900">{formatCurrency(userTotal)}</p>
            </div>
            <div className="rounded-lg bg-slate-50 px-4 py-3">
              <p className="text-xs text-slate-500">Número de registros</p>
              <p className="text-xl font-bold text-slate-900">{userExpenses.length}</p>
            </div>
          </div>

          {loadingExpenses ? (
            <LoadingSpinner size={24} className="py-8" />
          ) : userExpenses.length ? (
            <div className="max-h-80 overflow-y-auto space-y-2">
              {userExpenses.map((exp) => (
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
            <p className="text-sm text-slate-400 text-center py-8">Nenhum gasto registrado.</p>
          )}
        </div>
      </Modal>

      {/* Toggle Confirmation */}
      <Modal
        open={!!confirmToggle}
        onClose={() => setConfirmToggle(null)}
        title={confirmToggle?.is_active ? 'Desativar conta' : 'Ativar conta'}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            {confirmToggle?.is_active
              ? `Tem certeza que deseja desativar a conta de ${confirmToggle?.email}? A pessoa não poderá mais acessar o sistema.`
              : `Deseja reativar a conta de ${confirmToggle?.email}? A pessoa poderá acessar o sistema novamente.`}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setConfirmToggle(null)} className="flex-1">
              Cancelar
            </Button>
            <Button
              variant={confirmToggle?.is_active ? 'danger' : 'primary'}
              onClick={handleToggle}
              className="flex-1"
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
