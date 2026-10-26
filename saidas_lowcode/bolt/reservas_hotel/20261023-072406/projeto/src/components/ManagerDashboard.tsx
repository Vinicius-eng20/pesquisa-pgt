import { useState, useEffect, useCallback } from 'react';
import { Loader2, Hotel, CheckCircle2, XCircle, Clock, X, Plus, Pencil, Trash2, BedDouble, Users, Calendar, Star } from 'lucide-react';
import { supabase, type Room, type Reservation, type Profile } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatPrice, statusBadgeClass, statusLabel, roomImage } from '@/lib/utils';

type Tab = 'overview' | 'rooms' | 'reservations';

export function ManagerDashboard() {
  const { profile, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-amber-500 to-amber-700 rounded-lg flex items-center justify-center">
              <Hotel className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-none">Grand Hotel</h1>
              <p className="text-slate-400 text-xs mt-0.5">Gerente · {profile?.full_name}</p>
            </div>
          </div>
          <button onClick={signOut} className="text-slate-300 hover:text-white text-sm font-medium transition-colors flex items-center gap-1.5">
            <X className="w-4 h-4" /> Sair
          </button>
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-2 border-t border-slate-700/50">
          <TabButton active={tab === 'overview'} onClick={() => setTab('overview')} icon={Star}>Resumo</TabButton>
          <TabButton active={tab === 'rooms'} onClick={() => setTab('rooms')} icon={BedDouble}>Quartos</TabButton>
          <TabButton active={tab === 'reservations'} onClick={() => setTab('reservations')} icon={Calendar}>Reservas</TabButton>
        </div>
      </header>
      {tab === 'overview' && <Overview onGoToRooms={() => setTab('rooms')} />}
      {tab === 'rooms' && <ManageRooms />}
      {tab === 'reservations' && <ManageReservations />}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }: { active: boolean; onClick: () => void; icon: any; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${active ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
      <Icon className="w-4 h-4" /> {children}
    </button>
  );
}

function Overview({ onGoToRooms }: { onGoToRooms: () => void }) {
  const [stats, setStats] = useState({ totalRooms: 0, activeRooms: 0, pending: 0, confirmed: 0, totalRevenue: 0 });
  const [recentReservations, setRecentReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ data: rooms }, { data: reservations }] = await Promise.all([
        supabase.from('rooms').select('*'),
        supabase.from('reservations').select('*, room:rooms(*)').order('created_at', { ascending: false }).limit(5),
      ]);
      const allRooms = (rooms as Room[]) || [];
      const allRes = (reservations as any) || [];
      const confirmedRes = allRes.filter((r: any) => r.status === 'confirmed');
      setStats({
        totalRooms: allRooms.length,
        activeRooms: allRooms.filter((r) => r.is_active).length,
        pending: allRes.filter((r: any) => r.status === 'pending').length,
        confirmed: confirmedRes.length,
        totalRevenue: confirmedRes.reduce((sum: number, r: any) => sum + Number(r.total_price), 0),
      });
      setRecentReservations(allRes);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-12">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Quartos ativos" value={`${stats.activeRooms}/${stats.totalRooms}`} icon={BedDouble} color="bg-blue-500" />
        <StatCard label="Reservas pendentes" value={stats.pending} icon={Clock} color="bg-amber-500" />
        <StatCard label="Reservas confirmadas" value={stats.confirmed} icon={CheckCircle2} color="bg-green-500" />
        <StatCard label="Receita confirmada" value={formatPrice(stats.totalRevenue)} icon={Star} color="bg-emerald-600" />
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
        <h3 className="font-bold text-slate-900 mb-4">Reservas recentes</h3>
        {recentReservations.length === 0 ? (
          <p className="text-slate-500 text-sm py-6 text-center">Nenhuma reserva ainda.</p>
        ) : (
          <div className="space-y-3">
            {recentReservations.map((r) => (
              <div key={r.id} className="flex items-center justify-between flex-wrap gap-2 py-2 border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    <img src={roomImage(r.room!)} alt={r.room!.name} className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-slate-900">{r.room!.name}</p>
                    <p className="text-xs text-slate-500">{formatDate(r.check_in)} → {formatDate(r.check_out)}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusBadgeClass(r.status)}`}>{statusLabel(r.status)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-4 text-center">
        <button onClick={onGoToRooms} className="text-amber-600 hover:text-amber-700 text-sm font-medium">Gerenciar quartos →</button>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: any; color: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{label}</p>
    </div>
  );
}

const DEFAULT_IMAGES = [
  'https://images.pexels.com/photos/6434592/pexels-photo-6434592.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/2736384/pexels-photo-2736384.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/8082217/pexels-photo-8082217.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/8134808/pexels-photo-8134808.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/3688261/pexels-photo-3688261.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  'https://images.pexels.com/photos/7745929/pexels-photo-7745929.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
];

function ManageRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Room | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from('rooms').select('*').order('created_at', { ascending: false });
    setRooms((data as Room[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteRoom(id: string) {
    await supabase.from('rooms').delete().eq('id', id);
    load();
  }

  async function toggleActive(room: Room) {
    await supabase.from('rooms').update({ is_active: !room.is_active }).eq('id', room.id);
    load();
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 pb-12">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-slate-900">Quartos do hotel</h2>
        <button onClick={() => setCreating(true)} className="bg-amber-500 hover:bg-amber-600 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> Novo quarto
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map((room) => (
          <div key={room.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="h-36 overflow-hidden bg-slate-100 relative">
              <img src={roomImage(room)} alt={room.name} className="w-full h-full object-cover" />
              <span className={`absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded-full ${room.is_active ? 'bg-green-500 text-white' : 'bg-slate-500 text-white'}`}>
                {room.is_active ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="p-4">
              <h3 className="font-bold text-slate-900">{room.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-1 mb-2">{room.description}</p>
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="flex items-center gap-1 text-slate-600"><Users className="w-3.5 h-3.5" /> {room.capacity}</span>
                <span className="font-bold text-amber-600">{formatPrice(room.price_per_night)}<span className="text-xs text-slate-400 font-normal">/noite</span></span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditing(room)} className="flex-1 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg py-1.5 flex items-center justify-center gap-1.5 transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Editar
                </button>
                <button onClick={() => toggleActive(room)} className="px-3 text-sm font-medium text-slate-700 border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors">
                  {room.is_active ? 'Desativar' : 'Ativar'}
                </button>
                <button onClick={() => deleteRoom(room.id)} className="px-3 text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {(editing || creating) && (
        <RoomForm
          room={editing}
          onClose={() => { setEditing(null); setCreating(false); }}
          onSaved={() => { setEditing(null); setCreating(false); load(); }}
        />
      )}
    </div>
  );
}

function RoomForm({ room, onClose, onSaved }: { room: Room | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(room?.name || '');
  const [description, setDescription] = useState(room?.description || '');
  const [price, setPrice] = useState(room?.price_per_night?.toString() || '');
  const [capacity, setCapacity] = useState(room?.capacity || 2);
  const [imageUrl, setImageUrl] = useState(room?.image_url || DEFAULT_IMAGES[0]);
  const [amenities, setAmenities] = useState((room?.amenities || []).join(', '));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const payload = {
      name,
      description,
      price_per_night: parseFloat(price) || 0,
      capacity,
      image_url: imageUrl,
      amenities: amenities.split(',').map((a) => a.trim()).filter(Boolean),
      is_active: true,
    };
    const { error } = room
      ? await supabase.from('rooms').update(payload).eq('id', room.id)
      : await supabase.from('rooms').insert(payload);
    if (error) setError('Não foi possível salvar. Tente novamente.');
    else onSaved();
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-slate-100 sticky top-0 bg-white">
          <h3 className="font-bold text-lg text-slate-900">{room ? 'Editar quarto' : 'Novo quarto'}</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do quarto</label>
            <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" placeholder="Ex: Suíte Presidencial" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição</label>
            <textarea required value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none resize-none" placeholder="Descreva o quarto..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Preço por noite (R$)</label>
              <input type="number" required min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" placeholder="0,00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Capacidade</label>
              <input type="number" required min="1" value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value) || 1)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Foto do quarto</label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {DEFAULT_IMAGES.map((img) => (
                <button key={img} type="button" onClick={() => setImageUrl(img)} className={`h-20 rounded-lg overflow-hidden border-2 transition-all ${imageUrl === img ? 'border-amber-500 ring-2 ring-amber-200' : 'border-slate-200'}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
            <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" placeholder="Ou cole uma URL de imagem" />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Comodidades (separadas por vírgula)</label>
            <input type="text" value={amenities} onChange={(e) => setAmenities(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent outline-none" placeholder="Wi-Fi, Ar condicionado, TV, Café da manhã" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
        </form>
        <div className="p-5 border-t border-slate-100 flex gap-3 sticky bottom-0 bg-white">
          <button onClick={onClose} className="flex-1 border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

function ManageReservations() {
  const [reservations, setReservations] = useState<(Reservation & { room: Room; guest_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'confirmed' | 'rejected' | 'cancelled'>('all');

  const load = useCallback(async () => {
    const { data: resData } = await supabase
      .from('reservations')
      .select('*, room:rooms(*)')
      .order('created_at', { ascending: false });
    const resList = (resData as any) || [];
    const guestIds = [...new Set(resList.map((r: any) => r.guest_id))];
    const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', guestIds);
    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
    setReservations(resList.map((r: any) => ({ ...r, guest_name: profileMap.get(r.guest_id) || 'Hóspede' })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id: string, status: Reservation['status']) {
    await supabase.from('reservations').update({ status }).eq('id', id);
    load();
  }

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-amber-500 animate-spin" /></div>;

  const filtered = filter === 'all' ? reservations : reservations.filter((r) => r.status === filter);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-12">
      <div className="flex gap-2 flex-wrap mb-5">
        {(['all', 'pending', 'confirmed', 'rejected', 'cancelled'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`text-sm font-medium px-3 py-1.5 rounded-lg transition-colors ${filter === f ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
            {f === 'all' ? 'Todas' : statusLabel(f)}
          </button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Nenhuma reserva {filter !== 'all' ? `com status "${statusLabel(filter)}"` : ''} encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div key={r.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="sm:w-28 h-20 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                  <img src={roomImage(r.room)} alt={r.room.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="font-bold text-slate-900">{r.room.name}</h3>
                      <p className="text-sm text-slate-500">{r.guest_name} · {formatDate(r.check_in)} → {formatDate(r.check_out)}</p>
                    </div>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusBadgeClass(r.status)}`}>{statusLabel(r.status)}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
                    <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-slate-400" /> {r.guests_count}</span>
                    <span className="font-semibold text-slate-900">{formatPrice(r.total_price)}</span>
                    {r.notes && <span className="text-xs text-slate-400 italic truncate max-w-32">"{r.notes}"</span>}
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => updateStatus(r.id, 'confirmed')} className="text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" /> Confirmar
                      </button>
                      <button onClick={() => updateStatus(r.id, 'rejected')} className="text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                        <XCircle className="w-4 h-4" /> Recusar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
