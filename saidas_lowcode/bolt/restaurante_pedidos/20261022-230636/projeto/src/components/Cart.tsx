import { useState } from 'react';
import type { MenuItem } from '@/lib/supabase';
import { formatCurrency } from '@/lib/supabase';

type CartItem = { item: MenuItem; qty: number };

type CartProps = {
  open: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  total: number;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onSetQty: (id: string, qty: number) => void;
  onPlaceOrder: (tableNumber: string, notes: string) => Promise<unknown>;
};

export function Cart({ open, onClose, cartItems, total, onAdd, onRemove, onSetQty, onPlaceOrder }: CartProps) {
  const [tableNumber, setTableNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit() {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      await onPlaceOrder(tableNumber.trim(), notes.trim());
      setSuccess(true);
      setTableNumber('');
      setNotes('');
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar pedido');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-full max-w-md bg-white z-50 shadow-2xl transition-transform duration-300 flex flex-col ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="text-lg font-bold text-stone-900">Meu Pedido</h2>
          <button onClick={onClose} className="p-2 hover:bg-stone-100 rounded-lg transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-stone-500">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {success ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-stone-900">Pedido enviado!</h3>
            <p className="text-stone-500 mt-1 text-sm">Acompanhe o status na aba "Meus Pedidos".</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cartItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-stone-400">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-3">
                    <circle cx="8" cy="21" r="1" />
                    <circle cx="19" cy="21" r="1" />
                    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                  </svg>
                  <p className="font-medium">Seu pedido está vazio</p>
                  <p className="text-sm mt-1">Adicione pratos do cardápio</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cartItems.map(({ item, qty }) => (
                    <div key={item.id} className="flex items-center gap-3 bg-stone-50 rounded-xl p-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-stone-900 text-sm truncate">{item.name}</h4>
                        <p className="text-sm text-stone-500">{formatCurrency(item.price)}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onRemove(item.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-stone-200 hover:bg-stone-100 transition-colors text-stone-600"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M5 12h14" />
                          </svg>
                        </button>
                        <span className="w-8 text-center font-bold text-stone-900">{qty}</span>
                        <button
                          onClick={() => onAdd(item.id)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-stone-200 hover:bg-stone-100 transition-colors text-stone-600"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M12 5v14M5 12h14" />
                          </svg>
                        </button>
                      </div>
                      <span className="font-bold text-stone-900 text-sm w-20 text-right">
                        {formatCurrency(item.price * qty)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="border-t border-stone-100 px-5 py-4 space-y-3 bg-white">
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Mesa / Complemento (opcional)</label>
                  <input
                    type="text"
                    value={tableNumber}
                    onChange={(e) => setTableNumber(e.target.value)}
                    placeholder="Ex: Mesa 5"
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-500 mb-1">Observações (opcional)</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ex: sem cebola, ponto da carne..."
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-stone-200 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-sm text-stone-900 resize-none"
                  />
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-2.5">
                    {error}
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-stone-500 text-sm">Total</span>
                  <span className="text-2xl font-bold text-stone-900">{formatCurrency(total)}</span>
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-xl transition-all shadow-lg shadow-amber-500/30 disabled:opacity-50 active:scale-[0.98]"
                >
                  {submitting ? 'Enviando...' : 'Enviar Pedido'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
