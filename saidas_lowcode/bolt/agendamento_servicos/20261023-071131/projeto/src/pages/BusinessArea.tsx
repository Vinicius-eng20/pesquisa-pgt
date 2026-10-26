import { useEffect, useState, useCallback } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  Tag,
  Calendar,
  CheckCircle2,
  XCircle,
  Hourglass,
  CalendarX,
  Scissors,
  Eye,
  EyeOff,
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
  Input,
  Textarea,
  Select,
  Spinner,
  Badge,
  EmptyState,
  Modal,
  formatCurrency,
  formatDuration,
  formatDateTime,
  formatTime,
} from '@/components/ui';
import { useAuth } from '@/context/AuthContext';

// ============================================================
// SERVICES MANAGEMENT
// ============================================================
export function BusinessServices() {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [form, setForm] = useState({
    name: '',
    description: '',
    duration_minutes: '30',
    price: '0',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Service | null>(null);

  const fetchServices = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', profile?.id)
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    setServices((data as Service[]) || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  function openCreate() {
    setEditingService(null);
    setForm({ name: '', description: '', duration_minutes: '30', price: '0' });
    setFormError(null);
    setModalOpen(true);
  }

  function openEdit(service: Service) {
    setEditingService(service);
    setForm({
      name: service.name,
      description: service.description,
      duration_minutes: String(service.duration_minutes),
      price: String(service.price),
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    if (form.name.trim().length < 2) {
      setFormError('Digite um nome para o serviço.');
      return;
    }
    const duration = parseInt(form.duration_minutes, 10);
    if (isNaN(duration) || duration <= 0) {
      setFormError('Duração inválida.');
      return;
    }
    const price = parseFloat(form.price);
    if (isNaN(price) || price < 0) {
      setFormError('Preço inválido.');
      return;
    }

    setSaving(true);

    if (editingService) {
      const { error } = await supabase
        .from('services')
        .update({
          name: form.name.trim(),
          description: form.description.trim(),
          duration_minutes: duration,
          price,
        })
        .eq('id', editingService.id);

      if (error) {
        setFormError('Erro ao salvar. Tente novamente.');
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from('services').insert({
        name: form.name.trim(),
        description: form.description.trim(),
        duration_minutes: duration,
        price,
      });

      if (error) {
        setFormError('Erro ao criar serviço. Tente novamente.');
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setModalOpen(false);
    await fetchServices();
  }

  async function handleToggleActive(service: Service) {
    await supabase
      .from('services')
      .update({ active: !service.active })
      .eq('id', service.id);
    await fetchServices();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      alert('Erro ao excluir serviço.');
    } else {
      await fetchServices();
    }
    setDeleteTarget(null);
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Serviços</h1>
          <p className="mt-1 text-sm text-stone-500">
            Cadastre e gerencie os serviços que você oferece.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={18} />
          Novo serviço
        </Button>
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={<Scissors size={48} />}
          title="Nenhum serviço cadastrado"
          description="Comece adicionando os serviços que você oferece para seus clientes."
          action={
            <Button onClick={openCreate}>
              <Plus size={18} />
              Adicionar serviço
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {services.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-2xl border border-stone-200 p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-stone-900">{service.name}</h3>
                <Badge
                  className={
                    service.active
                      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                      : 'bg-stone-100 text-stone-500 border-stone-200'
                  }
                >
                  {service.active ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              {service.description && (
                <p className="mt-1.5 text-sm text-stone-500 line-clamp-2 flex-1">
                  {service.description}
                </p>
              )}
              <div className="mt-3 flex flex-col gap-1 text-sm">
                <span className="flex items-center gap-1.5 text-stone-600">
                  <Clock size={14} className="text-stone-400" />
                  {formatDuration(service.duration_minutes)}
                </span>
                <span className="flex items-center gap-1.5 font-medium text-stone-800">
                  <Tag size={14} className="text-stone-400" />
                  {formatCurrency(Number(service.price))}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-2 pt-4 border-t border-stone-100">
                <Button variant="ghost" size="sm" onClick={() => openEdit(service)}>
                  <Pencil size={14} />
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleActive(service)}
                >
                  {service.active ? <EyeOff size={14} /> : <Eye size={14} />}
                  {service.active ? 'Ocultar' : 'Ativar'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 ml-auto"
                  onClick={() => setDeleteTarget(service)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingService ? 'Editar serviço' : 'Novo serviço'}
      >
        <div className="space-y-4">
          <Input
            label="Nome do serviço"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Corte de cabelo"
          />
          <Textarea
            label="Descrição (opcional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Detalhes sobre o serviço..."
            rows={3}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Duração (minutos)"
              type="number"
              min="1"
              value={form.duration_minutes}
              onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
            />
            <Input
              label="Preço (R$)"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
            />
          </div>
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner className="w-4 h-4" /> : 'Salvar'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir serviço"
      >
        <p className="text-sm text-stone-600">
          Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>?
          Todos os horários vinculados a este serviço também serão removidos.
          Esta ação não pode ser desfeita.
        </p>
        <div className="flex gap-3 mt-5">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// SLOTS MANAGEMENT
// ============================================================
export function BusinessSlots() {
  const { profile } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    service_id: '',
    date: '',
    time: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AvailableSlot | null>(null);

  const fetchServices = useCallback(async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', profile?.id)
      .order('name');
    setServices((data as Service[]) || []);
  }, [profile?.id]);

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('available_slots')
      .select('*, service:services(*)')
      .eq('business_id', profile?.id)
      .order('start_time', { ascending: true });

    if (error) console.error(error);
    setSlots((data as AvailableSlot[]) || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    fetchServices();
    fetchSlots();
  }, [fetchServices, fetchSlots]);

  function openCreate() {
    setForm({
      service_id: services[0]?.id || '',
      date: new Date().toISOString().split('T')[0],
      time: '09:00',
    });
    setFormError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    setFormError(null);
    if (!form.service_id) {
      setFormError('Selecione um serviço.');
      return;
    }
    if (!form.date || !form.time) {
      setFormError('Preencha data e hora.');
      return;
    }

    const service = services.find((s) => s.id === form.service_id);
    if (!service) {
      setFormError('Serviço inválido.');
      return;
    }

    const startDateTime = new Date(`${form.date}T${form.time}`);
    const endDateTime = new Date(
      startDateTime.getTime() + service.duration_minutes * 60000
    );

    if (startDateTime.getTime() < Date.now()) {
      setFormError('Não é possível criar horários no passado.');
      setSaving(false);
      return;
    }

    setSaving(true);
    const { error } = await supabase.from('available_slots').insert({
      service_id: form.service_id,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
    });

    if (error) {
      setFormError('Erro ao criar horário. Tente novamente.');
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    await fetchSlots();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { error } = await supabase
      .from('available_slots')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      alert('Erro ao excluir horário.');
    } else {
      await fetchSlots();
    }
    setDeleteTarget(null);
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Horários disponíveis</h1>
          <p className="mt-1 text-sm text-stone-500">
            Cadastre os horários que seus clientes podem agendar.
          </p>
        </div>
        <Button onClick={openCreate} disabled={services.length === 0}>
          <Plus size={18} />
          Novo horário
        </Button>
      </div>

      {services.length === 0 ? (
        <EmptyState
          icon={<Scissors size={48} />}
          title="Cadastre um serviço primeiro"
          description="Você precisa ter pelo menos um serviço cadastrado antes de criar horários."
        />
      ) : slots.length === 0 ? (
        <EmptyState
          icon={<Calendar size={48} />}
          title="Nenhum horário cadastrado"
          description="Adicione horários para que seus clientes possam agendar."
          action={
            <Button onClick={openCreate}>
              <Plus size={18} />
              Adicionar horário
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {slots.map((slot) => (
            <div
              key={slot.id}
              className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center flex-shrink-0">
                <Calendar size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-900 text-sm">
                  {slot.service?.name || 'Serviço'}
                </p>
                <p className="text-sm text-stone-500">
                  {formatDateTime(slot.start_time)}
                </p>
              </div>
              <Badge
                className={
                  slot.is_booked
                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                    : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                }
              >
                {slot.is_booked ? 'Reservado' : 'Disponível'}
              </Badge>
              {!slot.is_booked && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => setDeleteTarget(slot)}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Novo horário disponível"
      >
        <div className="space-y-4">
          <Select
            label="Serviço"
            value={form.service_id}
            onChange={(e) => setForm({ ...form, service_id: e.target.value })}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({formatDuration(s.duration_minutes)})
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data"
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              min={new Date().toISOString().split('T')[0]}
            />
            <Input
              label="Hora"
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
            />
          </div>
          {formError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? <Spinner className="w-4 h-4" /> : 'Criar horário'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir horário"
      >
        <p className="text-sm text-stone-600">
          Remover este horário disponível? Se nenhum cliente agendou, ele será excluído.
        </p>
        <div className="flex gap-3 mt-5">
          <Button variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>
            Cancelar
          </Button>
          <Button variant="danger" className="flex-1" onClick={handleDelete}>
            Excluir
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ============================================================
// BOOKINGS MANAGEMENT
// ============================================================
export function BusinessBookings() {
  const { profile } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | BookingStatus>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        service:services(*),
        slot:available_slots(*),
        client:profiles!bookings_client_id_fkey(*)
      `)
      .eq('business_id', profile?.id)
      .order('created_at', { ascending: false });

    if (error) console.error(error);
    setBookings((data as Booking[]) || []);
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  async function handleUpdateStatus(bookingId: string, status: 'confirmed' | 'declined') {
    setProcessingId(bookingId);
    const { error } = await supabase.rpc('update_booking_status', {
      p_booking_id: bookingId,
      p_status: status,
    });

    if (error) {
      alert('Erro ao atualizar status. Tente novamente.');
    } else {
      await fetchBookings();
    }
    setProcessingId(null);
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

  const filtered = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;

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
        <h1 className="text-2xl font-bold text-stone-900">Agendamentos</h1>
        <p className="mt-1 text-sm text-stone-500">
          {pendingCount > 0
            ? `Você tem ${pendingCount} agendamento${pendingCount > 1 ? 's' : ''} aguardando confirmação.`
            : 'Todos os agendamentos estão em dia.'}
        </p>
      </div>

      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {(['all', 'pending', 'confirmed', 'declined', 'cancelled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-stone-800 text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            }`}
          >
            {f === 'all'
              ? 'Todos'
              : f === 'pending'
              ? 'Aguardando'
              : f === 'confirmed'
              ? 'Confirmados'
              : f === 'declined'
              ? 'Recusados'
              : 'Cancelados'}
            {f === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs rounded-full bg-amber-400 text-amber-900">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<CalendarX size={48} />}
          title="Nenhum agendamento"
          description="Não há agendamentos nesta categoria."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-2xl border border-stone-200 p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
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

                  <div className="mt-2 text-sm text-stone-500">
                    <span className="font-medium text-stone-700">
                      {booking.client?.full_name || 'Cliente'}
                    </span>
                    {booking.client?.phone && (
                      <span className="ml-2">· {booking.client.phone}</span>
                    )}
                  </div>

                  {booking.notes && (
                    <p className="mt-2 text-xs text-stone-400 italic bg-stone-50 rounded-lg px-3 py-2">
                      "{booking.notes}"
                    </p>
                  )}
                </div>

                {booking.status === 'pending' && (
                  <div className="flex gap-2 sm:flex-col">
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(booking.id, 'confirmed')}
                      disabled={processingId === booking.id}
                    >
                      {processingId === booking.id ? (
                        <Spinner className="w-4 h-4" />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      Confirmar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleUpdateStatus(booking.id, 'declined')}
                      disabled={processingId === booking.id}
                    >
                      <XCircle size={16} />
                      Recusar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
