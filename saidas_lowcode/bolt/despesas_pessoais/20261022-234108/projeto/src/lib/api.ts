import { supabase } from '@/lib/supabase';
import type { Category, Expense, UserMonthlySummary, AdminExpensesSummary, Profile } from '@/types/database';
import { toDateString } from './format';

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('name');
  if (error) throw error;
  return data as Category[];
}

export async function fetchActiveCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data as Category[];
}

export async function fetchExpenses(monthDate: Date): Promise<Expense[]> {
  const start = toDateString(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
  const end = toDateString(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));

  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      category:categories(*)
    `)
    .gte('expense_date', start)
    .lte('expense_date', end)
    .order('expense_date', { ascending: false });

  if (error) throw error;
  return data as Expense[];
}

export async function createExpense(input: {
  category_id: string;
  description: string;
  amount: number;
  expense_date: string;
}): Promise<void> {
  const { error } = await supabase.from('expenses').insert(input);
  if (error) throw error;
}

export async function updateExpense(
  id: string,
  input: { category_id: string; description: string; amount: number; expense_date: string }
): Promise<void> {
  const { error } = await supabase.from('expenses').update(input).eq('id', id);
  if (error) throw error;
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchUserMonthlySummary(monthDate: Date): Promise<UserMonthlySummary> {
  const dateStr = toDateString(monthDate);
  const { data, error } = await supabase.rpc('get_user_monthly_summary', { month_date: dateStr });
  if (error) throw error;
  return data as UserMonthlySummary;
}

export async function fetchAdminSummary(): Promise<AdminExpensesSummary> {
  const { data, error } = await supabase.rpc('get_admin_expenses_summary');
  if (error) throw error;
  return data as AdminExpensesSummary;
}

export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data as Profile[];
}

export async function updateProfileStatus(
  userId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId);
  if (error) throw error;

  await supabase.from('admin_audit_log').insert({
    action: isActive ? 'Ativou conta de usuário' : 'Desativou conta de usuário',
    target_user_id: userId,
  });
}

export async function createCategory(input: {
  name: string;
  description: string;
  icon: string;
  color: string;
}): Promise<void> {
  const { error } = await supabase.from('categories').insert(input);
  if (error) throw error;
}

export async function updateCategory(
  id: string,
  input: { name: string; description: string; icon: string; color: string; is_active: boolean }
): Promise<void> {
  const { error } = await supabase.from('categories').update(input).eq('id', id);
  if (error) throw error;
}

export async function fetchAdminExpensesAll(): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      category:categories(*)
    `)
    .order('expense_date', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data as Expense[];
}

export async function fetchAdminUserExpenses(userId: string): Promise<Expense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select(`
      *,
      category:categories(*)
    `)
    .eq('user_id', userId)
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return data as Expense[];
}
