import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, ShoppingCart, Minus, Plus, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';
import { formatPrice } from '@/lib/types';
import { useCart } from '@/lib/cart';

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, setOpen } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('*, category:categories(*)')
        .eq('id', id)
        .maybeSingle();
      setProduct(data as Product | null);
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return <div className="flex h-96 items-center justify-center">
      <div className="h-12 w-12 animate-pulse rounded-full bg-slate-200" />
    </div>;
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg text-slate-500">Produto não encontrado.</p>
        <Link to="/" className="mt-4 text-slate-900 underline">Voltar para a loja</Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem(product, quantity);
  };

  const handleBuyNow = () => {
    addItem(product, quantity);
    navigate('/checkout');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
        >
          <ArrowLeft size={16} />
          Voltar
        </button>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Image */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="aspect-square">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-slate-300">
                  <ShoppingCart size={64} />
                </div>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="flex flex-col">
            {product.category && (
              <span className="mb-2 text-sm font-medium text-slate-500">{product.category.name}</span>
            )}
            <h1 className="text-3xl font-bold text-slate-900">{product.name}</h1>
            <p className="mt-4 text-3xl font-bold text-slate-900">{formatPrice(product.price)}</p>

            {product.description && (
              <p className="mt-6 leading-relaxed text-slate-600">{product.description}</p>
            )}

            <div className="mt-4 flex items-center gap-2">
              {product.stock > 0 ? (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                  <Check size={14} />
                  Em estoque ({product.stock} unidades)
                </span>
              ) : (
                <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-medium text-rose-700">
                  Esgotado
                </span>
              )}
            </div>

            {/* Quantity */}
            <div className="mt-8 flex items-center gap-4">
              <span className="text-sm font-medium text-slate-700">Quantidade</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <Minus size={16} />
                </button>
                <span className="w-12 text-center text-lg font-medium">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(product.stock, q + 1))}
                  disabled={quantity >= product.stock}
                  className="rounded-lg border border-slate-200 p-2 text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                >
                  <Plus size={16} />
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleAddToCart}
                disabled={product.stock <= 0}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-900 py-3.5 text-sm font-semibold text-slate-900 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
              >
                <ShoppingCart size={18} />
                Adicionar ao Carrinho
              </button>
              <button
                onClick={handleBuyNow}
                disabled={product.stock <= 0}
                className="flex flex-1 items-center justify-center rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                Comprar Agora
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
