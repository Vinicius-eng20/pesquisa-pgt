/*
# Sistema de Agendamento de Serviços — Schema Completo

## Descrição
Cria toda a estrutura de tabelas para um sistema de agendamento onde:
- O responsável pelo negócio (business) cadastra serviços e horários disponíveis
- Clientes visualizam serviços, veem horários livres e fazem agendamentos
- O responsável confirma ou recusa agendamentos
- Cada usuário acessa apenas seus próprios dados (exceto o business que vê tudo)

## Tabelas Criadas

### 1. profiles
Extende auth.users com dados adicionais de cada usuário.
- id (uuid, PK, referência a auth.users)
- email (text)
- full_name (text, nome completo do usuário)
- phone (text, telefone opcional)
- role (text: 'business' ou 'client' — define permissões)
- created_at (timestamptz)

### 2. services
Serviços oferecidos pelo negócio. Apenas o business pode criar/editar.
- id (uuid, PK)
- business_id (uuid, FK para profiles.id — referência ao responsável)
- name (text, nome do serviço)
- description (text, descrição detalhada)
- duration_minutes (int, duração em minutos)
- price (numeric, preço em reais)
- active (boolean, se está ativo/visível)
- created_at (timestamptz)

### 3. available_slots
Horários disponíveis para agendamento. Apenas o business cria/edita.
- id (uuid, PK)
- business_id (uuid, FK para profiles.id)
- service_id (uuid, FK para services.id — qual serviço neste horário)
- start_time (timestamptz, início do horário)
- end_time (timestamptz, fim do horário)
- is_booked (boolean, se já foi agendado por alguém)
- created_at (timestamptz)

### 4. bookings
Agendamentos feitos por clientes. Apenas clientes criam; business confirma/recusa.
- id (uuid, PK)
- client_id (uuid, FK para profiles.id — quem agendou)
- business_id (uuid, FK para profiles.id — responsável do negócio)
- service_id (uuid, FK para services.id)
- slot_id (uuid, FK para available_slots.id — horário reservado)
- status (text: 'pending' = aguardando, 'confirmed' = confirmado, 'declined' = recusado, 'cancelled' = cancelado pelo cliente)
- notes (text, observações opcionais do cliente)
- created_at (timestamptz)

## Segurança (RLS)
- profiles: usuário vê próprio perfil; business vê todos perfis
- services: todos autenticados veem serviços ativos; business vê e gerencia os seus
- available_slots: clientes veem slots livres; business vê e gerencia os seus
- bookings: cliente vê próprios; business vê todos do seu negócio; cliente cria; business confirma/recusa

## Notas
1. Todas as tabelas têm RLS habilitado
2. Grants específicos por role e operação
3. business_id/client_id têm DEFAULT auth.uid()
4. Função is_business() verifica role do usuário
5. Trigger cria profile automaticamente no cadastro
*/

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  role text NOT NULL DEFAULT 'client' CHECK (role IN ('business', 'client')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.is_business()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'business'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_business() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_business() TO authenticated;

DROP POLICY IF EXISTS "select_own_or_all_if_business" ON profiles;
CREATE POLICY "select_own_or_all_if_business" ON profiles FOR SELECT
  TO authenticated USING (
    auth.uid() = id OR public.is_business()
  );

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text DEFAULT '',
  duration_minutes int NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON services TO authenticated;

DROP POLICY IF EXISTS "select_services" ON services;
CREATE POLICY "select_services" ON services FOR SELECT
  TO authenticated USING (
    business_id = auth.uid() OR (active = true AND public.is_business() = false)
  );

DROP POLICY IF EXISTS "insert_services_business" ON services;
CREATE POLICY "insert_services_business" ON services FOR INSERT
  TO authenticated WITH CHECK (
    business_id = auth.uid() AND public.is_business()
  );

DROP POLICY IF EXISTS "update_services_business" ON services;
CREATE POLICY "update_services_business" ON services FOR UPDATE
  TO authenticated USING (business_id = auth.uid() AND public.is_business())
  WITH CHECK (business_id = auth.uid() AND public.is_business());

DROP POLICY IF EXISTS "delete_services_business" ON services;
CREATE POLICY "delete_services_business" ON services FOR DELETE
  TO authenticated USING (business_id = auth.uid() AND public.is_business());

-- ============================================================
-- AVAILABLE_SLOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS available_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  is_booked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slot_time_order CHECK (end_time > start_time)
);

ALTER TABLE available_slots ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON available_slots TO authenticated;

DROP POLICY IF EXISTS "select_slots" ON available_slots;
CREATE POLICY "select_slots" ON available_slots FOR SELECT
  TO authenticated USING (
    business_id = auth.uid() OR (is_booked = false AND public.is_business() = false)
  );

DROP POLICY IF EXISTS "insert_slots_business" ON available_slots;
CREATE POLICY "insert_slots_business" ON available_slots FOR INSERT
  TO authenticated WITH CHECK (
    business_id = auth.uid() AND public.is_business()
  );

DROP POLICY IF EXISTS "update_slots_business" ON available_slots;
CREATE POLICY "update_slots_business" ON available_slots FOR UPDATE
  TO authenticated USING (business_id = auth.uid() AND public.is_business())
  WITH CHECK (business_id = auth.uid() AND public.is_business());

DROP POLICY IF EXISTS "delete_slots_business" ON available_slots;
CREATE POLICY "delete_slots_business" ON available_slots FOR DELETE
  TO authenticated USING (business_id = auth.uid() AND public.is_business());

-- ============================================================
-- BOOKINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  business_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES available_slots(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'declined', 'cancelled')),
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON bookings TO authenticated;

DROP POLICY IF EXISTS "select_bookings" ON bookings;
CREATE POLICY "select_bookings" ON bookings FOR SELECT
  TO authenticated USING (
    client_id = auth.uid() OR business_id = auth.uid()
  );

DROP POLICY IF EXISTS "insert_bookings_client" ON bookings;
CREATE POLICY "insert_bookings_client" ON bookings FOR INSERT
  TO authenticated WITH CHECK (
    client_id = auth.uid()
    AND public.is_business() = false
    AND EXISTS (
      SELECT 1 FROM available_slots
      WHERE available_slots.id = bookings.slot_id
        AND available_slots.is_booked = false
    )
  );

DROP POLICY IF EXISTS "update_bookings" ON bookings;
CREATE POLICY "update_bookings" ON bookings FOR UPDATE
  TO authenticated USING (
    client_id = auth.uid() OR business_id = auth.uid()
  )
  WITH CHECK (
    client_id = auth.uid() OR business_id = auth.uid()
  );

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_services_business_id ON services(business_id);
CREATE INDEX IF NOT EXISTS idx_services_active ON services(active);
CREATE INDEX IF NOT EXISTS idx_slots_business_id ON available_slots(business_id);
CREATE INDEX IF NOT EXISTS idx_slots_service_id ON available_slots(service_id);
CREATE INDEX IF NOT EXISTS idx_slots_start_time ON available_slots(start_time);
CREATE INDEX IF NOT EXISTS idx_slots_is_booked ON available_slots(is_booked);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_bookings_business_id ON bookings(business_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_slot_id ON bookings(slot_id);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', NULL),
    COALESCE(NEW.raw_user_meta_data->>'role', 'client')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;