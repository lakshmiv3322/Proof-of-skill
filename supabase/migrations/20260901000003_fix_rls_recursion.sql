-- -------------------------------------------------------------
-- ProofOfSkill - Fix RLS Recursion & Harden Signup Trigger
-- File: supabase/migrations/20260901000003_fix_rls_recursion.sql
-- -------------------------------------------------------------

-- 1. Helper SECURITY DEFINER functions (bypass RLS when looking up caller details)

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_institute_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT institute_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- 2. Drop self-referential policies on users and institutes that cause infinite recursion

DROP POLICY IF EXISTS "users: read own tenant" ON public.users;
DROP POLICY IF EXISTS "users: update own profile" ON public.users;
DROP POLICY IF EXISTS "users: admin manage own institute" ON public.users;
DROP POLICY IF EXISTS "users: platform_admin full access" ON public.users;
DROP POLICY IF EXISTS "users: insert own on signup" ON public.users;
DROP POLICY IF EXISTS "users_select_own_or_tenant" ON public.users;
DROP POLICY IF EXISTS "users_update_own_profile" ON public.users;
DROP POLICY IF EXISTS "users_admin_manage_own_institute" ON public.users;
DROP POLICY IF EXISTS "users_platform_admin_full_access" ON public.users;
DROP POLICY IF EXISTS "users_insert_own_on_signup" ON public.users;

DROP POLICY IF EXISTS "institutes: platform_admin full access" ON public.institutes;
DROP POLICY IF EXISTS "institutes_platform_admin_full_access" ON public.institutes;

-- 3. Re-create non-recursive policies using SECURITY DEFINER functions

CREATE POLICY "users_select_own_or_tenant" ON public.users
  FOR SELECT TO authenticated
  USING (
    auth_id = auth.uid()
    OR institute_id = public.current_user_institute_id()
  );

CREATE POLICY "users_update_own_profile" ON public.users
  FOR UPDATE TO authenticated
  USING (auth_id = auth.uid())
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "users_admin_manage_own_institute" ON public.users
  FOR ALL TO authenticated
  USING (
    institute_id = public.current_user_institute_id()
    AND public.current_user_role() IN ('institute_admin', 'platform_admin')
  );

CREATE POLICY "users_platform_admin_full_access" ON public.users
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'platform_admin');

CREATE POLICY "users_insert_own_on_signup" ON public.users
  FOR INSERT TO authenticated
  WITH CHECK (auth_id = auth.uid());

CREATE POLICY "institutes_platform_admin_full_access" ON public.institutes
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'platform_admin');

-- 4. Hardened signup trigger: verify institute_id exists before inserting

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_institute_id uuid;
  v_full_name    text;
  v_role         user_role;
  v_exists       boolean;
BEGIN
  v_institute_id := (new.raw_user_meta_data->>'institute_id')::uuid;
  v_full_name    := coalesce(new.raw_user_meta_data->>'full_name', new.email);
  v_role         := coalesce(
    (new.raw_user_meta_data->>'role')::user_role,
    'trainee'::user_role
  );

  IF v_institute_id IS NULL THEN
    RAISE EXCEPTION 'institute_id is required in signup metadata';
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.institutes WHERE id = v_institute_id AND is_active = true) INTO v_exists;
  IF NOT v_exists THEN
    RAISE EXCEPTION 'Specified institute_id does not exist or is inactive';
  END IF;

  INSERT INTO public.users (
    auth_id, institute_id, email, full_name, role
  ) VALUES (
    new.id, v_institute_id, new.email, v_full_name, v_role
  )
  ON CONFLICT (auth_id) DO NOTHING;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
