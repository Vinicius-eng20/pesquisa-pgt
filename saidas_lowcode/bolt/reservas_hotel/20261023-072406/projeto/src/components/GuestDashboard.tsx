import { useState, useEffect, useCallback } from 'react';
import { Calendar, Users, Search, Loader2, Hotel, CheckCircle2, XCircle, Clock, X, BedDouble, Wifi, Wind, Coffee, Tv, Minus, Plus } from 'lucide-react';
import { supabase, type Room, type Reservation } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatPrice, nightsBetween, calcTotal, statusBadgeClass, statusLabel, roomImage } from '@/lib/utils';

type Tab = 'search' | 'reservations';

export function GuestDashboard() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('search');

  return (
    <div className="min-h-screen bg-slate-50">
      <Header name={profile?.full_name || 'Hóspede'} onSignOut={signOut} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-6">
        <div className="flex gap-2 border-b border-slate-200 mb-6">
          <TabButton active={tab === 'search'} onClick={() => setTab('search')} icon={Search}>Buscar quartos</TabButton>
          <TabButton active={tab === 'reservations'} onClick={() => setTab('reservations')} icon={Calendar}>Minhas reservas</TabButton>
        </div>
      </div>
      {tab === 'search' ? <RoomSearch /> : <MyReservations />}
    </div>
  );
}

function Header({ name, onSignOut }: { name: string; onSignOut: () => void }) {
  return (
    <header className="bg-slate-900 text-white shadow-lg">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg flex items-center justify-center">
            <Hotel className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-none">Grand Hotel</h1>
            <p className="text-slate-400 text-xs mt-0.5">Olá, {name}</p>
          </div>
        </div>
        <button onClick={onSignOut} className="text-slate-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5">
          <X className="w-4 h-4" /> Sair
        </button>
      </div>
    </header>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: any; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
        active ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className="w-4 h-4" /> {children}
    </button>
  );
}

function RoomSearch() {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const [checkIn, setCheckIn] = useState(today);
  const [checkOut, setCheckOut] = useState(tomorrow);
  const [guests, setGuests] = useState(1);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [bookingRoom, setBookingRoom] = useState<Room | null>(null);

  const searchRooms = useCallback(async () => {
    if (!checkIn || !checkOut || checkOut <= checkIn) return;
    setLoading(true);
    setSearched(true);
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true)
      .gte('capacity', guests)
      .order('price_per_night', { ascending: true });

    if (data) {
      const { data: reservations } = await supabase
        .from('reservations')
        .select('room_id')
        .in('status', ['pending', 'confirmed'])
        .or(`check_in.lte.${checkOut},check_out.gt.${checkIn}`);

      const bookedRoomIds = new Set((reservations || []).map((r: any) => r.room_id));
      setRooms(data.filter((r: Room) => !bookedRoomIds.has(r.id)));
    }
    setLoading(false);
  }, [checkIn, checkOut, guests]);

  useEffect(() => {
    searchRooms();
  }, [searchRooms]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Check-in</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Check-out</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input type="date" min={checkIn} value={checkOut} onChange={(e) => setCheckOut(e.target.value)} className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Hóspedes</label>
            <div className="flex items-center gap-2 border border-slate-300 rounded-lg px-3 py-2">
              <button onClick={() => setGuests(Math.max(1, guests - 1))} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors"><Minus className="w-4 h-4 text-slate-600" /></button>
              <span className="flex-1 text-center text-sm font-medium">{guests}</span>
              <button onClick={() => setGuests(Math.min(10, guests + 1))} className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-slate-100 transition-colors"><Plus className="w-4 h-4 text-slate-600" /></button>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>
      ) : rooms.length === 0 && searched ? (
        <div className="text-center py-20">
          <BedDouble className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-lg">Nenhum quarto disponível para as datas selecionadas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} checkIn={checkIn} checkOut={checkOut} guests={guests} onBook={() => setBookingRoom(room)} />
          ))}
        </div>
      )}

      {bookingRoom && (
        <BookingModal
          room={bookingRoom}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          onClose={() => setBookingRoom(null)}
          onConfirm={() => { setBookingRoom(null); searchRooms(); }}
        />
      )}
    </div>
  );
}

function amenityIcon(amenity: string) {
  const a = amenity.toLowerCase();
  if (a.includes('wifi') || a.includes('wi-fi')) return Wifi;
  if (a.includes('ar') || a.includes('condicionado') || a.includes('ar')) return Wind;
  if (a.includes('café') || a.includes('cafe') || a.includes('breakfast')) return Coffee;
  if (a.includes('tv') || a.includes('televisão')) return Tv;
  return BedDouble;
}

function RoomCard({ room, checkIn, checkOut, guests, onBook }: { room: Room; checkIn: string; checkOut: string; guests: number; onBook: () => void }) {
  const nights = nightsBetween(checkIn, checkOut);
  const total = calcTotal(room.price_per_night, checkIn, checkOut);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-48 overflow-hidden bg-slate-100">
        <img src={roomImage(room)} alt={room.name} className="w-full h-full object-cover" />
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-bold text-slate-900 text-lg">{room.name}</h3>
          <span className="text-amber-600 font-bold text-lg">{formatPrice(room.price_per_night)}<span className="text-slate-400 text-xs font-normal">/noite</span></span>
        </div>
        <p className="text-slate-500 text-sm mb-3 line-clamp-2">{room.description}</p>
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
          <Users className="w-4 h-4 text-slate-400" /> Até {room.capacity} hóspedes
        </div>
        {room.amenities.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {room.amenities.map((a, i) => {
              const Icon = amenityIcon(a);
              return (
                <span key={i} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-md">
                  <Icon className="w-3 h-3" /> {a}
                </span>
              );
            })}
          </div>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-slate-100">
          <div className="text-sm text-slate-600">
            <span className="font-semibold text-slate-900">{nights} {nights === 1 ? 'noite' : 'noites'}</span> · {formatPrice(total)}
          </div>
          <button onClick={onBook} className="bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors">
            Reservar
          </button>
        </div>
      </div>
    </div>
  );
}

function BookingModal({ room, checkIn, checkOut, guests, onClose, onConfirm }: { room: Room; checkIn: string; checkOut: string; guests: number; onClose: () => void; onConfirm: () => void }) {
  const { session } = useAuth();
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const nights = nightsBetween(checkIn, checkOut);
  const total = calcTotal(room.price_per_night, checkIn, checkOut);

  async function handleConfirm() {
    setLoading(true);
    setError('');
    const { error } = await supabase.from('reservations').insert({
      room_id: room.id,
      guest_id: session!.user.id,
      check_in: checkIn,
      check_out: checkOut,
      guests_count: guests,
      total_price: total,
      notes,
      status: 'pending',
    });
    if (error) setError('Não foi possível criar a reserva. Tente novamente.');
    else onConfirm();
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-lg text-slate-900">Confirmar reserva</h3>
          <p className="text-sm text-slate-500">{room.name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Check-in</span><span className="font-medium">{formatDate(checkIn)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Check-out</span><span className="font-medium">{formatDate(checkOut)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Hóspedes</span><span className="font-medium">{guests}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Noites</span><span className="font-medium">{nights}</span>
          </div>
          <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
            <span className="text-slate-500">Preço por noite</span><span className="font-medium">{formatPrice(room.price_per_night)}</span>
          </div>
          <div className="flex justify-between text-base pt-2 border-t border-slate-100">
            <span className="font-semibold text-slate-900">Total</span><span className="font-bold text-amber-600">{formatPrice(total)}</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Observações (opcional)</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none resize-none" placeholder="Pedidos especiais, horário de chegada, etc." />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <p className="text-xs text-slate-400 bg-amber-50 border border-amber-100 rounded-lg p-3">
            A sua reserva será criada como <strong>pendente</strong> e o gerente do hotel irá confirmá-la.
          </p>
        </div>
        <div className="p-5 border-t border-slate-100 flex gap-3">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={handleConfirm} disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

function MyReservations() {
  const { session } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('reservations')
      .select('*, room:rooms(*)')
      .eq('guest_id', session!.user.id)
      .order('created_at', { ascending: false });
    setReservations((data as any) || []);
    setLoading(false);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  async function cancelReservation(id: string) {
    await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', id);
    load();
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>;

  if (reservations.length === 0) return (
    <div className="text-center py-20">
      <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-500 text-lg">Você ainda não tem reservas.</p>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-12 space-y-4">
      {reservations.map((r) => (
        <div key={r.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="sm:w-32 h-24 rounded-lg overflow-hidden bg-slate-100 shrink-0">
              <img src={roomImage(r.room!)} alt={r.room!.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="flex items-start justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-bold text-slate-900">{r.room!.name}</h3>
                  <p className="text-sm text-slate-500">{formatDate(r.check_in)} → {formatDate(r.check_out)}</p>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${statusBadgeClass(r.status)}`}>
                  {r.status === 'pending' && <Clock className="w-3 h-3" />}
                  {r.status === 'confirmed' && <CheckCircle2 className="w-3 h-3" />}
                  {(r.status === 'rejected' || r.status === 'cancelled') && <XCircle className="w-3 h-3" />}
                  {statusLabel(r.status)}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-3 text-sm text-slate-600">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" /> {r.guests_count} hóspede{r.guests_count > 1 ? 's' : ''}</span>
                <span className="font-semibold text-slate-900">{formatPrice(r.total_price)}</span>
              </div>
              {(r.status === 'pending' || r.status === 'confirmed') && (
                <button onClick={() => cancelReservation(r.id)} className="mt-3 text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1 transition-colors">
                  <X className="w-4 h-4" /> Cancelar reserva
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
