import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type MenuItem, formatCurrency, CATEGORIES } from '@/lib/supabase';
import { Cart } from '@/components/Cart';

export function CustomerMenu() {
  const { profile } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadMenu = useCallback(async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .eq('available', true)
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading menu:', error);
    } else {
      setItems(data as MenuItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  const categories = ['all', ...CATEGORIES.filter((c) => items.some((i) => i.category === c))];

  const filtered = items.filter((item) => {
    const matchesCat = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = search === '' || item.name.toLowerCase().includes(search.toLowerCase()) || item.description.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const grouped = filtered.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  function addToCart(id: string) {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
    setToast('Item adicionado ao pedido');
    setTimeout(() => setToast(null), 1500);
  }

  function removeFromCart(id: string) {
    setCart((prev) => {
      const next = { ...prev };
      const current = next[id] || 0;
      if (current <= 1) delete next[id];
      else next[id] = current - 1;
      return next;
    });
  }

  function setQty(id: string, qty: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });
  }

  const cartItems = Object.entries(cart).map(([id, qty]) => {
    const item = items.find((i) => i.id === id);
    return item ? { item, qty } : null;
  }).filter(Boolean) as { item: MenuItem; qty: number }[];

  const cartTotal = cartItems.reduce((sum, { item, qty }) => sum + item.price * qty, 0);
  const cartCount = cartItems.reduce((sum, { qty }) => sum + qty, 0);

  async function placeOrder(tableNumber: string, notes: string) {
    if (!profile) return;
    const total = cartTotal;

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: profile.id,
        customer_name: profile.full_name || profile.email,
        status: 'pending',
        table_number: tableNumber,
        notes,
        total,
      })
      .select()
      .single();

    if (orderError) throw new Error(orderError.message);

    const orderItems = cartItems.map(({ item, qty }) => ({
      order_id: orderData.id,
      menu_item_id: item.id,
      name: item.name,
      price: item.price,
      quantity: qty,
    }));

    const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
    if (itemsError) throw new Error(itemsError.message);

    setCart({});
    setCartOpen(false);
    return orderData;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-stone-400 animate-pulse">Carregando cardápio...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 pb-32">
      {/* Hero */}
      <div className="relative h-48 bg-gradient-to-br from-stone-800 to-stone-900 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-600 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
          <h1 className="text-3xl font-bold text-white tracking-tight">Cardápio</h1>
          <p className="text-stone-300 mt-1 text-sm">Escolha seus pratos e faça seu pedido</p>
        </div>
      </div>

      {/* Search */}
      <div className="max-w-5xl mx-auto px-4 -mt-6 relative z-20">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar prato..."
          className="w-full px-5 py-3.5 rounded-2xl bg-white shadow-lg border border-stone-100 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-stone-900"
        />
      </div>

      {/* Category tabs */}
      <div className="max-w-5xl mx-auto px-4 mt-4">
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? 'bg-stone-900 text-white shadow-md'
                  : 'bg-white text-stone-600 border border-stone-200 hover:border-stone-300'
              }`}
            >
              {cat === 'all' ? 'Todos' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu items */}
      <div className="max-w-5xl mx-auto px-4 mt-6 space-y-8">
        {Object.entries(grouped).map(([category, categoryItems]) => (
          <div key={category}>
            <h2 className="text-lg font-bold text-stone-800 mb-3 flex items-center gap-2">
              {category}
              <span className="text-sm font-normal text-stone-400">({categoryItems.length})</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-stone-100 hover:shadow-md transition-all group"
                >
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-36 bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center">
                      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-stone-300">
                        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                        <path d="M7 2v20" />
                        <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                      </svg>
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-semibold text-stone-900 leading-snug">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-stone-500 mt-1 line-clamp-2 leading-relaxed">{item.description}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <span className="text-lg font-bold text-amber-600">{formatCurrency(item.price)}</span>
                      <button
                        onClick={() => addToCart(item.id)}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl transition-all shadow-sm hover:shadow-md active:scale-95"
                      >
                        Adicionar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-stone-400">Nenhum prato encontrado.</p>
          </div>
        )}
      </div>

      {/* Floating cart button */}
      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 left-4 right-4 max-w-md mx-auto z-30 flex items-center justify-between bg-stone-900 text-white px-5 py-4 rounded-2xl shadow-2xl hover:bg-stone-800 transition-all active:scale-[0.98]"
        >
          <span className="flex items-center gap-3">
            <span className="flex items-center justify-center w-8 h-8 bg-amber-500 rounded-lg font-bold text-sm">
              {cartCount}
            </span>
            <span className="font-semibold">Ver meu pedido</span>
          </span>
          <span className="font-bold text-amber-400">{formatCurrency(cartTotal)}</span>
        </button>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 bg-stone-900 text-white text-sm px-5 py-2.5 rounded-full shadow-lg animate-[fadeIn_0.2s_ease]">
          {toast}
        </div>
      )}

      {/* Cart drawer */}
      <Cart
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cartItems={cartItems}
        total={cartTotal}
        onAdd={addToCart}
        onRemove={removeFromCart}
        onSetQty={setQty}
        onPlaceOrder={placeOrder}
      />
    </div>
  );
}
