import type { TaskStatus, TaskPriority } from '@/lib/supabase';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'A fazer',
  in_progress: 'Em andamento',
  completed: 'Concluída',
};

export const STATUS_COLORS: Record<TaskStatus, string> = {
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  completed: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

export const STATUS_DOT: Record<TaskStatus, string> = {
  pending: 'bg-slate-400',
  in_progress: 'bg-amber-500',
  completed: 'bg-emerald-500',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

export const PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: 'bg-blue-50 text-blue-700 border-blue-200',
  medium: 'bg-slate-50 text-slate-700 border-slate-200',
  high: 'bg-red-50 text-red-700 border-red-200',
};

export const STATUS_ORDER: TaskStatus[] = ['pending', 'in_progress', 'completed'];
