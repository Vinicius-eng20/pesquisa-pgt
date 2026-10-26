/*
# Biblioteca Digital - Esquema do Banco de Dados

## Visão Geral
Cria o esquema completo de uma biblioteca digital com empréstimos de itens,
controle de usuários (leitores e bibliotecário) e histórico de empréstimos.

## Novas Tabelas
- profiles: perfil do usuário com nome, papel (reader/librarian) e bloqueio
- items: itens do acervo com título, autor, tipo, descrição, capa, cópias totais/disponíveis
- loans: empréstimos com usuário, item, data empréstimo, data prevista devolução, data devolução

## Funções
- is_librarian(): verifica se o usuário atual é bibliotecário
- handle_new_user(): trigger que cria profile no cadastro (primeiro usuário vira bibliotecário)
- borrow_item(item_id, loan_days): pega item emprestado (verifica bloqueio e disponibilidade)
- return_item(loan_id): devolve item
- promote_to_librarian(target_id): bibliotecário promove usuário
- set_user_blocked(target_id, blocked): bibliotecário bloquea/desbloqueia leitor

## Segurança
- profiles: leitor vê próprio perfil; bibliotecário vê todos. Leitor só edita o nome.
- items: todos veem; apenas bibliotecário cadastra/edita/remove.
- loans: leitor vê os seus; bibliotecário vê todos. Escritas via funções SECURITY DEFINER.
*/

-- ============================================================
-- PROFILES TABLE (must exist before is_librarian function)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'reader' CHECK (role IN ('reader', 'librarian')),
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (name) ON public.profiles TO authenticated;

-- ============================================================
-- HELPER FUNCTION: is_librarian (depends on profiles table)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_librarian()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'librarian'
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- Now create profiles policies (depend on is_librarian)
DROP POLICY IF EXISTS "profiles_select_own_or_librarian" ON public.profiles;
CREATE POLICY "profiles_select_own_or_librarian" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR public.is_librarian());

DROP POLICY IF EXISTS "profiles_update_own_or_librarian" ON public.profiles;
CREATE POLICY "profiles_update_own_or_librarian" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.is_librarian())
  WITH CHECK (auth.uid() = id OR public.is_librarian());

-- ============================================================
-- ITEMS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'livro' CHECK (type IN ('livro', 'ebook', 'audiobook', 'revista', 'dvd', 'cd', 'jogo')),
  description text NOT NULL DEFAULT '',
  cover_url text,
  total_copies int NOT NULL DEFAULT 1 CHECK (total_copies >= 0),
  available_copies int NOT NULL DEFAULT 1 CHECK (available_copies >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.items TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.items TO authenticated;

DROP POLICY IF EXISTS "items_select_all" ON public.items;
CREATE POLICY "items_select_all" ON public.items
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "items_insert_librarian" ON public.items;
CREATE POLICY "items_insert_librarian" ON public.items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_librarian());

DROP POLICY IF EXISTS "items_update_librarian" ON public.items;
CREATE POLICY "items_update_librarian" ON public.items
  FOR UPDATE TO authenticated
  USING (public.is_librarian())
  WITH CHECK (public.is_librarian());

DROP POLICY IF EXISTS "items_delete_librarian" ON public.items;
CREATE POLICY "items_delete_librarian" ON public.items
  FOR DELETE TO authenticated
  USING (public.is_librarian());

-- ============================================================
-- LOANS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  borrowed_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz NOT NULL,
  returned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.loans TO authenticated;

DROP POLICY IF EXISTS "loans_select_own_or_librarian" ON public.loans;
CREATE POLICY "loans_select_own_or_librarian" ON public.loans
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_librarian());

CREATE INDEX IF NOT EXISTS idx_loans_user_id ON public.loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_item_id ON public.loans(item_id);
CREATE INDEX IF NOT EXISTS idx_loans_returned_at ON public.loans(returned_at);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- First user becomes librarian; subsequent users become readers
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT CASE WHEN NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE role = 'librarian'
  ) THEN 'librarian' ELSE 'reader' END
  INTO v_role;

  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    v_role
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ACTION FUNCTIONS
-- ============================================================

-- Borrow an item
CREATE OR REPLACE FUNCTION public.borrow_item(p_item_id uuid, p_loan_days int DEFAULT 14)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_loan_id uuid;
  v_new_available int;
  v_blocked boolean;
  v_already_borrowed boolean;
BEGIN
  SELECT blocked INTO v_blocked FROM public.profiles WHERE id = auth.uid();
  IF v_blocked THEN
    RAISE EXCEPTION 'Sua conta está bloqueada. Procure o bibliotecário.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.loans
    WHERE user_id = auth.uid() AND item_id = p_item_id AND returned_at IS NULL
  ) INTO v_already_borrowed;
  IF v_already_borrowed THEN
    RAISE EXCEPTION 'Você já possui este item emprestado.';
  END IF;

  UPDATE public.items
  SET available_copies = available_copies - 1
  WHERE id = p_item_id AND available_copies > 0
  RETURNING available_copies INTO v_new_available;

  IF v_new_available IS NULL THEN
    RAISE EXCEPTION 'Item não disponível para empréstimo.';
  END IF;

  INSERT INTO public.loans (user_id, item_id, due_at)
  VALUES (auth.uid(), p_item_id, now() + make_interval(days => p_loan_days))
  RETURNING id INTO v_loan_id;

  RETURN v_loan_id;
END;
$$;

-- Return an item
CREATE OR REPLACE FUNCTION public.return_item(p_loan_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id uuid;
  v_user_id uuid;
BEGIN
  SELECT item_id, user_id INTO v_item_id, v_user_id
  FROM public.loans
  WHERE id = p_loan_id AND returned_at IS NULL;

  IF v_item_id IS NULL THEN
    RAISE EXCEPTION 'Empréstimo não encontrado ou já devolvido.';
  END IF;

  IF v_user_id != auth.uid() AND NOT public.is_librarian() THEN
    RAISE EXCEPTION 'Você não pode devolver um item que não pegou emprestado.';
  END IF;

  UPDATE public.loans SET returned_at = now() WHERE id = p_loan_id;
  UPDATE public.items SET available_copies = available_copies + 1 WHERE id = v_item_id;
END;
$$;

-- Promote a user to librarian (librarian only)
CREATE OR REPLACE FUNCTION public.promote_to_librarian(p_target_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_librarian() THEN
    RAISE EXCEPTION 'Apenas o bibliotecário pode promover usuários.';
  END IF;
  UPDATE public.profiles SET role = 'librarian' WHERE id = p_target_id;
END;
$$;

-- Block/unblock a reader (librarian only)
CREATE OR REPLACE FUNCTION public.set_user_blocked(p_target_id uuid, p_blocked boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_librarian() THEN
    RAISE EXCEPTION 'Apenas o bibliotecário pode bloquear usuários.';
  END IF;
  UPDATE public.profiles SET blocked = p_blocked WHERE id = p_target_id;
END;
$$;

-- Revoke execute from public/anon for sensitive functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.borrow_item(uuid, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.return_item(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.promote_to_librarian(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_user_blocked(uuid, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.borrow_item(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.return_item(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_to_librarian(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_blocked(uuid, boolean) TO authenticated;
