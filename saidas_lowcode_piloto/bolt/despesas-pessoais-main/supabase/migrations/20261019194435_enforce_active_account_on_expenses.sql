/*
# Enforce active account on expense writes

## Why
The admin can flip `profiles.active = false` to deactivate a user. The RLS
policies on `expenses` only checked `auth.uid() = user_id`, so a deactivated
user could still insert/update/delete expenses from an existing session.

## Changes
- Replaces the INSERT/UPDATE/DELETE policies on `expenses` so they also require
  the user's profile to be active (`is_active()` helper).
- SELECT is left open to owner OR admin so the user can still see their history
  (and the admin can browse). A deactivated user keeps read access but cannot
  add or modify expenses.
- Adds a `is_active()` SQL helper that checks `profiles.active` for the
  current user.
*/

CREATE OR REPLACE FUNCTION is_active()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT active FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- INSERT: owner AND active
DROP POLICY IF EXISTS "expenses_insert_own" ON expenses;
CREATE POLICY "expenses_insert_own" ON expenses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_active());

-- UPDATE: owner AND active
DROP POLICY IF EXISTS "expenses_update_own" ON expenses;
CREATE POLICY "expenses_update_own" ON expenses
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND is_active())
  WITH CHECK (auth.uid() = user_id AND is_active());

-- DELETE: owner AND active
DROP POLICY IF EXISTS "expenses_delete_own" ON expenses;
CREATE POLICY "expenses_delete_own" ON expenses
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND is_active());
