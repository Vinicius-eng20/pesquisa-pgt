import { ShoppingCart } from 'lucide-react';
import type { Product } from '@/lib/types';
import { formatPrice } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { Link } from 'react-router-dom';

export default function ProductCard({ product }: { product: Product }) {
  const { addItem } = useCart();

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-300 hover:border-slate-300 hover:shadow-lg">
      <Link to={`/produto/${product.id}`} className="block">
        <div className="aspect-square overflow-hidden bg-slate-100">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <ShoppingCart size={48} />
            </div>
          )}
        </div>
      </Link>
      <div className="flex flex-1 flex-col p-4">
        <Link to={`/produto/${product.id}`}>
          <h3 className="mb-1 line-clamp-2 text-sm font-medium text-slate-900 hover:text-slate-700">
            {product.name}
          </h3>
        </Link>
        {product.category && (
          <span className="mb-2 text-xs text-slate-400">{product.category.name}</span>
        )}
        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-lg font-bold text-slate-900">{formatPrice(product.price)}</span>
          <button
            onClick={() => addItem(product)}
            disabled={product.stock <= 0}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <ShoppingCart size={14} />
            Adicionar
          </button>
        </div>
        {product.stock <= 0 && (
          <span className="mt-2 text-xs font-medium text-rose-500">Esgotado</span>
        )}
      </div>
    </div>
  );
}
