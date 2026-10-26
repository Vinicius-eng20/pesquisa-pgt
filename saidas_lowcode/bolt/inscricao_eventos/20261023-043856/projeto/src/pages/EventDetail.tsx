import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { supabase, type EventItem, type Registration } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function EventDetail({
  eventId,
  onBack,
}: {
  eventId: string;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [regCount, setRegCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, [eventId]);

  const loadData = async () => {
    setLoading(true);
    const { data: eventData } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();
    setEvent(eventData as EventItem | null);

    const { count } = await supabase
      .from('registrations')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .neq('status', 'cancelled');
    setRegCount(count ?? 0);

    if (user && eventData) {
      const { data: regData } = await supabase
        .from('registrations')
        .select('*')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .maybeSingle();
      setRegistration(regData as Registration | null);
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    if (!user || !event) return;
    setActionLoading(true);
    const { error } = await supabase
      .from('registrations')
      .insert({ event_id: eventId, user_id: user.id, status: 'pending' });
    if (!error) {
      await loadData();
    } else {
      console.error('Registration error:', error);
    }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    if (!registration) return;
    setActionLoading(true);
    const { error } = await supabase
      .from('registrations')
      .update({ status: 'cancelled' })
      .eq('id', registration.id);
    if (!error) {
      await loadData();
    }
    setActionLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500">Evento não encontrado.</p>
        <button onClick={onBack} className="text-teal-600 mt-4">Voltar para eventos</button>
      </div>
    );
  }

  const isCancelled = event.status === 'cancelled';
  const isFull = event.capacity > 0 && regCount >= event.capacity;
  const userReg = registration && registration.status !== 'cancelled';
  const regConfirmed = registration?.status === 'confirmed';

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Voltar para eventos</span>
      </button>

      {/* Hero */}
      <div className="aspect-video rounded-2xl overflow-hidden bg-gradient-to-br from-teal-100 to-cyan-100 mb-6">
        {event.image_url && (
          <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-4">{event.title}</h1>

        <div className="flex flex-wrap gap-4 mb-6 text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-600" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-teal-600" />
            <span>{event.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-600" />
            <span>
              {regCount}
              {event.capacity > 0 && ` / ${event.capacity}`} inscritos
            </span>
          </div>
        </div>

        {event.description && (
          <div className="mb-8">
            <h2 className="text-sm font-semibold text-slate-700 mb-2">Descrição</h2>
            <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">{event.description}</p>
          </div>
        )}

        {/* Status badge */}
        {isCancelled && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700">
            <XCircle className="w-5 h-5" />
            <span className="font-medium">Evento cancelado</span>
          </div>
        )}

        {/* Registration status */}
        {userReg && !isCancelled && (
          <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3 mb-4">
            {regConfirmed ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <span className="text-teal-700 font-medium">Inscrição confirmada</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-5 h-5 text-teal-600" />
                <span className="text-teal-700 font-medium">Inscrição realizada</span>
                <span className="text-slate-500 text-sm">— aguardando confirmação</span>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="pt-4 border-t border-slate-100">
          {!isCancelled && !userReg && (
            <button
              onClick={handleRegister}
              disabled={actionLoading || isFull}
              className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isFull ? 'Evento lotado' : 'Inscrever-se'}
            </button>
          )}

          {!isCancelled && userReg && (
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="w-full sm:w-auto bg-red-50 hover:bg-red-100 text-red-600 font-semibold px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Cancelar inscrição
            </button>
          )}

          {isCancelled && (
            <p className="text-slate-500 text-sm">As inscrições para este evento foram encerradas.</p>
          )}
        </div>
      </div>
    </div>
  );
}
