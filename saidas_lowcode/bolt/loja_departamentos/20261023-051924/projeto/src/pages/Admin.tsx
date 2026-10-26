import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Pencil, Trash2, X, Package, ShoppingBag, TrendingUp, LayoutGrid,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Product, Category, Order, OrderStatus } from '@/lib/types';
import {
  formatPrice, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
} from '@/lib/types';

type Tab = 'products' | 'orders';

export default function Admin() {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: '', description: '', price: '', stock: '', image_url: '', category_id: '', active: true,
  });

  const loadData = useCallback(async () => {
    const [{ data: cats }, { data: prods }, { data: ords }] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('products').select('*, category:categories(*)').order('created_at', { ascending: false }),
      supabase.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }),
    ]);
    setCategories(cats as Category[] ?? []);
    setProducts(prods as Product[] ?? []);
    setOrders(ords as Order[] ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login'); return; }
    if (profile && profile.role !== 'admin') { navigate('/'); return; }
    if (profile?.role === 'admin') loadData();
  }, [user, profile, authLoading, navigate, loadData]);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '', price: '', stock: '', image_url: '', category_id: '', active: true });
    setShowForm(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name, description: p.description ?? '', price: String(p.price),
      stock: String(p.stock), image_url: p.image_url ?? '', category_id: p.category_id ?? '', active: p.active,
    });
    setShowForm(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description || null,
      price: parseFloat(form.price) || 0,
      stock: parseInt(form.stock) || 0,
      image_url: form.image_url || null,
      category_id: form.category_id || null,
      active: form.active,
    };
    if (editing) {
      await supabase.from('products').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('products').insert(payload);
    }
    setShowForm(false);
    loadData();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este produto?')) return;
    await supabase.from('products').delete().eq('id', id);
    loadData();
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    await supabase.from('orders').update({ status }).eq('id', orderId);
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
  };

  if (authLoading || (profile?.role !== 'admin' && !loading)) {
    return <div className="flex h-96 items-center justify-center">
      <div className="h-12 w-12 animate-pulse rounded-full bg-slate-200" />
    </div>;
  }

  const totalRevenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + Number(o.total), 0);
  const pendingCount = orders.filter((o) => o.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Painel do Administrador</h1>
        <p className="mb-8 text-slate-500">Gerencie produtos e pedidos da loja.</p>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                <Package size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{products.length}</p>
                <p className="text-sm text-slate-500">Produtos</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-white">
                <ShoppingBag size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{pendingCount}</p>
                <p className="text-sm text-slate-500">Pedidos pendentes</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <TrendingUp size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{formatPrice(totalRevenue)}</p>
                <p className="text-sm text-slate-500">Receita total</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2 rounded-lg bg-slate-100 p-1">
          <button
            onClick={() => setTab('products')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-all ${
              tab === 'products' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            <LayoutGrid size={16} />
            Produtos
          </button>
          <button
            onClick={() => setTab('orders')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-sm font-medium transition-all ${
              tab === 'orders' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
            }`}
          >
            <ShoppingBag size={16} />
            Pedidos
          </button>
        </div>

        {loading ? (
          <div className="h-64 animate-pulse rounded-2xl bg-slate-200" />
        ) : tab === 'products' ? (
          <>
            <div className="mb-4 flex justify-end">
              <button
                onClick={openCreate}
                className="flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                <Plus size={16} />
                Novo Produto
              </button>
            </div>
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-6 py-3 font-medium">Produto</th>
                      <th className="px-6 py-3 font-medium">Categoria</th>
                      <th className="px-6 py-3 font-medium">Preço</th>
                      <th className="px-6 py-3 font-medium">Estoque</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((p) => (
                      <tr key={p.id} className="transition-colors hover:bg-slate-50">
                        <td className="px-6 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                              {p.image_url && <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />}
                            </div>
                            <span className="font-medium text-slate-900">{p.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 text-slate-600">{p.category?.name ?? '—'}</td>
                        <td className="px-6 py-3 font-medium text-slate-900">{formatPrice(p.price)}</td>
                        <td className="px-6 py-3 text-slate-600">{p.stock}</td>
                        <td className="px-6 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            p.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {p.active ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex justify-end gap-1">
                            <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900">
                              <Pencil size={16} />
                            </button>
                            <button onClick={() => deleteProduct(p.id)} className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-4">
            {orders.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-slate-500">
                Nenhum pedido ainda.
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Pedido #{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(order.created_at).toLocaleString('pt-BR')}
                        {order.customer_name && ` • ${order.customer_name}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                        className={`rounded-full border px-3 py-1 text-xs font-medium outline-none ${ORDER_STATUS_COLORS[order.status]}`}
                      >
                        {(Object.keys(ORDER_STATUS_LABELS) as OrderStatus[]).map((s) => (
                          <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                      <span className="text-lg font-bold text-slate-900">{formatPrice(Number(order.total))}</span>
                    </div>
                  </div>
                  <div className="px-6 py-4">
                    <div className="space-y-2">
                      {order.order_items?.map((item) => (
                        <div key={item.id} className="flex items-center gap-3">
                          <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                            {item.image_url && <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />}
                          </div>
                          <p className="flex-1 text-sm text-slate-700">{item.name}</p>
                          <p className="text-xs text-slate-500">{item.quantity}x</p>
                          <p className="text-sm font-medium text-slate-900">{formatPrice(Number(item.price) * item.quantity)}</p>
                        </div>
                      ))}
                    </div>
                    {order.shipping_address && (
                      <p className="mt-3 text-xs text-slate-500"><span className="font-medium">Entrega:</span> {order.shipping_address}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">{editing ? 'Editar Produto' : 'Novo Produto'}</h2>
              <button onClick={() => setShowForm(false)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={saveProduct} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Nome</label>
                <input
                  type="text" required value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2.5 px-4 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Descrição</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 py-2.5 px-4 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Preço (R$)</label>
                  <input
                    type="number" step="0.01" required value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2.5 px-4 text-sm outline-none focus:border-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Estoque</label>
                  <input
                    type="number" required value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 py-2.5 px-4 text-sm outline-none focus:border-slate-400"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Categoria</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm({ ...form, category_id: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 py-2.5 px-4 text-sm outline-none focus:border-slate-400"
                >
                  <option value="">Sem categoria</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">URL da imagem</label>
                <input
                  type="url" value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-slate-200 py-2.5 px-4 text-sm outline-none focus:border-slate-400"
                />
              </div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox" checked={form.active}
                  onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm text-slate-700">Produto ativo (visível na loja)</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button
                  type="button" onClick={() => setShowForm(false)}
                  className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  {editing ? 'Salvar' : 'Criar Produto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
