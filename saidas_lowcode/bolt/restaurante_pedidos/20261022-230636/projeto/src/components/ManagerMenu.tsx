import { useState, useEffect, useCallback } from 'react';
import { supabase, type MenuItem, formatCurrency, CATEGORIES } from '@/lib/supabase';
import { MenuItemForm } from '@/components/MenuItemForm';

export function ManagerMenu() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);

  const loadItems = useCallback(async () => {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      console.error('Error loading items:', error);
    } else {
      setItems(data as MenuItem[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  function handleEdit(item: MenuItem) {
    setEditing(item);
    setFormOpen(true);
  }

  function handleNew() {
    setEditing(null);
    setFormOpen(true);
  }

  async function handleToggleAvailable(item: MenuItem) {
    const { error } = await supabase
      .from('menu_items')
      .update({ available: !item.available })
      .eq('id', item.id);
    if (error) {
      console.error('Error toggling availability:', error);
    } else {
      await loadItems();
    }
  }

  async function handleDelete(item: MenuItem) {
    if (!confirm(`Remover "${item.name}" do cardápio?`)) return;
    const { error } = await supabase.from('menu_items').delete().eq('id', item.id);
    if (error) {
      console.error('Error deleting item:', error);
      alert('Erro ao remover item.');
    } else {
      await loadItems();
    }
  }

  const grouped = items.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Gerenciar Cardápio</h1>
            <p className="text-stone-500 text-sm mt-0.5">{items.length} pratos cadastrados</p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl transition-all shadow-sm text-sm active:scale-95"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Novo Prato
          </button>
        </div>

        {loading ? (
          <div className="text-center py-16 text-stone-400 animate-pulse">Carregando...</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-stone-400">
            <p className="font-medium text-stone-500 mb-1">Nenhum prato no cardápio</p>
            <p className="text-sm">Clique em "Novo Prato" para começar</p>
          </div>
        ) : (
          <div className="space-y-6">
            {CATEGORIES.map((category) => {
              const categoryItems = grouped[category];
              if (!categoryItems || categoryItems.length === 0) return null;
              return (
                <div key={category}>
                  <h2 className="text-sm font-bold text-stone-500 uppercase tracking-wide mb-3">{category}</h2>
                  <div className="space-y-2">
                    {categoryItems.map((item) => (
                      <div
                        key={item.id}
                        className={`bg-white rounded-2xl border border-stone-100 shadow-sm flex items-center gap-4 p-4 transition-all ${
                          !item.available ? 'opacity-60' : ''
                        }`}
                      >
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-stone-100 flex items-center justify-center flex-shrink-0">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-stone-300">
                              <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                              <path d="M7 2v20" />
                              <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                            </svg>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-stone-900 truncate">{item.name}</h3>
                          {item.description && (
                            <p className="text-sm text-stone-500 truncate">{item.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="font-bold text-amber-600">{formatCurrency(item.price)}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              item.available ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'
                            }`}>
                              {item.available ? 'Disponível' : 'Indisponível'}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => handleToggleAvailable(item)}
                            title={item.available ? 'Marcar indisponível' : 'Marcar disponível'}
                            className="p-2.5 hover:bg-stone-100 rounded-xl transition-colors text-stone-500"
                          >
                            {item.available ? (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                                <circle cx="12" cy="12" r="3" />
                              </svg>
                            ) : (
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                                <line x1="2" y1="2" x2="22" y2="22" />
                              </svg>
                            )}
                          </button>
                          <button
                            onClick={() => handleEdit(item)}
                            title="Editar"
                            className="p-2.5 hover:bg-stone-100 rounded-xl transition-colors text-stone-500"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            title="Remover"
                            className="p-2.5 hover:bg-red-50 rounded-xl transition-colors text-red-500"
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                              <line x1="10" y1="11" x2="10" y2="17" />
                              <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <MenuItemForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        editing={editing}
        onSaved={loadItems}
      />
    </div>
  );
}
