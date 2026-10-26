import { Link } from 'react-router-dom';
import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '@/lib/cart';
import { formatPrice } from '@/lib/types';

export default function CartDrawer() {
  const { items, isOpen, setOpen, updateQuantity, removeItem, total, count } = useCart();

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm transition-opacity"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <ShoppingBag size={20} />
            Carrinho ({count})
          </h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <ShoppingBag size={48} className="text-slate-300" />
            <p className="text-slate-500">Seu carrinho está vazio</p>
            <Link
              to="/"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
            >
              Continuar comprando
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-6">
              {items.map((item) => (
                <div key={item.product.id} className="flex gap-4 border-b border-slate-100 pb-4">
                  <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                    {item.product.image_url && (
                      <img
                        src={item.product.image_url}
                        alt={item.product.name}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-slate-900">{item.product.name}</h3>
                      <p className="text-sm text-slate-500">{formatPrice(item.product.price)}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                          className="rounded-md border border-slate-200 p-1 text-slate-600 transition-colors hover:bg-slate-100"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                          className="rounded-md border border-slate-200 p-1 text-slate-600 transition-colors hover:bg-slate-100"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <button
                        onClick={() => removeItem(item.product.id)}
                        className="text-slate-400 transition-colors hover:text-rose-500"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-200 p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-base font-medium text-slate-700">Total</span>
                <span className="text-2xl font-bold text-slate-900">{formatPrice(total)}</span>
              </div>
              <Link
                to="/checkout"
                onClick={() => setOpen(false)}
                className="block w-full rounded-lg bg-slate-900 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                Finalizar Pedido
              </Link>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
