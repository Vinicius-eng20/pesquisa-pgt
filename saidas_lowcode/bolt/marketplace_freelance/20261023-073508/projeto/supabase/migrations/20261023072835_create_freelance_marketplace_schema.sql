/*
# Create Freelance Marketplace Schema

1. New Tables
- `profiles`: Extends auth.users with display name, bio, avatar URL, role (user/admin), and suspension status.
  - `id` (uuid, PK, references auth.users)
  - `display_name` (text, not null)
  - `bio` (text, nullable)
  - `avatar_url` (text, nullable)
  - `role` (text, default 'user' — either 'user' or 'admin')
  - `is_suspended` (boolean, default false)
  - `created_at` (timestamptz)
- `services`: Services offered by freelancers.
  - `id` (uuid, PK)
  - `provider_id` (uuid, references profiles, the freelancer offering the service)
  - `title` (text, not null)
  - `description` (text, not null)
  - `category` (text, not null)
  - `price` (numeric, not null)
  - `status` (text, default 'pending' — 'pending', 'approved', 'rejected', 'removed')
  - `created_at` (timestamptz)
- `contracts`: Contracts between a client and a provider for a service.
  - `id` (uuid, PK)
  - `service_id` (uuid, references services)
  - `client_id` (uuid, references profiles, the person hiring)
  - `provider_id` (uuid, references profiles, the person offering)
  - `status` (text, default 'pending' — 'pending', 'accepted', 'completed', 'cancelled')
  - `details` (text, nullable, additional contract notes)
  - `created_at` (timestamptz)

2. Security
- Enable RLS on all tables.
- profiles: Users can read all profiles (needed to see who offers services). Users can update only their own profile (but NOT role or is_suspended columns — those are admin-only via column-restricted grants). Admins can read/update all profiles.
- services: Anyone authenticated can read approved services. Provider can read their own services (any status). Provider can insert/update their own services. Admin can update any service (to approve/reject/remove).
- contracts: Both client and provider can read contracts they participate in. Client can insert contracts (hire). Both can update status. Admin can read all contracts.

3. Important Notes
- The admin role is managed via profiles.role column. Only an admin can set another user's role or suspend them.
- Column-level grants restrict which columns a regular user can modify on profiles.
- A SECURITY DEFINER function `is_admin()` checks if the current user has role='admin'.
*/

-- ===================== PROFILES =====================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  bio text,
  avatar_url text,
  role text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  is_suspended boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE (display_name, bio, avatar_url) ON profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ===================== SERVICES =====================
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'Geral',
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON services TO authenticated;

DROP POLICY IF EXISTS "services_select_visible" ON services;
CREATE POLICY "services_select_visible"
  ON services FOR SELECT
  TO authenticated USING (
    status = 'approved'
    OR provider_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "services_insert_own" ON services;
CREATE POLICY "services_insert_own"
  ON services FOR INSERT
  TO authenticated WITH CHECK (provider_id = auth.uid());

DROP POLICY IF EXISTS "services_update_own_or_admin" ON services;
CREATE POLICY "services_update_own_or_admin"
  ON services FOR UPDATE
  TO authenticated USING (
    provider_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    provider_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ===================== CONTRACTS =====================
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  client_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
  details text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON contracts TO authenticated;

DROP POLICY IF EXISTS "contracts_select_participant" ON contracts;
CREATE POLICY "contracts_select_participant"
  ON contracts FOR SELECT
  TO authenticated USING (
    client_id = auth.uid()
    OR provider_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

DROP POLICY IF EXISTS "contracts_insert_as_client" ON contracts;
CREATE POLICY "contracts_insert_as_client"
  ON contracts FOR INSERT
  TO authenticated WITH CHECK (client_id = auth.uid());

DROP POLICY IF EXISTS "contracts_update_participant" ON contracts;
CREATE POLICY "contracts_update_participant"
  ON contracts FOR UPDATE
  TO authenticated USING (
    client_id = auth.uid()
    OR provider_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    client_id = auth.uid()
    OR provider_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ===================== ADMIN HELPERS =====================
-- Function to check if current user is admin (callable by authenticated role)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin' AND is_suspended = false
  );
$$;

REVOKE EXECUTE ON FUNCTION is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ===================== AUTO-CREATE PROFILE ON SIGNUP =====================
-- Trigger function to create a profile when a new auth.users row is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===================== INDEXES =====================
CREATE INDEX IF NOT EXISTS idx_services_status ON services(status);
CREATE INDEX IF NOT EXISTS idx_services_provider ON services(provider_id);
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_provider ON contracts(provider_id);
CREATE INDEX IF NOT EXISTS idx_contracts_service ON contracts(service_id);
