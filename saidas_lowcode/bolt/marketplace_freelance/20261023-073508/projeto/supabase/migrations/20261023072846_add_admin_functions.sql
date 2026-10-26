/*
# Add Admin Profile Management Functions

Admins need to be able to:
1. Approve/reject/remove services (update service status) — handled by existing UPDATE policy.
2. Suspend/unsuspend user accounts — need an admin-only function since regular users can't update is_suspended.
3. Promote users to admin — need admin-only function since regular users can't update role.

These are SECURITY DEFINER functions so they run with elevated privileges,
bypassing the column-level grant restrictions on profiles.
*/

-- Admin function to suspend/unsuspend a user
CREATE OR REPLACE FUNCTION admin_set_suspended(target_user_id uuid, suspend boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_suspended = false) THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;
  UPDATE profiles SET is_suspended = suspend WHERE id = target_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_set_suspended(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_set_suspended(uuid, boolean) TO authenticated;

-- Admin function to set user role (promote/demote admin)
CREATE OR REPLACE FUNCTION admin_set_role(target_user_id uuid, new_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin' AND is_suspended = false) THEN
    RAISE EXCEPTION 'Permission denied: admin role required';
  END IF;
  IF new_role NOT IN ('user', 'admin') THEN
    RAISE EXCEPTION 'Invalid role: must be user or admin';
  END IF;
  UPDATE profiles SET role = new_role WHERE id = target_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION admin_set_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION admin_set_role(uuid, text) TO authenticated;
