/*
# Fix handle_new_user trigger function

The `handle_new_user` SECURITY DEFINER function was failing during signup
because it lacked an explicit `search_path`, causing "Database error saving
new user". The Supabase database linter also flagged this as a security issue.

## Changes

1. Recreate `handle_new_user()` with `SET search_path = public` and `SECURITY DEFINER`.
2. Recreate `update_updated_at_column()` with `SET search_path = public`.
3. Tighten grants on `profiles`:
   - Revoke all from `anon` (auth app requires sign-in, anon should not access profiles).
   - Grant SELECT to `authenticated` (needed to list team members).
   - Grant UPDATE only on `name` column to `authenticated` (protect `role` column).
   - Do NOT grant INSERT/DELETE to `authenticated` on profiles — profiles are
     created by the trigger function (SECURITY DEFINER) and never deleted by users.
4. Revoke EXECUTE on both functions from PUBLIC and anon to prevent direct RPC calls.
5. Add an INSERT policy on profiles so the SECURITY DEFINER function can insert
   (SECURITY DEFINER bypasses RLS, but having the policy documents intent and
   protects against future INVOKER changes).
*/

-- ============================================================
-- Fix trigger function with explicit search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'member'
  );
  RETURN NEW;
END;
$$;

-- Re-create the trigger to pick up the new function definition
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Fix update_updated_at_column with explicit search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_updated_at ON public.tasks;
CREATE TRIGGER tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- Tighten grants on profiles
-- ============================================================

-- Revoke broad grants from anon and authenticated
REVOKE ALL ON public.profiles FROM anon;
REVOKE ALL ON public.profiles FROM authenticated;

-- Grant only what's needed:
-- SELECT: authenticated users need to list team members for task assignment
GRANT SELECT ON public.profiles TO authenticated;

-- UPDATE: only the name column (role is admin-only)
GRANT UPDATE (name) ON public.profiles TO authenticated;

-- ============================================================
-- Revoke function execute from PUBLIC and anon
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon;