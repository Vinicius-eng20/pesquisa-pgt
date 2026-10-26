import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, Calendar, ArrowLeft, ArrowRight, Receipt, Search } from 'lucide-react';
import { fetchExpenses, createExpense, updateExpense, deleteExpense, fetchActiveCategories } from '@/lib/api';
import { formatCurrency, formatDate, monthName, toDateString } from '@/lib/format';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { LoadingSpinner } from '@/components/ui/Loading';
import { useToast } from '@/components/ui/Toast';
import { CategoryIcon } from '@/components/CategoryIcon';
import type { Expense, Category } from '@/types/database';

export function ExpensesPage() {
  const [monthDate, setMonthDate] = useState(new Date());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [form, setForm] = useState({
    description: '',
    amount: '',
    category_id: '',
    expense_date: toDateString(new Date()),
  });

  async function loadData() {
    setLoading(true);
    try {
      const [exps, cats] = await Promise.all([
        fetchExpenses(monthDate),
        fetchActiveCategories(),
      ]);
      setExpenses(exps);
      setCategories(cats);
    } catch (err) {
      console.error(err);
      toast('Erro ao carregar gastos', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [monthDate]);

  function changeMonth(delta: number) {
    setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + delta, 1));
  }

  function openAdd() {
    setEditingExpense(null);
    setForm({
      description: '',
      amount: '',
      category_id: categories[0]?.id || '',
      expense_date: toDateString(new Date()),
    });
    setModalOpen(true);
  }

  function openEdit(exp: Expense) {
    setEditingExpense(exp);
    setForm({
      description: exp.description,
      amount: String(exp.amount),
      category_id: exp.category_id,
      expense_date: exp.expense_date,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.category_id || !form.amount || Number(form.amount) <= 0) {
      toast('Preencha todos os campos obrigatórios', 'warning');
      return;
    }

    setSaving(true);
    try {
      const input = {
        category_id: form.category_id,
        description: form.description,
        amount: Number(form.amount),
        expense_date: form.expense_date,
      };

      if (editingExpense) {
        await updateExpense(editingExpense.id, input);
        toast('Gasto atualizado com sucesso', 'success');
      } else {
        await createExpense(input);
        toast('Gasto registrado com sucesso', 'success');
      }

      setModalOpen(false);
      loadData();
    } catch (err: any) {
      toast(err.message || 'Erro ao salvar gasto', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteExpense(deleteTarget.id);
      toast('Gasto excluído', 'success');
      setDeleteTarget(null);
      loadData();
    } catch (err: any) {
      toast(err.message || 'Erro ao excluir', 'error');
    }
  }

  const filtered = expenses.filter((exp) => {
    const matchesSearch = !search ||
      exp.description.toLowerCase().includes(search.toLowerCase()) ||
      exp.category?.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !filterCategory || exp.category_id === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const monthTotal = filtered.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Meus gastos</h1>
          <p className="text-sm text-slate-500 mt-1">Registre e organize suas despesas</p>
        </div>
        <Button onClick={openAdd} size="md">
          <Plus className="w-4 h-4" />
          Novo gasto
        </Button>
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => changeMonth(-1)}
          className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-900 min-w-[140px] text-center">
            {monthName(monthDate)}
          </span>
        </div>
        <button
          onClick={() => changeMonth(1)}
          className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            placeholder="Buscar por descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={<Search className="w-4 h-4" />}
          />
        </div>
        <div className="sm:w-52">
          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Total bar */}
      <div className="flex items-center justify-between px-5 py-4 rounded-xl bg-slate-800 text-white">
        <span className="text-sm text-slate-300">
          {filtered.length} {filtered.length === 1 ? 'registro' : 'registros'} no mês
        </span>
        <span className="text-lg font-bold">{formatCurrency(monthTotal)}</span>
      </div>

      {/* List */}
      {loading ? (
        <LoadingSpinner size={32} className="py-20" />
      ) : filtered.length ? (
        <div className="space-y-2">
          {filtered.map((exp) => (
            <Card key={exp.id} className="p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div
                    className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0"
                    style={{ backgroundColor: `${exp.category?.color}15` }}
                  >
                    <CategoryIcon name={exp.category?.icon || 'Tag'} size={18} color={exp.category?.color} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {exp.description || exp.category?.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {exp.category?.name} · {formatDate(exp.expense_date)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    {formatCurrency(Number(exp.amount))}
                  </span>
                  <button
                    onClick={() => openEdit(exp)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(exp)}
                    className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-12">
          <div className="flex flex-col items-center text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 text-slate-400 mb-4">
              <Receipt className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-slate-700 mb-1">
              {expenses.length ? 'Nenhum resultado' : 'Nenhum gasto neste mês'}
            </h3>
            <p className="text-sm text-slate-400 mb-4">
              {expenses.length ? 'Tente ajustar a busca ou o filtro.' : 'Comece registrando seu primeiro gasto.'}
            </p>
            <Button onClick={openAdd}>
              <Plus className="w-4 h-4" />
              Registrar gasto
            </Button>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingExpense ? 'Editar gasto' : 'Novo gasto'}
      >
        <div className="space-y-4">
          <Select
            label="Categoria"
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          >
            <option value="">Selecione uma categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </Select>
          <Input
            label="Descrição"
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Ex: Almoço no restaurante"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Valor (R$)"
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0,00"
              required
            />
            <Input
              label="Data"
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm({ ...form, expense_date: e.target.value })}
              required
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">
              {editingExpense ? 'Salvar' : 'Registrar'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir gasto"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Tem certeza que deseja excluir este gasto? Esta ação não pode ser desfeita.
          </p>
          {deleteTarget && (
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="text-sm font-medium text-slate-900">{deleteTarget.description || deleteTarget.category?.name}</p>
              <p className="text-sm text-slate-500">{formatCurrency(Number(deleteTarget.amount))} · {formatDate(deleteTarget.expense_date)}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} className="flex-1">
              Cancelar
            </Button>
            <Button variant="danger" onClick={handleDelete} className="flex-1">
              Excluir
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
