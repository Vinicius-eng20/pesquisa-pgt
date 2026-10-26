export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  is_active: boolean;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  is_active: boolean;
  created_at: string;
};

export type Expense = {
  id: string;
  user_id: string;
  category_id: string;
  description: string;
  amount: number;
  expense_date: string;
  created_at: string;
  category?: Category;
};

export type CategorySummary = {
  category_id: string;
  category_name: string;
  color: string;
  icon: string;
  total: number;
  count: number;
};

export type UserMonthlySummary = {
  total: number;
  count: number;
  by_category: CategorySummary[];
};

export type AdminCategorySummary = {
  category_id: string;
  category_name: string;
  color: string;
  total: number;
  count: number;
};

export type AdminExpensesSummary = {
  total_expenses: number;
  total_users: number;
  active_users: number;
  expenses_this_month: number;
  expenses_by_category: AdminCategorySummary[];
};

export type AdminAuditLog = {
  id: string;
  admin_id: string;
  action: string;
  target_user_id: string | null;
  created_at: string;
};
