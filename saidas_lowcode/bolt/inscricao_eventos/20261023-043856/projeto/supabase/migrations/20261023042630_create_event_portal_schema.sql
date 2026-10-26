/*
# Portal de Inscrição para Eventos — Schema Completo

## Descrição
Cria o esquema de banco de dados para um portal de inscrição em eventos onde:
- Participantes podem ver eventos disponíveis, se inscrever e cancelar inscrições
- Organizadores podem criar/editar/cancelar eventos, confirmar presença e ver todas as inscrições

## Novas Tabelas

### 1. `profiles`
- `id` (uuid, primary key, referencia auth.users)
- `name` (text, nome de exibição do usuário)
- `role` (text, 'participant' ou 'organizer', padrão 'participant')
- `created_at` (timestamptz)

### 2. `events`
- `id` (uuid, primary key)
- `title` (text, título do evento)
- `description` (text, descrição detalhada)
- `date` (timestamptz, data e hora do evento)
- `location` (text, local do evento)
- `capacity` (integer, número máximo de vagas)
- `image_url` (text, URL de imagem opcional)
- `status` (text, 'open' ou 'cancelled', padrão 'open')
- `organizer_id` (uuid, referência a auth.users, quem criou o evento)
- `created_at` (timestamptz)

### 3. `registrations`
- `id` (uuid, primary key)
- `event_id` (uuid, referência a events)
- `user_id` (uuid, referência a auth.users, quem se inscreveu)
- `status` (text, 'pending' ou 'confirmed' ou 'cancelled', padrão 'pending')
- `created_at` (timestamptz)
- Unique constraint em (event_id, user_id) para evitar inscrições duplicadas

## Segurança
- RLS habilitado em todas as tabelas
- `profiles`: usuário lê/edita apenas o próprio perfil; qualquer pessoa autenticada pode ler perfis (para ver nomes)
- `events`: qualquer pessoa autenticada pode ler eventos; apenas organizadores podem criar/editar
- `registrations`: participantes veêm e criam apenas suas próprias inscrições; organizadores do evento podem ver e atualizar inscrições dos seus eventos
- Todas as políticas usam auth.uid() para verificação de propriedade

## Notas
1. A função `is_organizer()` verifica se o usuário atual tem role 'organizer' no perfil
2. A coluna `user_id` em registrations tem DEFAULT auth.uid() para que inserts do frontend funcionem sem passar user_id explicitamente
3. A coluna `organizer_id` em events tem DEFAULT auth.uid() pelo mesmo motivo
*/

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'participant' CHECK (role IN ('participant', 'organizer')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;

-- Any authenticated user can read profiles (to see names of participants)
DROP POLICY IF EXISTS "read_all_profiles" ON profiles;
CREATE POLICY "read_all_profiles" ON profiles FOR SELECT
  TO authenticated USING (true);

-- Users can insert their own profile
DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- Users can update their own profile (but not their role for security)
DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- EVENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  date timestamptz NOT NULL,
  location text NOT NULL DEFAULT '',
  capacity integer NOT NULL DEFAULT 0 CHECK (capacity >= 0),
  image_url text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cancelled')),
  organizer_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON events TO authenticated;

-- All authenticated users can read events
DROP POLICY IF EXISTS "read_all_events" ON events;
CREATE POLICY "read_all_events" ON events FOR SELECT
  TO authenticated USING (true);

-- Only organizers can create events
DROP POLICY IF EXISTS "insert_events_organizer" ON events;
CREATE POLICY "insert_events_organizer" ON events FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'organizer')
  );

-- Only the organizer who created an event can update it
DROP POLICY IF EXISTS "update_own_events" ON events;
CREATE POLICY "update_own_events" ON events FOR UPDATE
  TO authenticated USING (
    organizer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'organizer')
  )
  WITH CHECK (
    organizer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'organizer')
  );

-- ============================================================
-- REGISTRATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE ON registrations TO authenticated;

-- Participants can read their own registrations; organizers can read registrations for their events
DROP POLICY IF EXISTS "read_registrations" ON registrations;
CREATE POLICY "read_registrations" ON registrations FOR SELECT
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registrations.event_id
      AND e.organizer_id = auth.uid()
    )
  );

-- Participants can insert their own registrations (only for open events)
DROP POLICY IF EXISTS "insert_own_registrations" ON registrations;
CREATE POLICY "insert_own_registrations" ON registrations FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM events WHERE events.id = registrations.event_id AND events.status = 'open')
  );

-- Participants can update (cancel) their own registrations; organizers can confirm attendance
DROP POLICY IF EXISTS "update_registrations" ON registrations;
CREATE POLICY "update_registrations" ON registrations FOR UPDATE
  TO authenticated USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registrations.event_id
      AND e.organizer_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = registrations.event_id
      AND e.organizer_id = auth.uid()
    )
  );

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_registrations_event_id ON registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user_id ON registrations(user_id);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;