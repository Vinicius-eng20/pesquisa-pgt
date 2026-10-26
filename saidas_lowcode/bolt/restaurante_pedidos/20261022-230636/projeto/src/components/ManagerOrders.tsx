import { useState, useEffect, useCallback } from 'react';
import { supabase, type OrderWithItems, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, formatCurrency, formatDate, type OrderStatus } from '@/lib/supabase';

const STATUS_FLOW: OrderStatus[] = ['pending', 'preparing', 'ready', 'delivered', 'cancelled'];

export function ManagerOrders() {
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');

  const loadOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading orders:', error);
    } else {
      setOrders(data as OrderWithItems[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(loadOrders, 4000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  async function updateStatus(id: string, status: OrderStatus) {
    const { error } = await supabase.from('orders').update({ status }).eq('id', id);
    if (error) {
      console.error('Error updating status:', error);
      alert('Erro ao atualizar status.');
    } else {
      await loadOrders();
    }
  }

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.status === filter);

  const counts = {
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 animate-pulse">Carregando pedidos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">Todos os Pedidos</h1>
        <p className="text-stone-500 text-sm mb-5">Gerencie os pedidos de todos os clientes</p>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-4">
          <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="Todos" count={counts.all} />
          <FilterChip active={filter === 'pending'} onClick={() => setFilter('pending')} label="Recebidos" count={counts.pending} color="blue" />
          <FilterChip active={filter === 'preparing'} onClick={() => setFilter('preparing')} label="Em preparo" count={counts.preparing} color="amber" />
          <FilterChip active={filter === 'ready'} onClick={() => setFilter('ready')} label="Prontos" count={counts.ready} color="green" />
          <FilterChip active={filter === 'delivered'} onClick={() => setFilter('delivered')} label="Entregues" count={counts.delivered} color="gray" />
          <FilterChip active={filter === 'cancelled'} onClick={() => setFilter('cancelled')} label="Cancelados" count={counts.cancelled} color="red" />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-stone-400">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <p className="font-medium text-stone-500">Nenhum pedido nesta categoria</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
                <div className="flex items-start justify-between px-5 py-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-stone-900">{order.customer_name}</h3>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${ORDER_STATUS_COLORS[order.status]}`}>
                        {ORDER_STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <p className="text-xs text-stone-400 mt-1">{formatDate(order.created_at)}</p>
                    {order.table_number && (
                      <p className="text-sm text-stone-600 mt-0.5">{order.table_number}</p>
                    )}
                  </div>
                  <span className="text-lg font-bold text-stone-900">{formatCurrency(order.total)}</span>
                </div>

                <div className="px-5 pb-3 space-y-1">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-stone-700">
                        <span className="font-semibold text-stone-900">{item.quantity}x</span> {item.name}
                      </span>
                      <span className="text-stone-500">{formatCurrency(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>

                {order.notes && (
                  <div className="px-5 pb-3">
                    <p className="text-xs text-stone-400 bg-stone-50 rounded-lg px-3 py-2">
                      <span className="font-medium">Obs:</span> {order.notes}
                    </p>
                  </div>
                )}

                {/* Status controls */}
                {order.status !== 'delivered' && order.status !== 'cancelled' && (
                  <div className="border-t border-stone-50 px-5 py-3">
                    <p className="text-xs font-medium text-stone-400 mb-2">Mudar status:</p>
                    <div className="flex flex-wrap gap-2">
                      {STATUS_FLOW.map((s) => (
                        <button
                          key={s}
                          onClick={() => updateStatus(order.id, s)}
                          disabled={order.status === s}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            order.status === s
                              ? `${ORDER_STATUS_COLORS[s]} border opacity-60 cursor-default`
                              : 'bg-stone-50 text-stone-600 border border-stone-200 hover:bg-stone-100 hover:border-stone-300'
                          }`}
                        >
                          {ORDER_STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type FilterChipProps = {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  color?: string;
};

function FilterChip({ active, onClick, label, count }: FilterChipProps) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
        active
          ? 'bg-stone-900 text-white shadow-md'
          : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300'
      }`}
    >
      {label}
      {count > 0 && (
        <span className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
          active ? 'bg-white/20' : 'bg-stone-100'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}
