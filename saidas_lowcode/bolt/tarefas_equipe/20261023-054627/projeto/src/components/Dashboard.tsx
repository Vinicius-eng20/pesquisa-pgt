import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase, type TaskWithRelations, type Profile, type TaskStatus, type TaskPriority } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { STATUS_LABELS, STATUS_DOT, PRIORITY_COLORS, PRIORITY_LABELS } from '@/lib/taskConstants';
import TaskCard from './TaskCard';
import TaskModal from './TaskModal';
import { CheckSquare, Plus, LogOut, Search, LayoutGrid, List, Users, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

type FilterStatus = 'all' | TaskStatus;
type ViewMode = 'kanban' | 'list';

export default function Dashboard() {
  const { profile, signOut } = useAuth();
  const isManager = profile?.role === 'manager';

  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterMember, setFilterMember] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithRelations | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        assigned_profile:profiles!tasks_assigned_to_fkey(id, name, role),
        created_profile:profiles!tasks_created_by_fkey(id, name, role)
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching tasks:', error.message);
      return;
    }
    setTasks((data ?? []) as TaskWithRelations[]);
  }, []);

  const fetchMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching members:', error.message);
      return;
    }
    setMembers((data ?? []) as Profile[]);
  }, []);

  useEffect(() => {
    Promise.all([fetchTasks(), fetchMembers()]).finally(() => setLoading(false));
  }, [fetchTasks, fetchMembers]);

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filterStatus !== 'all' && task.status !== filterStatus) return false;
      if (filterMember !== 'all' && task.assigned_to !== filterMember) return false;
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !task.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filterStatus, filterMember, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
  }), [tasks]);

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    const original = tasks.find(t => t.id === taskId);
    if (!original) return;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus as TaskStatus } : t));

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (error) {
      console.error('Error updating status:', error.message);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: original.status } : t));
    }
  };

  const handleSaveTask = async (data: {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    assigned_to: string | null;
    due_date: string | null;
  }) => {
    if (editingTask) {
      const { error } = await supabase
        .from('tasks')
        .update({
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          assigned_to: data.assigned_to,
          due_date: data.due_date,
        })
        .eq('id', editingTask.id);

      if (error) {
        console.error('Error updating task:', error.message);
        alert('Erro ao atualizar tarefa: ' + error.message);
        return;
      }
    } else {
      const { error } = await supabase
        .from('tasks')
        .insert({
          title: data.title,
          description: data.description,
          status: data.status,
          priority: data.priority,
          assigned_to: data.assigned_to,
          due_date: data.due_date,
        });

      if (error) {
        console.error('Error creating task:', error.message);
        alert('Erro ao criar tarefa: ' + error.message);
        return;
      }
    }

    setModalOpen(false);
    setEditingTask(null);
    await fetchTasks();
  };

  const handleDeleteTask = async (taskId: string) => {
    setDeleteConfirm(null);
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', taskId);

    if (error) {
      console.error('Error deleting task:', error.message);
      alert('Erro ao remover tarefa: ' + error.message);
      return;
    }
    await fetchTasks();
  };

  const openNewTask = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  const openEditTask = (task: TaskWithRelations) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-slate-500 text-sm">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-sm">
                <CheckSquare className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-lg leading-none">TaskFlow</h1>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isManager ? 'Painel do Gerente' : 'Minhas Tarefas'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xs">
                  {profile?.name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-700 leading-none">{profile?.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {isManager ? 'Gerente' : 'Membro'}
                  </p>
                </div>
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={<AlertCircle className="w-5 h-5" />} label="A fazer" value={stats.pending} color="slate" />
          <StatCard icon={<Clock className="w-5 h-5" />} label="Em andamento" value={stats.inProgress} color="amber" />
          <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Concluídas" value={stats.completed} color="emerald" />
          <StatCard icon={<LayoutGrid className="w-5 h-5" />} label="Total" value={stats.total} color="blue" />
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar tarefas..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {isManager && (
            <select
              value={filterMember}
              onChange={(e) => setFilterMember(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Todos os membros</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}

          <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
              title="Quadro"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-600'}`}
              title="Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={openNewTask}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl transition-all shadow-lg shadow-blue-600/20 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Nova tarefa
          </button>
        </div>

        {/* Content */}
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <CheckSquare className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="font-semibold text-slate-700 mb-1">Nenhuma tarefa encontrada</h3>
            <p className="text-sm text-slate-400 max-w-sm">
              {searchQuery || filterStatus !== 'all' || filterMember !== 'all'
                ? 'Tente ajustar os filtros para ver mais tarefas.'
                : 'Clique em "Nova tarefa" para criar a primeira tarefa.'}
            </p>
          </div>
        ) : viewMode === 'kanban' ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['pending', 'in_progress', 'completed'] as TaskStatus[]).map((status) => {
              const columnTasks = filteredTasks.filter(t => t.status === status);
              return (
                <div key={status} className="flex flex-col">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${STATUS_DOT[status]}`} />
                      <h2 className="font-semibold text-slate-700 text-sm">{STATUS_LABELS[status]}</h2>
                    </div>
                    <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {columnTasks.length}
                    </span>
                  </div>
                  <div className="flex flex-col gap-3 min-h-[100px]">
                    {columnTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        canEdit={isManager || task.assigned_to === profile?.id}
                        canDelete={isManager}
                        onStatusChange={handleStatusChange}
                        onEdit={isManager ? openEditTask : undefined}
                        onDelete={isManager ? (id) => setDeleteConfirm(id) : undefined}
                        showAssignee={isManager}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                canEdit={isManager || task.assigned_to === profile?.id}
                canDelete={isManager}
                onStatusChange={handleStatusChange}
                onEdit={isManager ? openEditTask : undefined}
                onDelete={isManager ? (id) => setDeleteConfirm(id) : undefined}
                showAssignee={isManager}
              />
            ))}
          </div>
        )}
      </main>

      {/* Task Modal */}
      <TaskModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingTask(null); }}
        onSave={handleSaveTask}
        members={members}
        editingTask={editingTask}
        isManager={isManager}
        currentUserId={profile?.id ?? ''}
      />

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => setDeleteConfirm(null)}
        >
          <div
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">Remover tarefa?</h3>
            <p className="text-sm text-slate-500 mb-6">Esta ação não pode ser desfeita.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDeleteTask(deleteConfirm)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-all"
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: 'slate' | 'amber' | 'emerald' | 'blue';
}) {
  const colorMap = {
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-100 text-amber-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    blue: 'bg-blue-100 text-blue-600',
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-400 mt-1">{label}</p>
      </div>
    </div>
  );
}
