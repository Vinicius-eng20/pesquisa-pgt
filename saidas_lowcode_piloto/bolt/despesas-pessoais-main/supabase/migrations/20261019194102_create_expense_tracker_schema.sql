/*
# Expense Tracker — Database Schema

## Overview
Creates the full data model for a personal expense tracking application with
two types of users: regular users (track their own expenses) and an admin
(manage categories, deactivate accounts, view all expenses).

## Tables

### profiles
- `id` (uuid, PK, references auth.users) — one row per registered user
- `email` (text) — copied from auth for easy listing
- `full_name` (text) — display name
- `role` (text, 'user' | 'admin') — defaults to 'user'
- `active` (boolean, default true) — admin can deactivate accounts
- `created_at` (timestamptz)

### categories
- `id` (uuid, PK)
- `name` (text, not null)
- `color` (text) — hex color for UI
- `icon` (text) — lucide icon name
- `active` (boolean, default true) — admin can deactivate without deleting
- `created_at` (timestamptz)

### expenses
- `id` (uuid, PK)
- `user_id` (uuid, references profiles, default auth.uid())
- `category_id` (uuid, references categories)
- `amount` (numeric(12,2), not null)
- `description` (text)
- `expense_date` (date, not null) — when the expense happened
- `created_at` (timestamptz)

## Automation
- Trigger `on_auth_user_created` inserts a profiles row whenever a new user
  signs up. The FIRST user to register becomes the admin automatically; all
  later users get role 'user'.

## Security (RLS)
- `profiles`: users read/update own row; admins read all and can update any
  row's `active` and `role` fields.
- `categories`: any authenticated user can read active categories; only admins
  can insert/update/delete.
- `expenses`: users can CRUD only their own expenses; admins can read all.
- Helper function `is_admin()` checks the current user's profile role.
*/

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text DEFAULT '',
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- categories
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#0d9488',
  icon text NOT NULL DEFAULT 'Tag',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- expenses
-- ============================================================
CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  description text DEFAULT '',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_user_category ON expenses(user_id, category_id);

-- ============================================================
-- Helper: is_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ============================================================
-- Trigger: create profile on signup, first user becomes admin
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role text;
BEGIN
  SELECT CASE WHEN COUNT(*) = 0 THEN 'admin' ELSE 'user' END
    INTO assigned_role
    FROM profiles;

  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    assigned_role
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- profiles policies
-- ============================================================
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_admin());

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_admin_update" ON profiles;
CREATE POLICY "profiles_admin_update" ON profiles
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- categories policies
-- ============================================================
DROP POLICY IF EXISTS "categories_select_active" ON categories;
CREATE POLICY "categories_select_active" ON categories
  FOR SELECT TO authenticated
  USING (active = true OR is_admin());

DROP POLICY IF EXISTS "categories_admin_insert" ON categories;
CREATE POLICY "categories_admin_insert" ON categories
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "categories_admin_update" ON categories;
CREATE POLICY "categories_admin_update" ON categories
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "categories_admin_delete" ON categories;
CREATE POLICY "categories_admin_delete" ON categories
  FOR DELETE TO authenticated
  USING (is_admin());

-- ============================================================
-- expenses policies
-- ============================================================
DROP POLICY IF EXISTS "expenses_select_own_or_admin" ON expenses;
CREATE POLICY "expenses_select_own_or_admin" ON expenses
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "expenses_insert_own" ON expenses;
CREATE POLICY "expenses_insert_own" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "expenses_update_own" ON expenses;
CREATE POLICY "expenses_update_own" ON expenses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "expenses_delete_own" ON expenses;
CREATE POLICY "expenses_delete_own" ON expenses
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================
-- Seed default categories
-- ============================================================
INSERT INTO categories (name, color, icon)
SELECT * FROM (VALUES
  ('Alimentação',     '#ef4444', 'Utensils'),
  ('Moradia',         '#0d9488', 'Home'),
  ('Transporte',      '#3b82f6', 'Car'),
  ('Saúde',           '#ec4899', 'HeartPulse'),
  ('Lazer',           '#f59e0b', 'Gamepad2'),
  ('Educação',        '#8b5cf6', 'GraduationCap'),
  ('Compras',         '#14b8a6', 'ShoppingBag'),
  ('Outros',          '#64748b', 'Tag')
) AS t(name, color, icon)
WHERE NOT EXISTS (SELECT 1 FROM categories);
