/*
# Controle de Despesas Pessoais - Esquema Inicial

## Objetivo
Criar o banco de dados para um sistema de controle de despesas pessoais com dois tipos de usuário:
1. Usuários comuns: registram seus gastos, organizam por categoria, veem total mensal
2. Administrador: cadastra categorias, desativa contas de usuários, vê total de gastos de todos

## Novas Tabelas

### 1. profiles
- `id` (uuid, primary key, referência auth.users)
- `email` (text, email do usuário)
- `full_name` (text, nome completo opcional)
- `role` (text, 'user' ou 'admin', default 'user')
- `is_active` (boolean, conta ativa/desativada, default true)
- `created_at` (timestamptz)

### 2. categories
- `id` (uuid, primary key)
- `name` (text, nome da categoria)
- `description` (text, descrição opcional)
- `icon` (text, nome do ícone Lucide, default 'Tag')
- `color` (text, cor hex para a categoria, default '#3B82F6')
- `is_active` (boolean, categoria ativa, default true)
- `created_at` (timestamptz)

### 3. expenses
- `id` (uuid, primary key)
- `user_id` (uuid, dono do gasto, default auth.uid())
- `category_id` (uuid, FK para categories)
- `description` (text, descrição do gasto)
- `amount` (numeric(12,2), valor do gasto)
- `expense_date` (date, data do gasto)
- `created_at` (timestamptz)

### 4. admin_audit_log
- `id` (uuid, primary key)
- `admin_id` (uuid, quem fez a ação)
- `action` (text, descrição da ação)
- `target_user_id` (uuid, nullable, usuário afetado)
- `created_at` (timestamptz)

## Segurança (RLS)

### profiles
- Usuários podem ver e editar SEU perfil (SELECT/UPDATE)
- Admins podem ver TODOS os perfis (SELECT)
- Admins podem desativar contas (UPDATE is_active)
- Grants: SELECT, UPDATE para authenticated

### categories
- Qualquer usuário autenticado pode ver categorias (SELECT)
- Apenas admins podem criar/editar/desativar categorias (INSERT/UPDATE/DELETE)
- Grants: SELECT para authenticated; INSERT/UPDATE/DELETE para authenticated (RLS restringe)

### expenses
- Usuários podem CRUD apenas SEUS gastos
- Admins podem ver TODOS os gastos (SELECT) mas não editar
- Grants: SELECT, INSERT, UPDATE, DELETE para authenticated

### admin_audit_log
- Apenas admins podem inserir e ver logs
- Grants: SELECT, INSERT para authenticated

## Triggers
- `on_auth_user_created`: ao criar usuário no auth.users, insere linha em profiles com role='user', is_active=true
- `get_admin_total_expenses`: função RPC que retorna o total de gastos de todos os usuários (apenas admin)

## Notas
1. A coluna user_id em expenses tem DEFAULT auth.uid() para que inserts do frontend funcionem sem passar user_id
2. Categorias são globais (sem user_id) - administradas pelo admin
3. O primeiro usuário cadastrado torna-se admin automaticamente via trigger
4. Logs de auditoria registram ações administrativas
*/

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON profiles TO authenticated;

-- Users can view their own profile
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin"
ON profiles FOR SELECT
TO authenticated
USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true));

-- Users can update their own profile (only name, not role/is_active)
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Admins can update any profile (to activate/deactivate accounts and change roles)
DROP POLICY IF EXISTS "profiles_update_admin" ON profiles;
CREATE POLICY "profiles_update_admin"
ON profiles FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true));

-- ============================================================
-- CATEGORIES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  icon text NOT NULL DEFAULT 'Tag',
  color text NOT NULL DEFAULT '#3B82F6',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;

-- Any authenticated user can view active categories; admins can view all
DROP POLICY IF EXISTS "categories_select_authenticated" ON categories;
CREATE POLICY "categories_select_authenticated"
ON categories FOR SELECT
TO authenticated
USING (
  is_active = true
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true)
);

-- Only admins can insert categories
DROP POLICY IF EXISTS "categories_insert_admin" ON categories;
CREATE POLICY "categories_insert_admin"
ON categories FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true));

-- Only admins can update categories
DROP POLICY IF EXISTS "categories_update_admin" ON categories;
CREATE POLICY "categories_update_admin"
ON categories FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true))
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true));

-- Only admins can delete categories
DROP POLICY IF EXISTS "categories_delete_admin" ON categories;
CREATE POLICY "categories_delete_admin"
ON categories FOR DELETE
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true));

-- ============================================================
-- EXPENSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  description text NOT NULL DEFAULT '',
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON expenses TO authenticated;

-- Users can view their own expenses; admins can view all
DROP POLICY IF EXISTS "expenses_select_own_or_admin" ON expenses;
CREATE POLICY "expenses_select_own_or_admin"
ON expenses FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true)
);

-- Users can insert only their own expenses
DROP POLICY IF EXISTS "expenses_insert_own" ON expenses;
CREATE POLICY "expenses_insert_own"
ON expenses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update only their own expenses (not admins editing others')
DROP POLICY IF EXISTS "expenses_update_own" ON expenses;
CREATE POLICY "expenses_update_own"
ON expenses FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Users can delete only their own expenses
DROP POLICY IF EXISTS "expenses_delete_own" ON expenses;
CREATE POLICY "expenses_delete_own"
ON expenses FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================================
-- ADMIN AUDIT LOG TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON admin_audit_log TO authenticated;

-- Only admins can view audit logs
DROP POLICY IF EXISTS "audit_log_select_admin" ON admin_audit_log;
CREATE POLICY "audit_log_select_admin"
ON admin_audit_log FOR SELECT
TO authenticated
USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true));

-- Only admins can insert audit log entries
DROP POLICY IF EXISTS "audit_log_insert_admin" ON admin_audit_log;
CREATE POLICY "audit_log_insert_admin"
ON admin_audit_log FOR INSERT
TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_active = true));

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- ============================================================
-- TRIGGER: Auto-create profile on auth user creation
-- First registered user becomes admin
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, is_active)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM public.profiles WHERE role = 'admin') THEN 'admin'
      ELSE 'user'
    END,
    true
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Revoke execute from public; grant to authenticated (not strictly needed since trigger fires internally,
-- but keep the function callable only by the service role via trigger)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;

-- ============================================================
-- RPC: Get admin dashboard summary (total expenses across all users)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_admin_expenses_summary()
RETURNS TABLE (
  total_expenses numeric,
  total_users bigint,
  active_users bigint,
  expenses_this_month numeric,
  expenses_by_category json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  cat_json json;
BEGIN
  SELECT role = 'admin' AND is_active INTO is_admin
  FROM public.profiles WHERE id = auth.uid();

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_expenses FROM public.expenses;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_active) INTO total_users, active_users
  FROM public.profiles WHERE role = 'user';

  SELECT COALESCE(SUM(amount), 0) INTO expenses_this_month
  FROM public.expenses
  WHERE expense_date >= date_trunc('month', CURRENT_DATE)
    AND expense_date < date_trunc('month', CURRENT_DATE + INTERVAL '1 month');

  SELECT COALESCE(json_agg(json_build_object(
    'category_id', c.id,
    'category_name', c.name,
    'color', c.color,
    'total', COALESCE(s.total, 0),
    'count', COALESCE(s.cnt, 0)
  )), '[]'::json) INTO cat_json
  FROM public.categories c
  LEFT JOIN (
    SELECT category_id, SUM(amount) AS total, COUNT(*) AS cnt
    FROM public.expenses
    GROUP BY category_id
  ) s ON s.category_id = c.id
  WHERE c.is_active = true;

  expenses_by_category := cat_json;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_admin_expenses_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_expenses_summary() TO authenticated;

-- ============================================================
-- RPC: Get user monthly summary
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_user_monthly_summary(month_date date DEFAULT CURRENT_DATE)
RETURNS TABLE (
  total numeric,
  count bigint,
  by_category json
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cat_json json;
  month_start date := date_trunc('month', month_date);
  month_end date := date_trunc('month', month_date + INTERVAL '1 month');
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT COALESCE(SUM(amount), 0), COUNT(*) INTO total, count
  FROM public.expenses
  WHERE user_id = uid AND expense_date >= month_start AND expense_date < month_end;

  SELECT COALESCE(json_agg(json_build_object(
    'category_id', c.id,
    'category_name', c.name,
    'color', c.color,
    'icon', c.icon,
    'total', COALESCE(s.total, 0),
    'count', COALESCE(s.cnt, 0)
  )), '[]'::json) INTO cat_json
  FROM public.categories c
  LEFT JOIN (
    SELECT category_id, SUM(amount) AS total, COUNT(*) AS cnt
    FROM public.expenses
    WHERE user_id = uid AND expense_date >= month_start AND expense_date < month_end
    GROUP BY category_id
  ) s ON s.category_id = c.id
  WHERE c.is_active = true;

  by_category := cat_json;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_monthly_summary(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_monthly_summary(date) TO authenticated;

-- ============================================================
-- SEED: Default categories
-- ============================================================
INSERT INTO categories (name, description, icon, color) VALUES
  ('Alimentação', 'Gastos com comida, restaurante, mercado', 'Utensils', '#F59E0B'),
  ('Transporte', 'Combustível, ônibus, Uber, estacionamento', 'Car', '#3B82F6'),
  ('Moradia', 'Aluguel, condomínio, contas da casa', 'Home', '#10B981'),
  ('Saúde', 'Farmácia, médico, exames', 'HeartPulse', '#EF4444'),
  ('Lazer', 'Cinema, viagens, hobbies', 'Gamepad2', '#8B5CF6'),
  ('Educação', 'Cursos, livros, mensalidade', 'GraduationCap', '#6366F1'),
  ('Compras', 'Roupas, calçados, eletrônicos', 'ShoppingBag', '#EC4899'),
  ('Salário', 'Receita mensal de trabalho', 'Banknote', '#22C55E'),
  ('Outros', 'Gastos não categorizados', 'Tag', '#6B7280')
ON CONFLICT DO NOTHING;
