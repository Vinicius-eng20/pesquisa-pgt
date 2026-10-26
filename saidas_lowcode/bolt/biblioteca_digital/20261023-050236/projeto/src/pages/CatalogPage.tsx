import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, Loader2, BookOpen, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Item, ItemType, Loan } from '@/lib/types';
import { ITEM_TYPE_LABELS, ITEM_TYPES } from '@/lib/types';
import { ItemCard } from '@/components/ItemCard';
import { ItemTypeIcon } from '@/components/ItemTypeIcon';
import { Modal } from '@/components/Modal';

export function CatalogPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ItemType | 'all'>('all');
  const [borrowedItemIds, setBorrowedItemIds] = useState<Set<string>>(new Set());
  const [borrowing, setBorrowing] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const isLibrarian = profile?.role === 'librarian';
  const isBlocked = profile?.blocked === true;

  const loadData = useCallback(async () => {
    setLoading(true);
    const [itemsRes, loansRes] = await Promise.all([
      supabase.from('items').select('*').order('created_at', { ascending: false }),
      supabase.from('loans').select('item_id').eq('returned_at', null),
    ]);
    setItems(itemsRes.data as Item[]);
    const ids = new Set((loansRes.data as { item_id: string }[])?.map((l) => l.item_id) ?? []);
    setBorrowedItemIds(ids);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    });
  }, [items, search, typeFilter]);

  async function handleBorrow(item: Item) {
    setBorrowing(item.id);
    const { error } = await supabase.rpc('borrow_item', { p_item_id: item.id, p_loan_days: 14 });
    if (error) {
      setToast({ type: 'error', msg: error.message });
    } else {
      setToast({ type: 'success', msg: `"${item.title}" emprestado com sucesso! Devolução em 14 dias.` });
      await loadData();
    }
    setBorrowing(null);
    setTimeout(() => setToast(null), 4000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-semibold text-gray-900">Acervo</h1>
        <p className="text-sm text-gray-500 mt-1">
          Busque e pegue emprestado itens disponíveis na biblioteca.
        </p>
      </div>

      {isBlocked && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Conta bloqueada para novos empréstimos</p>
            <p className="text-sm text-red-600 mt-0.5">
              Você tem itens com atraso na devolução. Devolva-os para voltar a pegar itens emprestados.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título, autor ou descrição..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as ItemType | 'all')}
          className="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition cursor-pointer"
        >
          <option value="all">Todos os tipos</option>
          {ITEM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-gray-400">Nenhum item encontrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              canBorrow={!isLibrarian && !isBlocked}
              isBorrowed={borrowedItemIds.has(item.id)}
              onBorrow={handleBorrow}
            />
          ))}
        </div>
      )}

      {borrowing && (
        <Modal open={true} onClose={() => setBorrowing(null)} title="Processando empréstimo">
          <div className="flex items-center gap-3 py-4">
            <Loader2 className="w-5 h-5 animate-spin text-brand-500" />
            <span className="text-gray-600 text-sm">Pegando item emprestado...</span>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
          <div className={`px-5 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
