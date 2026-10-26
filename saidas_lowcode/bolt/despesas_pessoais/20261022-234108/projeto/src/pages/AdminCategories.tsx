import { useEffect, useState } from 'react';
import { Plus, Pencil, Tag, Eye, EyeOff } from 'lucide-react';
import { fetchCategories, createCategory, updateCategory } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/Loading';
import { useToast } from '@/components/ui/Toast';
import { CategoryIcon, availableIcons } from '@/components/CategoryIcon';
import type { Category } from '@/types/database';

const colorOptions = [
  { name: 'Âmbar', value: '#F59E0B' },
  { name: 'Azul', value: '#3B82F6' },
  { name: 'Verde', value: '#10B981' },
  { name: 'Vermelho', value: '#EF4444' },
  { name: 'Roxo', value: '#8B5CF6' },
  { name: 'Índigo', value: '#6366F1' },
  { name: 'Rosa', value: '#EC4899' },
  { name: 'Verde-musgo', value: '#22C55E' },
  { name: 'Cinza', value: '#6B7280' },
  { name: 'Ciano', value: '#06B6D4' },
  { name: 'Laranja', value: '#F97316' },
  { name: 'Teal', value: '#14B8A6' },
];

export function AdminCategories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    name: '',
    description: '',
    icon: 'Tag',
    color: '#3B82F6',
    is_active: true,
  });

  async function load() {
    setLoading(true);
    try {
      const cats = await fetchCategories();
      setCategories(cats);
    } catch (err) {
      console.error(err);
      toast('Erro ao carregar categorias', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', description: '', icon: 'Tag', color: '#3B82F6', is_active: true });
    setModalOpen(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({
      name: cat.name,
      description: cat.description,
      icon: cat.icon,
      color: cat.color,
      is_active: cat.is_active,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast('O nome da categoria é obrigatório', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateCategory(editing.id, form);
        toast('Categoria atualizada', 'success');
      } else {
        await createCategory(form);
        toast('Categoria criada', 'success');
      }
      setModalOpen(false);
      load();
    } catch (err: any) {
      toast(err.message || 'Erro ao salvar categoria', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Categorias</h1>
          <p className="text-sm text-slate-500 mt-1">Gerencie as categorias de gasto disponíveis</p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4" />
          Nova categoria
        </Button>
      </div>

      {loading ? (
        <LoadingSpinner size={32} className="py-20" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <Card key={cat.id} className={`p-4 ${!cat.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div
                  className="flex items-center justify-center w-12 h-12 rounded-xl"
                  style={{ backgroundColor: `${cat.color}15` }}
                >
                  <CategoryIcon name={cat.icon} size={22} color={cat.color} />
                </div>
                <button
                  onClick={() => openEdit(cat)}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-slate-900">{cat.name}</h3>
                {!cat.is_active && (
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                    Inativa
                  </span>
                )}
              </div>
              {cat.description && (
                <p className="text-sm text-slate-500">{cat.description}</p>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar categoria' : 'Nova categoria'}
      >
        <div className="space-y-4">
          <Input
            label="Nome"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Ex: Alimentação"
            required
          />
          <Input
            label="Descrição"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ex: Gastos com comida e restaurante"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Ícone</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-slate-200 rounded-lg">
              {availableIcons.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setForm({ ...form, icon })}
                  className={`flex items-center justify-center w-10 h-10 rounded-lg transition-all ${
                    form.icon === icon
                      ? 'ring-2 ring-emerald-500'
                      : 'hover:bg-slate-100'
                  }`}
                  style={form.icon === icon ? { backgroundColor: `${form.color}15` } : {}}
                >
                  <CategoryIcon name={icon} size={18} color={form.icon === icon ? form.color : undefined} />
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Cor</label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setForm({ ...form, color: c.value })}
                  className={`w-9 h-9 rounded-lg transition-all ${
                    form.color === c.value ? 'ring-2 ring-offset-2 ring-slate-400' : ''
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {editing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                {form.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                {form.is_active ? 'Categoria ativa' : 'Categoria inativa'}
              </button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
