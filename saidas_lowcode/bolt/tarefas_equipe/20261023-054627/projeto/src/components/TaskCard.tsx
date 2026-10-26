import type { TaskWithRelations } from '@/lib/supabase';
import { STATUS_LABELS, STATUS_COLORS, STATUS_DOT, PRIORITY_LABELS, PRIORITY_COLORS } from '@/lib/taskConstants';
import { Calendar, User, Trash2, Pencil, Flag } from 'lucide-react';

interface TaskCardProps {
  task: TaskWithRelations;
  canEdit: boolean;
  canDelete: boolean;
  onStatusChange: (taskId: string, status: string) => void;
  onEdit?: (task: TaskWithRelations) => void;
  onDelete?: (taskId: string) => void;
  showAssignee?: boolean;
}

export default function TaskCard({
  task,
  canEdit,
  canDelete,
  onStatusChange,
  onEdit,
  onDelete,
  showAssignee = true,
}: TaskCardProps) {
  const dueDate = task.due_date ? new Date(task.due_date + 'T00:00:00') : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'completed';

  return (
    <div className="group bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all overflow-hidden">
      <div className="p-4">
        {/* Header row: title + actions */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_DOT[task.status]}`} />
            <h3 className="font-semibold text-slate-900 text-sm leading-snug truncate">
              {task.title}
            </h3>
          </div>
          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            {canEdit && onEdit && (
              <button
                onClick={() => onEdit(task)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Editar tarefa"
              >
                <Pencil className="w-4 h-4" />
              </button>
            )}
            {canDelete && onDelete && (
              <button
                onClick={() => onDelete(task.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Remover tarefa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <p className="text-sm text-slate-500 mb-3 line-clamp-2 leading-relaxed">{task.description}</p>
        )}

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PRIORITY_COLORS[task.priority]} flex items-center gap-1`}>
            <Flag className="w-3 h-3" />
            {PRIORITY_LABELS[task.priority]}
          </span>
          {dueDate && (
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border flex items-center gap-1 ${
              isOverdue
                ? 'bg-red-50 text-red-700 border-red-200'
                : 'bg-slate-50 text-slate-600 border-slate-200'
            }`}>
              <Calendar className="w-3 h-3" />
              {dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
          )}
          {showAssignee && task.assigned_profile && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-slate-50 text-slate-600 border-slate-200 flex items-center gap-1">
              <User className="w-3 h-3" />
              {task.assigned_profile.name}
            </span>
          )}
        </div>

        {/* Status selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Status:</span>
          <select
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value)}
            disabled={!canEdit}
            className={`text-xs font-medium px-2.5 py-1 rounded-full border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:cursor-not-allowed disabled:opacity-60 ${STATUS_COLORS[task.status]}`}
          >
            {(Object.keys(STATUS_LABELS) as string[]).map((s) => (
              <option key={s} value={s} className="bg-white text-slate-900">
                {STATUS_LABELS[s as keyof typeof STATUS_LABELS]}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
