/*
# Online Course Platform - Core Schema

1. Overview
Online course platform: students browse and enroll in courses; an admin manages courses and all enrollments.
Everyone signs in with email/password. The first registered user becomes admin automatically.

2. New Tables
- profiles: id, email, name, role ('student'|'admin'), created_at.
- courses: title, description, instructor, category, level, duration_hours, image_url, is_published, created_by, timestamps.
- enrollments: student_id, course_id, status ('active'|'cancelled'), enrolled_at; unique (student_id, course_id).

3. Security
- RLS on all tables, grants scoped to authenticated (sign-in required).
- profiles: all authenticated SELECT; self UPDATE on name only (role not user-writable).
- courses: authenticated SELECT published; admin full CRUD.
- enrollments: student SELECT/INSERT own, UPDATE own status; admin SELECT all, UPDATE/DELETE any.
*/

-- ============================================================
-- TABLES (created first)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'admin')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL,
  instructor text NOT NULL,
  category text NOT NULL,
  level text NOT NULL DEFAULT 'Iniciante' CHECK (level IN ('Iniciante', 'Intermediario', 'Avancado')),
  duration_hours integer NOT NULL DEFAULT 0,
  image_url text,
  is_published boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, course_id)
);

-- ============================================================
-- FUNCTIONS (tables now exist)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    CASE
      WHEN NOT EXISTS (SELECT 1 FROM public.profiles) THEN 'admin'
      ELSE 'student'
    END
  );
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS courses_updated_at ON courses;
CREATE TRIGGER courses_updated_at
BEFORE UPDATE ON courses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================
-- RLS: PROFILES
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON profiles TO authenticated;
GRANT UPDATE (name) ON profiles TO authenticated;

DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
CREATE POLICY "profiles_select_all"
ON profiles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "profiles_update_own_name" ON profiles;
CREATE POLICY "profiles_update_own_name"
ON profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ============================================================
-- RLS: COURSES
-- ============================================================
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON courses TO authenticated;
GRANT INSERT, UPDATE, DELETE ON courses TO authenticated;

DROP POLICY IF EXISTS "courses_select" ON courses;
CREATE POLICY "courses_select"
ON courses FOR SELECT
TO authenticated
USING (
  is_published = true
  OR public.is_admin()
);

DROP POLICY IF EXISTS "courses_insert_admin" ON courses;
CREATE POLICY "courses_insert_admin"
ON courses FOR INSERT
TO authenticated
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "courses_update_admin" ON courses;
CREATE POLICY "courses_update_admin"
ON courses FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "courses_delete_admin" ON courses;
CREATE POLICY "courses_delete_admin"
ON courses FOR DELETE
TO authenticated
USING (public.is_admin());

-- ============================================================
-- RLS: ENROLLMENTS
-- ============================================================
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON enrollments TO authenticated;
GRANT INSERT ON enrollments TO authenticated;
GRANT UPDATE (status) ON enrollments TO authenticated;
GRANT DELETE ON enrollments TO authenticated;

DROP POLICY IF EXISTS "enrollments_select" ON enrollments;
CREATE POLICY "enrollments_select"
ON enrollments FOR SELECT
TO authenticated
USING (
  student_id = auth.uid()
  OR public.is_admin()
);

DROP POLICY IF EXISTS "enrollments_insert_own" ON enrollments;
CREATE POLICY "enrollments_insert_own"
ON enrollments FOR INSERT
TO authenticated
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "enrollments_update_own" ON enrollments;
CREATE POLICY "enrollments_update_own"
ON enrollments FOR UPDATE
TO authenticated
USING (student_id = auth.uid())
WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "enrollments_update_admin" ON enrollments;
CREATE POLICY "enrollments_update_admin"
ON enrollments FOR UPDATE
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "enrollments_delete_admin" ON enrollments;
CREATE POLICY "enrollments_delete_admin"
ON enrollments FOR DELETE
TO authenticated
USING (public.is_admin());
