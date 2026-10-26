import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, X, Loader2, BookOpen, Eye, EyeOff } from 'lucide-react';
import { supabase, type Course } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { PageLoader, EmptyState, ErrorState } from '@/components/ui';

type EditingCourse = Partial<Course> & { id?: string };

const empty: EditingCourse = {
  title: '',
  description: '',
  instructor: '',
  category: '',
  level: 'Iniciante',
  duration_hours: 0,
  image_url: '',
  is_published: true,
};

export default function AdminCoursesPage() {
  const { profile } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EditingCourse>(empty);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      setError('Não foi possível carregar os cursos.');
    } else {
      setCourses(data as Course[]);
    }
    setLoading(false);
  };

  const openCreate = () => {
    setEditing(empty);
    setFormError(null);
    setModalOpen(true);
  };

  const openEdit = (course: Course) => {
    setEditing({ ...course });
    setFormError(null);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!editing.title?.trim() || !editing.description?.trim() || !editing.instructor?.trim() || !editing.category?.trim()) {
      setFormError('Preencha todos os campos obrigatórios.');
      return;
    }
    setSaving(true);

    const payload = {
      title: editing.title!.trim(),
      description: editing.description!.trim(),
      instructor: editing.instructor!.trim(),
      category: editing.category!.trim(),
      level: editing.level || 'Iniciante',
      duration_hours: Number(editing.duration_hours) || 0,
      image_url: editing.image_url?.trim() || null,
      is_published: editing.is_published !== false,
    };

    if (editing.id) {
      const { error } = await supabase.from('courses').update(payload).eq('id', editing.id);
      if (error) {
        setFormError('Não foi possível salvar as alterações.');
        setSaving(false);
        return;
      }
    } else {
      const { error } = await supabase.from('courses').insert({ ...payload, created_by: profile?.id });
      if (error) {
        setFormError('Não foi possível criar o curso.');
        setSaving(false);
        return;
      }
    }

    setSaving(false);
    setModalOpen(false);
    await load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este curso? Todas as matrículas vinculadas também serão removidas.')) return;
    setDeleting(id);
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) {
      setError('Não foi possível remover o curso.');
    } else {
      setCourses((prev) => prev.filter((c) => c.id !== id));
    }
    setDeleting(null);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-1">Gerenciar cursos</h1>
          <p className="text-slate-500 text-sm">Crie, edite e remova cursos da plataforma.</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm px-4 py-2.5 rounded-xl transition-colors shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-4 h-4" />
          Novo curso
        </button>
      </div>

      {error && <div className="mb-6"><ErrorState message={error} /></div>}

      {courses.length === 0 && !error ? (
        <EmptyState
          icon={BookOpen}
          title="Nenhum curso cadastrado"
          description="Clique em 'Novo curso' para adicionar o primeiro curso da plataforma."
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-left">
                  <th className="px-5 py-3 font-medium">Curso</th>
                  <th className="px-5 py-3 font-medium hidden sm:table-cell">Categoria</th>
                  <th className="px-5 py-3 font-medium hidden md:table-cell">Nível</th>
                  <th className="px-5 py-3 font-medium hidden lg:table-cell">Status</th>
                  <th className="px-5 py-3 font-medium text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {courses.map((course) => (
                  <tr key={course.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-900">{course.title}</div>
                      <div className="text-xs text-slate-400">{course.instructor}</div>
                    </td>
                    <td className="px-5 py-4 hidden sm:table-cell text-slate-600">{course.category}</td>
                    <td className="px-5 py-4 hidden md:table-cell text-slate-600">{course.level}</td>
                    <td className="px-5 py-4 hidden lg:table-cell">
                      {course.is_published ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-md">
                          <Eye className="w-3 h-3" /> Publicado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                          <EyeOff className="w-3 h-3" /> Oculto
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(course)}
                          className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(course.id)}
                          disabled={deleting === course.id}
                          className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                          title="Remover"
                        >
                          {deleting === course.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setModalOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-900">
                {editing.id ? 'Editar curso' : 'Novo curso'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Título *</label>
                <input
                  type="text"
                  value={editing.title || ''}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Descrição *</label>
                <textarea
                  value={editing.description || ''}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  required
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Instrutor *</label>
                  <input
                    type="text"
                    value={editing.instructor || ''}
                    onChange={(e) => setEditing({ ...editing, instructor: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Categoria *</label>
                  <input
                    type="text"
                    value={editing.category || ''}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Nível</label>
                  <select
                    value={editing.level || 'Iniciante'}
                    onChange={(e) => setEditing({ ...editing, level: e.target.value as Course['level'] })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all bg-white"
                  >
                    <option value="Iniciante">Iniciante</option>
                    <option value="Intermediario">Intermediário</option>
                    <option value="Avancado">Avançado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Duração (horas)</label>
                  <input
                    type="number"
                    min={0}
                    value={editing.duration_hours ?? 0}
                    onChange={(e) => setEditing({ ...editing, duration_hours: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">URL da imagem (opcional)</label>
                <input
                  type="url"
                  value={editing.image_url || ''}
                  onChange={(e) => setEditing({ ...editing, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editing.is_published !== false}
                  onChange={(e) => setEditing({ ...editing, is_published: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700">Curso publicado (visível para alunos)</span>
              </label>

              {formError && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
                  {formError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm py-2.5 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editing.id ? 'Salvar alterações' : 'Criar curso'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
