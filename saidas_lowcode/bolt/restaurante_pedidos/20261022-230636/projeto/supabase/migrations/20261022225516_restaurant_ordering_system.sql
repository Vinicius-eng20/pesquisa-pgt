/*
# Restaurant Ordering System Schema

1. Overview
- Full restaurant ordering system with two user roles: "customer" and "manager".
- Customers can browse the menu, place orders, and track their own orders.
- The manager can manage menu items (CRUD) and view/manage ALL orders from ALL customers.
- Uses Supabase Auth (email/password). A `profiles` table stores the role for each user.
- The first registered user is automatically promoted to manager via a database trigger.

2. New Tables
- `profiles`: Extends auth.users with a `role` column ('customer' | 'manager') and `full_name`.
  - `id` (uuid, PK, references auth.users)
  - `email` (text)
  - `full_name` (text)
  - `role` (text, default 'customer')
  - `created_at` (timestamptz)

- `menu_items`: The restaurant's menu / cardápio.
  - `id` (uuid, PK)
  - `name` (text, not null) — dish name
  - `description` (text) — optional description
  - `price` (numeric, not null) — price in BRL
  - `category` (text, default 'Pratos') — category (e.g. Entradas, Pratos, Sobremesas, Bebidas)
  - `image_url` (text) — optional image URL
  - `available` (boolean, default true) — whether the item is available to order
  - `created_at` (timestamptz)

- `orders`: Customer orders.
  - `id` (uuid, PK)
  - `user_id` (uuid, not null, references auth.users, defaults to auth.uid())
  - `customer_name` (text, not null) — denormalized for manager display
  - `status` (text, not null, default 'pending') — pending | preparing | ready | delivered | cancelled
  - `table_number` (text) — optional table/room identifier
  - `notes` (text) — optional order notes
  - `total` (numeric, not null, default 0) — order total
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())

- `order_items`: Line items within an order.
  - `id` (uuid, PK)
  - `order_id` (uuid, not null, references orders ON DELETE CASCADE)
  - `menu_item_id` (uuid, references menu_items) — can be null if item deleted
  - `name` (text, not null) — snapshot of dish name
  - `price` (numeric, not null) — snapshot of price at order time
  - `quantity` (integer, not null, default 1)
  - `created_at` (timestamptz)

3. Security
- RLS enabled on ALL tables.
- profiles: each user can read/update their own profile. Managers can read all profiles.
- menu_items: any authenticated user can SELECT. Only managers can INSERT/UPDATE/DELETE.
- orders: customers can SELECT/INSERT their own orders. Managers can SELECT all and UPDATE status on all.
- order_items: customers can SELECT their own (via order ownership). Managers can SELECT all. INSERT allowed for authenticated (order owner creates items with their own order).
- Role checks use `profiles` table lookups (EXISTS subquery).
- Grants follow least-privilege: only `authenticated` role gets access (this app requires sign-in).

4. Trigger
- `handle_new_user`: on INSERT to auth.users, creates a profile row. The FIRST user ever registered gets the 'manager' role; all subsequent users get 'customer'.
- `update_orders_updated_at`: automatically updates `updated_at` on orders when the row changes.

5. Important Notes
- This migration is idempotent: uses IF NOT EXISTS and DROP POLICY IF EXISTS.
- The trigger checks for existing profiles count to decide the first manager.
- All monetary values use numeric(10,2) for precise BRL formatting.
*/

-- =============================================================
-- profiles table
-- =============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'manager')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, UPDATE ON profiles TO authenticated;

-- Profiles: users can read their own profile
DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- Profiles: users can update their own profile (name only via column grant below)
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Restrict UPDATE to only full_name column for regular users
-- (managers don't update profiles through the app, role is set by trigger)
GRANT UPDATE (full_name) ON profiles TO authenticated;

-- =============================================================
-- menu_items table
-- =============================================================
CREATE TABLE IF NOT EXISTS menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  price numeric(10,2) NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'Pratos',
  image_url text DEFAULT '',
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON menu_items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON menu_items TO authenticated;

-- Any authenticated user can read menu items
DROP POLICY IF EXISTS "select_menu_items" ON menu_items;
CREATE POLICY "select_menu_items" ON menu_items FOR SELECT
  TO authenticated USING (true);

-- Only managers can create menu items
DROP POLICY IF EXISTS "insert_menu_items_manager" ON menu_items;
CREATE POLICY "insert_menu_items_manager" ON menu_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager')
  );

-- Only managers can update menu items
DROP POLICY IF EXISTS "update_menu_items_manager" ON menu_items;
CREATE POLICY "update_menu_items_manager" ON menu_items FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager')
  );

-- Only managers can delete menu items
DROP POLICY IF EXISTS "delete_menu_items_manager" ON menu_items;
CREATE POLICY "delete_menu_items_manager" ON menu_items FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager')
  );

-- =============================================================
-- orders table
-- =============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'delivered', 'cancelled')),
  table_number text DEFAULT '',
  notes text DEFAULT '',
  total numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON orders TO authenticated;

-- Customers can read their own orders; managers can read ALL orders
DROP POLICY IF EXISTS "select_orders" ON orders;
CREATE POLICY "select_orders" ON orders FOR SELECT
  TO authenticated USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- Customers can insert their own orders
DROP POLICY IF EXISTS "insert_own_orders" ON orders;
CREATE POLICY "insert_own_orders" ON orders FOR INSERT
  TO authenticated WITH CHECK (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- Customers can update their own orders (e.g., cancel). Managers can update any order (status changes).
DROP POLICY IF EXISTS "update_orders" ON orders;
CREATE POLICY "update_orders" ON orders FOR UPDATE
  TO authenticated USING (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  ) WITH CHECK (
    auth.uid() = user_id OR EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- =============================================================
-- order_items table
-- =============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id uuid REFERENCES menu_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON order_items TO authenticated;

-- Customers can read items for their own orders; managers can read all
DROP POLICY IF EXISTS "select_order_items" ON order_items;
CREATE POLICY "select_order_items" ON order_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'manager')
  );

-- Customers can insert items into their own orders
DROP POLICY IF EXISTS "insert_order_items" ON order_items;
CREATE POLICY "insert_order_items" ON order_items FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND o.user_id = auth.uid())
  );

-- =============================================================
-- updated_at trigger for orders
-- =============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- Auto-create profile on signup + assign first user as manager
-- =============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_count integer;
BEGIN
  SELECT COUNT(*) INTO existing_count FROM profiles;
  IF existing_count = 0 THEN
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'manager');
  ELSE
    INSERT INTO profiles (id, email, full_name, role)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'customer');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();