import { useEffect, useState, useCallback } from 'react';
import { Plus, Loader2, BookOpen, Pencil, Trash2, Save, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Item, ItemType } from '@/lib/types';
import { ITEM_TYPES, ITEM_TYPE_LABELS } from '@/lib/types';
import { ItemCard } from '@/components/ItemCard';
import { Modal } from '@/components/Modal';

interface FormData {
  title: string;
  author: string;
  type: ItemType;
  description: string;
  cover_url: string;
  total_copies: number;
}

const EMPTY_FORM: FormData = {
  title: '',
  author: '',
  type: 'livro',
  description: '',
  cover_url: '',
  total_copies: 1,
};

export function ManageItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Item | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('items').select('*').order('created_at', { ascending: false });
    setItems(data as Item[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const filtered = items.filter((item) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.author.toLowerCase().includes(q);
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setForm({
      title: item.title,
      author: item.author,
      type: item.type,
      description: item.description,
      cover_url: item.cover_url ?? '',
      total_copies: item.total_copies,
    });
    setFormError(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim()) {
      setFormError('O título é obrigatório.');
      return;
    }
    if (form.total_copies < 1) {
      setFormError('O número de cópias deve ser no mínimo 1.');
      return;
    }
    setSaving(true);
    setFormError(null);

    const payload = {
      title: form.title.trim(),
      author: form.author.trim(),
      type: form.type,
      description: form.description.trim(),
      cover_url: form.cover_url.trim() || null,
      total_copies: form.total_copies,
    };

    if (editing) {
      const diff = form.total_copies - editing.total_copies;
      const newAvailable = Math.max(0, editing.available_copies + diff);
      const { error } = await supabase
        .from('items')
        .update({ ...payload, available_copies: newAvailable })
        .eq('id', editing.id);
      if (error) setFormError(error.message);
      else {
        setToast({ type: 'success', msg: 'Item atualizado com sucesso!' });
        setShowForm(false);
        await loadItems();
      }
    } else {
      const { error } = await supabase
        .from('items')
        .insert({ ...payload, available_copies: form.total_copies });
      if (error) setFormError(error.message);
      else {
        setToast({ type: 'success', msg: 'Item cadastrado com sucesso!' });
        setShowForm(false);
        await loadItems();
      }
    }
    setSaving(false);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('items').delete().eq('id', deleteTarget.id);
    if (error) setToast({ type: 'error', msg: error.message });
    else {
      setToast({ type: 'success', msg: `"${deleteTarget.title}" removido do acervo.` });
      await loadItems();
    }
    setDeleting(false);
    setDeleteTarget(null);
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl font-semibold text-gray-900">Gerenciar acervo</h1>
          <p className="text-sm text-gray-500 mt-1">Cadastre, edite e remova itens da biblioteca.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-xl hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo item
        </button>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar item..."
        className="w-full max-w-md px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition mb-6"
      />

      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-gray-400">Nenhum item cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              showLibrarianActions
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editing ? 'Editar item' : 'Cadastrar novo item'}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Título *</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Autor / Criador</label>
            <input
              type="text"
              value={form.author}
              onChange={(e) => setForm({ ...form, author: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as ItemType })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition cursor-pointer"
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nº de cópias</label>
              <input
                type="number"
                min={1}
                value={form.total_copies}
                onChange={(e) => setForm({ ...form, total_copies: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Descrição / Sinopse</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">URL da capa (opcional)</label>
            <input
              type="url"
              value={form.cover_url}
              onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
              placeholder="https://..."
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition"
            />
          </div>

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
              {formError}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowForm(false)}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {editing ? 'Salvar alterações' : 'Cadastrar item'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Remover item">
        {deleteTarget && (
          <div>
            <p className="text-gray-600 text-sm mb-1">Tem certeza que deseja remover:</p>
            <p className="font-medium text-gray-900 mb-6">{deleteTarget.title}?</p>
            <p className="text-sm text-gray-500 mb-6">
              Esta ação não pode ser desfeita. O item será removido permanentemente do acervo.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remover
              </button>
            </div>
          </div>
        )}
      </Modal>

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
