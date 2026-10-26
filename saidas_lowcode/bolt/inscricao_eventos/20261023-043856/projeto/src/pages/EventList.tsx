import { useEffect, useState } from 'react';
import { Calendar, MapPin, Users, Search, Loader2, CalendarOff } from 'lucide-react';
import { supabase, type EventItem } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export default function EventList({ onSelectEvent }: { onSelectEvent: (id: string) => void }) {
  const { user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [registrationCounts, setRegistrationCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'open')
      .order('date', { ascending: true });

    if (error) {
      console.error('Error loading events:', error);
    } else {
      setEvents(data as EventItem[]);
      // Load registration counts
      const counts: Record<string, number> = {};
      for (const ev of data as EventItem[]) {
        const { count } = await supabase
          .from('registrations')
          .select('*', { count: 'exact', head: true })
          .eq('event_id', ev.id)
          .neq('status', 'cancelled');
        counts[ev.id] = count ?? 0;
      }
      setRegistrationCounts(counts);
    }
    setLoading(false);
  };

  const filtered = events.filter(
    (ev) =>
      ev.title.toLowerCase().includes(search.toLowerCase()) ||
      ev.location.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Eventos disponíveis</h1>
        <p className="text-slate-500 mt-1">Inscreva-se nos eventos que tem interesse</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por título ou local..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <CalendarOff className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhum evento encontrado.</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ev) => {
            const count = registrationCounts[ev.id] ?? 0;
            const full = ev.capacity > 0 && count >= ev.capacity;
            return (
              <button
                key={ev.id}
                onClick={() => onSelectEvent(ev.id)}
                className="group text-left bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:border-teal-200 transition-all duration-200"
              >
                <div className="aspect-video bg-gradient-to-br from-teal-100 to-cyan-100 relative overflow-hidden">
                  {ev.image_url ? (
                    <img
                      src={ev.image_url}
                      alt={ev.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="w-10 h-10 text-teal-400" />
                    </div>
                  )}
                  {full && (
                    <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                      Lotado
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-slate-900 mb-2 line-clamp-1 group-hover:text-teal-700 transition-colors">
                    {ev.title}
                  </h3>
                  <div className="space-y-1.5 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="line-clamp-1">{formatDate(ev.date)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="line-clamp-1">{ev.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {count}
                        {ev.capacity > 0 && ` / ${ev.capacity}`} inscritos
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
