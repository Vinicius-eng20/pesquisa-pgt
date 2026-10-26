/*
# Hotel Reservation System - Initial Schema

1. Purpose
- Creates the complete database schema for a hotel reservation system.
- Guests can browse available rooms, make reservations, and view/cancel their own reservations.
- A hotel manager can manage rooms (CRUD), approve/reject reservations, and view all reservations.

2. New Tables
- `profiles` — extends Supabase auth.users with a role field.
  - `id` (uuid, PK, references auth.users)
  - `full_name` (text, the person's display name)
  - `role` (text, 'guest' or 'manager', default 'guest')
  - `created_at` (timestamptz)
- `rooms` — hotel rooms available for booking.
  - `id` (uuid, PK)
  - `name` (text, room name/number)
  - `description` (text, room description)
  - `price_per_night` (numeric, cost per night)
  - `capacity` (int, max guests)
  - `image_url` (text, optional room photo URL)
  - `amenities` (text[], list of amenities)
  - `is_active` (boolean, whether the room is bookable)
  - `created_at` (timestamptz)
- `reservations` — booking requests made by guests.
  - `id` (uuid, PK)
  - `room_id` (uuid, FK to rooms)
  - `guest_id` (uuid, FK to auth.users, defaults to auth.uid())
  - `check_in` (date, arrival date)
  - `check_out` (date, departure date)
  - `guests_count` (int, number of guests)
  - `status` (text, 'pending' | 'confirmed' | 'rejected' | 'cancelled', default 'pending')
  - `total_price` (numeric, calculated total)
  - `notes` (text, optional guest notes)
  - `created_at` (timestamptz)

3. Security
- RLS enabled on all tables.
- `profiles`: each user can read/update their own profile. Managers can read all profiles.
- `rooms`: anyone authenticated can read active rooms; only managers can insert/update/delete.
- `reservations`: guests can CRUD their own reservations; managers can read all and update status.
- Role checks use a helper function `is_manager()` that checks profiles.role = 'manager'.
*/

-- ============================================================
-- Profiles table (created first so helper functions can reference it)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'guest' CHECK (role IN ('guest', 'manager')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON public.profiles TO authenticated;

-- Each user can read and update their own profile
DROP POLICY IF EXISTS "select_own_profile" ON public.profiles;
CREATE POLICY "select_own_profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON public.profiles;
CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- Helper function: is_manager (created after profiles table)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'manager'
  );
$$;

-- Managers can read all profiles (to see guest names in reservations)
DROP POLICY IF EXISTS "manager_select_all_profiles" ON public.profiles;
CREATE POLICY "manager_select_all_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_manager());

-- ============================================================
-- Rooms table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  price_per_night numeric(10, 2) NOT NULL DEFAULT 0,
  capacity integer NOT NULL DEFAULT 2,
  image_url text,
  amenities text[] DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read rooms
GRANT SELECT ON public.rooms TO authenticated;

-- Only managers can insert/update/delete rooms (policy enforces, grant needed for the verbs)
GRANT INSERT, UPDATE, DELETE ON public.rooms TO authenticated;

DROP POLICY IF EXISTS "read_rooms" ON public.rooms;
CREATE POLICY "read_rooms" ON public.rooms
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "manager_insert_rooms" ON public.rooms;
CREATE POLICY "manager_insert_rooms" ON public.rooms
  FOR INSERT TO authenticated WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS "manager_update_rooms" ON public.rooms;
CREATE POLICY "manager_update_rooms" ON public.rooms
  FOR UPDATE TO authenticated USING (public.is_manager()) WITH CHECK (public.is_manager());

DROP POLICY IF EXISTS "manager_delete_rooms" ON public.rooms;
CREATE POLICY "manager_delete_rooms" ON public.rooms
  FOR DELETE TO authenticated USING (public.is_manager());

-- ============================================================
-- Reservations table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  guest_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  check_in date NOT NULL,
  check_out date NOT NULL,
  guests_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  total_price numeric(10, 2) NOT NULL DEFAULT 0,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_dates CHECK (check_out > check_in),
  CONSTRAINT valid_guests CHECK (guests_count > 0)
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;

-- Guests can read their own reservations
DROP POLICY IF EXISTS "guest_select_own_reservations" ON public.reservations;
CREATE POLICY "guest_select_own_reservations" ON public.reservations
  FOR SELECT TO authenticated USING (auth.uid() = guest_id);

-- Managers can read all reservations
DROP POLICY IF EXISTS "manager_select_all_reservations" ON public.reservations;
CREATE POLICY "manager_select_all_reservations" ON public.reservations
  FOR SELECT TO authenticated USING (public.is_manager());

-- Guests can insert their own reservations
DROP POLICY IF EXISTS "guest_insert_reservations" ON public.reservations;
CREATE POLICY "guest_insert_reservations" ON public.reservations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = guest_id);

-- Guests can update (cancel) their own reservations
DROP POLICY IF EXISTS "guest_update_own_reservations" ON public.reservations;
CREATE POLICY "guest_update_own_reservations" ON public.reservations
  FOR UPDATE TO authenticated
  USING (auth.uid() = guest_id)
  WITH CHECK (auth.uid() = guest_id);

-- Managers can update reservation status (confirm/reject)
DROP POLICY IF EXISTS "manager_update_reservations" ON public.reservations;
CREATE POLICY "manager_update_reservations" ON public.reservations
  FOR UPDATE TO authenticated
  USING (public.is_manager())
  WITH CHECK (public.is_manager());

-- Guests can delete their own reservations
DROP POLICY IF EXISTS "guest_delete_own_reservations" ON public.reservations;
CREATE POLICY "guest_delete_own_reservations" ON public.reservations
  FOR DELETE TO authenticated USING (auth.uid() = guest_id);

-- ============================================================
-- Trigger: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'guest')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_reservations_guest_id ON public.reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_reservations_room_id ON public.reservations(room_id);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON public.reservations(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_rooms_active ON public.rooms(is_active);
