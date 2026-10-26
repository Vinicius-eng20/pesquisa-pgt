import { useState, useEffect, useCallback } from 'react';
import { supabase, type OrderWithItems, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, formatCurrency, formatDate, type OrderStatus } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export function CustomerOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<OrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!profile) return;
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading orders:', error);
    } else {
      setOrders(data as OrderWithItems[]);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(loadOrders, 5000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  async function cancelOrder(id: string) {
    setCancelling(id);
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error cancelling order:', error);
    } else {
      await loadOrders();
    }
    setCancelling(null);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 animate-pulse">Carregando pedidos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold text-stone-900 mb-1">Meus Pedidos</h1>
        <p className="text-stone-500 text-sm mb-6">Acompanhe o status dos seus pedidos</p>

        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-stone-400">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-4">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
              <path d="M3 6h18" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
            <p className="font-medium text-stone-500">Você ainda não fez pedidos</p>
            <p className="text-sm mt-1">Explore o cardápio e faça seu primeiro pedido!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-stone-50">
                  <div>
                    <p className="text-xs text-stone-400">{formatDate(order.created_at)}</p>
                    {order.table_number && (
                      <p className="text-sm text-stone-600 mt-0.5">{order.table_number}</p>
                    )}
                  </div>
                  <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${ORDER_STATUS_COLORS[order.status as OrderStatus]}`}>
                    {ORDER_STATUS_LABELS[order.status as OrderStatus]}
                  </span>
                </div>

                <div className="px-5 py-4 space-y-2">
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

                <div className="flex items-center justify-between px-5 py-3 border-t border-stone-50">
                  <span className="text-sm text-stone-500">Total</span>
                  <span className="text-lg font-bold text-stone-900">{formatCurrency(order.total)}</span>
                </div>

                {order.status === 'pending' && (
                  <div className="px-5 pb-4">
                    <button
                      onClick={() => cancelOrder(order.id)}
                      disabled={cancelling === order.id}
                      className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors disabled:opacity-50"
                    >
                      {cancelling === order.id ? 'Cancelando...' : 'Cancelar pedido'}
                    </button>
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
