import { useEffect, useState, type FormEvent } from 'react';
import {
  Plus,
  Loader2,
  Calendar,
  MapPin,
  Users,
  Pencil,
  X,
  Trash2,
  AlertCircle,
  XCircle,
} from 'lucide-react';
import { supabase, type EventItem } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

type EditData = {
  title: string;
  description: string;
  date: string;
  location: string;
  capacity: string;
  image_url: string;
};

const emptyForm: EditData = {
  title: '',
  description: '',
  date: '',
  location: '',
  capacity: '',
  image_url: '',
};

export default function ManageEvents() {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [form, setForm] = useState<EditData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditingEvent(null);
    setForm(emptyForm);
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (ev: EventItem) => {
    setEditingEvent(ev);
    const dateLocal = new Date(ev.date);
    const offset = dateLocal.getTimezoneOffset();
    const localDate = new Date(dateLocal.getTime() - offset * 60000);
    setForm({
      title: ev.title,
      description: ev.description,
      date: localDate.toISOString().slice(0, 16),
      location: ev.location,
      capacity: ev.capacity > 0 ? String(ev.capacity) : '',
      image_url: ev.image_url ?? '',
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);

    if (!form.title.trim() || !form.date || !form.location.trim()) {
      setFormError('Título, data e local são obrigatórios.');
      setSaving(false);
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      date: new Date(form.date).toISOString(),
      location: form.location.trim(),
      capacity: form.capacity ? parseInt(form.capacity, 10) : 0,
      image_url: form.image_url.trim() || null,
    };

    if (editingEvent) {
      const { error } = await supabase
        .from('events')
        .update(payload)
        .eq('id', editingEvent.id);
      if (error) {
        setFormError('Erro ao atualizar evento.');
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from('events').insert(payload);
      if (error) {
        setFormError('Erro ao criar evento.');
        setSaving(false);
        return;
      }
    }

    setShowModal(false);
    await loadEvents();
    setSaving(false);
  };

  const handleCancelEvent = async (ev: EventItem) => {
    const { error } = await supabase
      .from('events')
      .update({ status: 'cancelled' })
      .eq('id', ev.id);
    if (!error) {
      await loadEvents();
    }
  };

  const handleReactivateEvent = async (ev: EventItem) => {
    const { error } = await supabase
      .from('events')
      .update({ status: 'open' })
      .eq('id', ev.id);
    if (!error) {
      await loadEvents();
    }
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gerenciar eventos</h1>
          <p className="text-slate-500 mt-1">Crie, edite e cancele os seus eventos</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-teal-600 hover:bg-teal-700 text-white font-semibold px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-lg shadow-teal-600/20"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Novo evento</span>
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-20">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Você ainda não criou nenhum evento.</p>
          <button
            onClick={openCreate}
            className="text-teal-600 hover:text-teal-700 font-medium mt-4"
          >
            Criar primeiro evento
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((ev) => {
            const isCancelled = ev.status === 'cancelled';
            return (
              <div
                key={ev.id}
                className={`bg-white rounded-2xl border p-5 transition-all ${
                  isCancelled ? 'border-slate-200 opacity-75' : 'border-slate-200 hover:shadow-md'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 truncate">{ev.title}</h3>
                      {isCancelled && (
                        <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">
                          Cancelado
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(ev.date)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {ev.location}
                      </div>
                      {ev.capacity > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5" />
                          {ev.capacity} vagas
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => openEdit(ev)}
                      className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {isCancelled ? (
                      <button
                        onClick={() => handleReactivateEvent(ev)}
                        className="p-2 rounded-lg text-teal-600 hover:bg-teal-50 transition-colors"
                        title="Reativar"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCancelEvent(ev)}
                        className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                        title="Cancelar evento"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {editingEvent ? 'Editar evento' : 'Novo evento'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Título <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Nome do evento"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Data e hora <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Local <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Endereço ou nome do local"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Capacidade (vagas)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.capacity}
                  onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                  placeholder="0 = sem limite"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  URL da imagem (opcional)
                </label>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Descrição
                </label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detalhes sobre o evento..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent resize-none"
                />
              </div>

              {formError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingEvent ? 'Salvar' : 'Criar evento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
