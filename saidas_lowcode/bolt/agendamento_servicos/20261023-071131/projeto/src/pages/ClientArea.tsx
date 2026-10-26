import { useEffect, useState, useCallback } from 'react';
import {
  Clock,
  Tag,
  Calendar,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Hourglass,
  CalendarX,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  type Service,
  type AvailableSlot,
  type Booking,
  type BookingStatus,
  STATUS_LABELS,
  STATUS_COLORS,
} from '@/lib/supabase';
import {
  Button,
  Spinner,
  Badge,
  EmptyState,
  Modal,
  Textarea,
  formatCurrency,
  formatDuration,
  formatDateTime,
  formatTime,
  formatDate,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

type View = 'list' | 'slots';

export function ClientServices() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [bookingSlot, setBookingSlot] = useState<AvailableSlot | null>(null);
  const [notes, setNotes] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) {
      console.error(error);
    }
    setServices((data as Service[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  async function openService(service: Service) {
    setSelectedService(service);
    setView('slots');
    setSlotsLoading(true);
    const { data, error } = await supabase
      .from('available_slots')
      .select('*')
      .eq('service_id', service.id)
      .eq('is_booked', false)
      .gte('start_time', new Date().toISOString())
      .order('start_time', { ascending: true });

    if (error) {
      console.error(error);
    }
    setSlots((data as AvailableSlot[]) || []);
    setSlotsLoading(false);
  }

  async function handleBooking() {
    if (!bookingSlot) return;
    setBookingLoading(true);
    setBookingError(null);

    const { data, error } = await supabase.rpc('create_booking', {
      p_slot_id: bookingSlot.id,
      p_notes: notes.trim(),
    });

    if (error) {
      let msg = error.message;
      if (msg.includes('já foi reservado')) msg = 'Este horário acabou de ser reservado por outra pessoa.';
      else if (msg.includes('não encontrado')) msg = 'Horário não encontrado.';
      else msg = 'Não foi possível agendar. Tente novamente.';
      setBookingError(msg);
      setBookingLoading(false);
      return;
    }

    setBookingSuccess(true);
    setBookingLoading(false);

    // Refresh slots
    if (selectedService) {
      const { data: refreshed } = await supabase
        .from('available_slots')
        .select('*')
        .eq('service_id', selectedService.id)
        .eq('is_booked', false)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true });
      setSlots((refreshed as AvailableSlot[]) || []);
    }
  }

  function closeBookingModal() {
    setBookingSlot(null);
    setNotes('');
    setBookingError(null);
    setBookingSuccess(false);
    setBookingLoading(false);
  }

  function groupSlotsByDate(slotList: AvailableSlot[]) {
    const groups: Record<string, AvailableSlot[]> = {};
    for (const slot of slotList) {
      const dateKey = new Date(slot.start_time).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(slot);
    }
    return groups;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="w-8 h-8 text-teal-600" />
      </div>
    );
  }

  if (view === 'slots' && selectedService) {
    const grouped = groupSlotsByDate(slots);

    return (
      <div>
        <button
          onClick={() => {
            setView('list');
            setSelectedService(null);
          }}
          className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 mb-4 transition-colors"
        >
          <ArrowLeft size={16} />
          Voltar para serviços
        </button>

        <div className="bg-white rounded-2xl border border-stone-200 p-5 mb-6">
          <h2 className="text-xl font-bold text-stone-900">{selectedService.name}</h2>
          {selectedService.description && (
            <p className="mt-1 text-sm text-stone-600">{selectedService.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-stone-600">
              <Clock size={15} className="text-stone-400" />
              {formatDuration(selectedService.duration_minutes)}
            </span>
            <span className="flex items-center gap-1.5 text-stone-600">
              <Tag size={15} className="text-stone-400" />
              {formatCurrency(Number(selectedService.price))}
            </span>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-stone-700 mb-3">
          Horários disponíveis
        </h3>

        {slotsLoading ? (
          <div className="flex justify-center py-12">
            <Spinner className="w-6 h-6 text-teal-600" />
          </div>
        ) : slots.length === 0 ? (
          <EmptyState
            icon={<CalendarX size={48} />}
            title="Nenhum horário disponível"
            description="Não há horários abertos para este serviço no momento. Volte mais tarde."
          />
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([dateKey, daySlots]) => (
              <div key={dateKey}>
                <p className="text-xs font-semibold text-stone-500 uppercase tracking-wide mb-2">
                  {formatDate(daySlots[0].start_time)}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {daySlots.map((slot) => (
                    <button
                      key={slot.id}
                      onClick={() => {
                        setBookingSlot(slot);
                        setBookingSuccess(false);
                        setBookingError(null);
                      }}
                      className="rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm font-medium text-stone-700 hover:border-teal-500 hover:bg-teal-50 hover:text-teal-700 transition-all"
                    >
                      {formatTime(slot.start_time)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <Modal
          open={!!bookingSlot}
          onClose={closeBookingModal}
          title="Confirmar agendamento"
        >
          {bookingSuccess ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-semibold text-stone-900">
                Agendamento realizado!
              </h3>
              <p className="mt-1.5 text-sm text-stone-500">
                Seu horário foi reservado e está aguardando confirmação do responsável.
              </p>
              <Button className="mt-5 w-full" onClick={closeBookingModal}>
                Fechar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedService && bookingSlot && (
                <div className="bg-stone-50 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500">Serviço</span>
                    <span className="font-medium text-stone-800">
                      {selectedService.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500">Data e hora</span>
                    <span className="font-medium text-stone-800">
                      {formatDateTime(bookingSlot.start_time)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500">Duração</span>
                    <span className="font-medium text-stone-800">
                      {formatDuration(selectedService.duration_minutes)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-stone-500">Valor</span>
                    <span className="font-medium text-stone-800">
                      {formatCurrency(Number(selectedService.price))}
                    </span>
                  </div>
                </div>
              )}

              <Textarea
                label="Observações (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Alguma informação adicional para o responsável?"
                rows={3}
              />

              {bookingError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {bookingError}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={closeBookingModal}>
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleBooking}
                  disabled={bookingLoading}
                >
                  {bookingLoading ? <Spinner className="w-4 h-4" /> : 'Confirmar'}
                </Button>
              </div>
            </div>
          )}
        </Modal>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Agendar um serviço</h1>
        <p className="mt-1 text-sm text-stone-500">
          Escolha um serviço para ver os horários disponíveis.
        </p>
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={<CalendarX size={48} />}
          title="Nenhum serviço disponível"
          description="O responsável ainda não cadastrou serviços. Volte mais tarde."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => openService(service)}
              className="text-left bg-white rounded-2xl border border-stone-200 p-5 hover:border-teal-300 hover:shadow-md transition-all group"
            >
              <h3 className="font-semibold text-stone-900 group-hover:text-teal-700 transition-colors">
                {service.name}
              </h3>
              {service.description && (
                <p className="mt-1.5 text-sm text-stone-500 line-clamp-2">
                  {service.description}
                </p>
              )}
              <div className="mt-4 flex items-center justify-between">
                <div className="flex flex-col gap-1 text-sm">
                  <span className="flex items-center gap-1.5 text-stone-600">
                    <Clock size={14} className="text-stone-400" />
                    {formatDuration(service.duration_minutes)}
                  </span>
                  <span className="flex items-center gap-1.5 font-medium text-stone-800">
                    <Tag size={14} className="text-stone-400" />
                    {formatCurrency(Number(service.price))}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-lg bg-stone-100 group-hover:bg-teal-100 flex items-center justify-center transition-colors">
                  <Calendar size={18} className="text-stone-400 group-hover:text-teal-600 transition-colors" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function ClientBookings() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        service:services(*),
        slot:available_slots(*)
      `)
      .eq('client_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
    }
    setBookings((data as Booking[]) || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  async function handleCancel(bookingId: string) {
    setCancellingId(bookingId);
    const { error } = await supabase.rpc('cancel_booking', {
      p_booking_id: bookingId,
    });

    if (error) {
      let msg = error.message;
      if (msg.includes('não pode mais ser cancelado')) msg = 'Este agendamento não pode mais ser cancelado.';
      else if (msg.includes('não pode cancelar')) msg = 'Você não pode cancelar este agendamento.';
      else msg = 'Não foi possível cancelar. Tente novamente.';
      alert(msg);
    } else {
      await fetchBookings();
    }
    setCancellingId(null);
  }

  function statusIcon(status: BookingStatus) {
    switch (status) {
      case 'confirmed':
        return <CheckCircle2 size={16} className="text-emerald-600" />;
      case 'declined':
        return <XCircle size={16} className="text-red-600" />;
      case 'pending':
        return <Hourglass size={16} className="text-amber-600" />;
      case 'cancelled':
        return <CalendarX size={16} className="text-gray-400" />;
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner className="w-8 h-8 text-teal-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Meus agendamentos</h1>
        <p className="mt-1 text-sm text-stone-500">
          Acompanhe e cancele seus horários marcados.
        </p>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={<CalendarX size={48} />}
          title="Nenhum agendamento"
          description="Você ainda não marcou nenhum horário. Vá em 'Agendar' para começar."
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-stone-900">
                    {booking.service?.name || 'Serviço'}
                  </h3>
                  <Badge className={STATUS_COLORS[booking.status]}>
                    <span className="flex items-center gap-1">
                      {statusIcon(booking.status)}
                      {STATUS_LABELS[booking.status]}
                    </span>
                  </Badge>
                </div>
                {booking.slot && (
                  <p className="text-sm text-stone-600">
                    {formatDateTime(booking.slot.start_time)}
                  </p>
                )}
                {booking.notes && (
                  <p className="mt-1.5 text-xs text-stone-400 italic">
                    "{booking.notes}"
                  </p>
                )}
              </div>

              {(booking.status === 'pending' || booking.status === 'confirmed') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleCancel(booking.id)}
                  disabled={cancellingId === booking.id}
                >
                  {cancellingId === booking.id ? (
                    <Spinner className="w-4 h-4" />
                  ) : (
                    'Cancelar'
                  )}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
