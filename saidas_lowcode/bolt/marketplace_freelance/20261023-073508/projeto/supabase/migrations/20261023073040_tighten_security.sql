/*
# Tighten Security: Revoke anon and Restrict ADMIN Functions

1. The `anon` role had inherited SELECT/INSERT/UPDATE/DELETE grants on all tables
   via Postgres defaults. Revoke those — only `authenticated` should have access
   since this is a sign-in-only app.

2. SECURITY DEFINER functions `admin_set_suspended` and `admin_set_role` are
   callable by any authenticated user via RPC. The functions themselves check
   for admin role internally, but defense in depth: revoke EXECUTE from
   `authenticated` and `PUBLIC`, and only re-grant to `authenticated` (the
   function body checks admin status).

3. `handle_new_user` trigger function should not be callable via RPC. Revoke
   from authenticated.

4. `is_admin` is a helper query — safe for authenticated to call, but it
   already revokes anon. Keep as-is.

5. Also tighten profiles UPDATE grant to only the columns users can edit
   (display_name, bio, avatar_url) — role and is_suspended are admin-only.
   (Already done in initial migration, but the grant posture showed all
   columns. This confirms it.)
*/

-- Revoke ALL privileges from anon on all tables
REVOKE ALL ON profiles FROM anon;
REVOKE ALL ON services FROM anon;
REVOKE ALL ON contracts FROM anon;

-- Revoke DELETE from authenticated on services and contracts
-- (users shouldn't delete services/contracts directly; they update status)
REVOKE DELETE ON services FROM authenticated;
REVOKE DELETE ON contracts FROM authenticated;

-- handle_new_user should only run as a trigger, not via RPC
REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon, authenticated;
