import { useEffect, useState } from 'react';
import {
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Users,
  Calendar,
  MapPin,
  Filter,
} from 'lucide-react';
import {
  supabase,
  type EventItem,
  type RegistrationWithProfile,
} from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type RegRow = RegistrationWithProfile & {
  events: Pick<EventItem, 'id' | 'title' | 'date' | 'location'>;
};

export default function AllRegistrations() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [registrations, setRegistrations] = useState<RegRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [regLoading, setRegLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('organizer_id', user.id)
      .order('date', { ascending: true });

    if (error) {
      console.error('Error loading events:', error);
    } else {
      setEvents(data as EventItem[]);
      if (data.length > 0) {
        setSelectedEventId(data[0].id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (selectedEventId) {
      loadRegistrations(selectedEventId);
    } else {
      setRegistrations([]);
    }
  }, [selectedEventId]);

  const loadRegistrations = async (eventId: string) => {
    setRegLoading(true);
    const { data, error } = await supabase
      .from('registrations')
      .select(
        'id, event_id, user_id, status, created_at, events!inner(id, title, date, location), profiles!inner(id, name)'
      )
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading registrations:', error);
    } else {
      setRegistrations(data as unknown as RegRow[]);
    }
    setRegLoading(false);
  };

  const updateStatus = async (regId: string, status: 'confirmed' | 'cancelled') => {
    setUpdatingId(regId);
    const { error } = await supabase
      .from('registrations')
      .update({ status })
      .eq('id', regId);
    if (!error && selectedEventId) {
      await loadRegistrations(selectedEventId);
    }
    setUpdatingId(null);
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

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const stats = {
    total: registrations.length,
    pending: registrations.filter((r) => r.status === 'pending').length,
    confirmed: registrations.filter((r) => r.status === 'confirmed').length,
    cancelled: registrations.filter((r) => r.status === 'cancelled').length,
  };

  const statusIcons = {
    pending: Clock,
    confirmed: CheckCircle2,
    cancelled: XCircle,
  };
  const statusColors = {
    pending: 'text-amber-600 bg-amber-50',
    confirmed: 'text-teal-600 bg-teal-50',
    cancelled: 'text-red-500 bg-red-50',
  };
  const statusLabels = {
    pending: 'Aguardando',
    confirmed: 'Confirmado',
    cancelled: 'Cancelado',
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Inscrições</h1>
        <p className="text-slate-500 mt-1">Confirme presença e acompanhe as inscrições dos seus eventos</p>
      </div>

      {/* Event filter */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <select
          value={selectedEventId ?? ''}
          onChange={(e) => setSelectedEventId(e.target.value || null)}
          className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent bg-white"
        >
          {events.length === 0 && <option value="">Nenhum evento criado</option>}
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title} — {formatDate(ev.date)}
            </option>
          ))}
        </select>
      </div>

      {selectedEvent && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Total" value={stats.total} icon={Users} color="text-slate-600 bg-slate-50" />
            <StatCard label="Aguardando" value={stats.pending} icon={Clock} color="text-amber-600 bg-amber-50" />
            <StatCard label="Confirmados" value={stats.confirmed} icon={CheckCircle2} color="text-teal-600 bg-teal-50" />
            <StatCard label="Cancelados" value={stats.cancelled} icon={XCircle} color="text-red-500 bg-red-50" />
          </div>

          {/* Event info */}
          <div className="flex flex-wrap gap-4 text-sm text-slate-500 mb-4">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(selectedEvent.date)}
            </div>
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              {selectedEvent.location}
            </div>
            {selectedEvent.capacity > 0 && (
              <div className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {stats.confirmed} / {selectedEvent.capacity} confirmados
              </div>
            )}
          </div>
        </>
      )}

      {/* Registrations list */}
      {regLoading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : !selectedEventId ? (
        <div className="text-center py-20">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Crie um evento para ver as inscrições.</p>
        </div>
      ) : registrations.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhuma inscrição para este evento.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {registrations.map((reg) => {
            const StatusIcon = statusIcons[reg.status];
            const sc = statusColors[reg.status];
            const sl = statusLabels[reg.status];
            return (
              <div
                key={reg.id}
                className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-slate-500">
                      {(reg.profiles.name || '?').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-slate-900 truncate">
                      {reg.profiles.name || 'Participante'}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${sc}`}>
                        <StatusIcon className="w-3 h-3" />
                        {sl}
                      </span>
                      <span className="text-xs text-slate-400">{formatDate(reg.created_at)}</span>
                    </div>
                  </div>
                </div>

                {reg.status !== 'confirmed' && (
                  <button
                    onClick={() => updateStatus(reg.id, 'confirmed')}
                    disabled={updatingId === reg.id}
                    className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white text-sm font-medium transition-colors flex-shrink-0"
                  >
                    Confirmar
                  </button>
                )}
                {reg.status === 'confirmed' && (
                  <button
                    onClick={() => updateStatus(reg.id, 'cancelled')}
                    disabled={updatingId === reg.id}
                    className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium transition-colors flex-shrink-0"
                  >
                    Cancelar presença
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: typeof Users;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className="text-xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
