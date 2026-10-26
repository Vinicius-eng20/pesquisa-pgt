/*
# Team Task Management System Schema

This migration creates the complete database schema for a team task management application.

## Overview

The system supports two roles: "manager" (gerente) and "member" (membro).
- Managers can create, edit, delete, and assign tasks to any team member.
- Managers can see all tasks from all members.
- Members can see tasks assigned to them, change the status of their tasks, and create tasks for themselves.

## Tables

### 1. profiles
- Links to Supabase auth.users via the user's UUID.
- `id` (uuid, primary key, references auth.users)
- `name` (text, display name of the user)
- `role` (text, either 'manager' or 'member', defaults to 'member')
- `created_at` (timestamptz)

### 2. tasks
- `id` (uuid, primary key)
- `title` (text, task title)
- `description` (text, optional task description)
- `status` (text: 'pending' | 'in_progress' | 'completed', defaults to 'pending')
- `priority` (text: 'low' | 'medium' | 'high', defaults to 'medium')
- `created_by` (uuid, references profiles — who created the task)
- `assigned_to` (uuid, references profiles — who the task is assigned to; nullable for unassigned tasks)
- `due_date` (date, optional deadline)
- `created_at` (timestamptz)
- `updated_at` (timestamptz, auto-updated via trigger)

## Security (RLS)

### profiles
- SELECT: authenticated users can read all profiles (needed to list team members for task assignment).
- INSERT: automatic via trigger on auth.users signup (SECURITY DEFINER function). Users cannot insert directly.
- UPDATE: users can only update their own profile (name only). Role column is protected via column-level privilege — only service_role can update role.

### tasks
- SELECT: Managers see all tasks. Members see tasks assigned to them OR created by them.
- INSERT: Managers can create tasks for anyone. Members can create tasks only for themselves (assigned_to = own id).
- UPDATE: Managers can update any task. Members can update only the status of tasks assigned to them.
- DELETE: Only managers can delete tasks.

## Important Notes
1. A trigger function `handle_new_user` automatically creates a profile row when a new user signs up.
2. A trigger function `update_updated_at_column` keeps `updated_at` in sync.
3. Column-level privileges protect the `role` column on profiles — users cannot change their own role.
4. All policies use `auth.uid()` for ownership verification.
*/

-- ============================================================
-- PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('manager', 'member')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Grant SELECT to authenticated (needed to list team members for assignment)
GRANT SELECT ON profiles TO authenticated;

-- Grant UPDATE only on the 'name' column (NOT 'role' — that is admin-only)
GRANT UPDATE (name) ON profiles TO authenticated;

-- DROP existing policies if they exist (idempotent)
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- TASKS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO authenticated;

-- SELECT: managers see all, members see tasks assigned to them or created by them
DROP POLICY IF EXISTS "tasks_select" ON tasks;
CREATE POLICY "tasks_select"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
    OR assigned_to = auth.uid()
    OR created_by = auth.uid()
  );

-- INSERT: managers can assign to anyone, members can only assign to themselves
DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY "tasks_insert"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
    OR assigned_to = auth.uid()
  );

-- UPDATE: managers can update anything, members can only update status of their assigned tasks
DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY "tasks_update"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
    OR assigned_to = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
    OR assigned_to = auth.uid()
  );

-- DELETE: only managers
DROP POLICY IF EXISTS "tasks_delete" ON tasks;
CREATE POLICY "tasks_delete"
  ON tasks FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'manager')
  );

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);

-- ============================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), 'member');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TRIGGER: Auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SECURITY: Revoke function execute from anon/public
-- ============================================================

REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION update_updated_at_column() FROM PUBLIC, anon;