import { useEffect, useState } from 'react';
import { Calendar, MapPin, Loader2, Ticket, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { supabase, type RegistrationWithEvent } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function MyRegistrations({ onSelectEvent }: { onSelectEvent: (id: string) => void }) {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<RegistrationWithEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRegistrations();
  }, []);

  const loadRegistrations = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('registrations')
      .select('id, event_id, user_id, status, created_at, events!inner(id, title, date, location, status)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading registrations:', error);
    } else {
      setRegistrations(data as unknown as RegistrationWithEvent[]);
    }
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const statusConfig = {
    pending: { icon: Clock, label: 'Aguardando', color: 'text-amber-600 bg-amber-50' },
    confirmed: { icon: CheckCircle2, label: 'Confirmado', color: 'text-teal-600 bg-teal-50' },
    cancelled: { icon: XCircle, label: 'Cancelado', color: 'text-red-500 bg-red-50' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  const active = registrations.filter((r) => r.status !== 'cancelled');
  const cancelled = registrations.filter((r) => r.status === 'cancelled');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Minhas inscrições</h1>
        <p className="text-slate-500 mt-1">Acompanhe o status dos eventos em que se inscreveu</p>
      </div>

      {registrations.length === 0 ? (
        <div className="text-center py-20">
          <Ticket className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Você ainda não se inscreveu em nenhum evento.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div className="space-y-3">
              {active.map((reg) => {
                const sc = statusConfig[reg.status];
                const StatusIcon = sc.icon;
                return (
                  <button
                    key={reg.id}
                    onClick={() => onSelectEvent(reg.event_id)}
                    className="w-full text-left bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md hover:border-teal-200 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-slate-900 mb-2">{reg.events.title}</h3>
                        <div className="space-y-1 text-sm text-slate-500">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{formatDate(reg.events.date)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                            <span>{reg.events.location}</span>
                          </div>
                        </div>
                      </div>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${sc.color} flex-shrink-0`}>
                        <StatusIcon className="w-3.5 h-3.5" />
                        {sc.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {cancelled.length > 0 && (
            <div>
              <p className="text-sm font-medium text-slate-400 mb-3">Canceladas</p>
              <div className="space-y-3">
                {cancelled.map((reg) => (
                  <button
                    key={reg.id}
                    onClick={() => onSelectEvent(reg.event_id)}
                    className="w-full text-left bg-slate-50 rounded-2xl border border-slate-200 p-5 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 opacity-60">
                        <h3 className="font-medium text-slate-700 mb-1">{reg.events.title}</h3>
                        <div className="text-sm text-slate-400">{formatDate(reg.events.date)}</div>
                      </div>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-red-500 bg-red-50 flex-shrink-0">
                        <XCircle className="w-3.5 h-3.5" />
                        Cancelado
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
