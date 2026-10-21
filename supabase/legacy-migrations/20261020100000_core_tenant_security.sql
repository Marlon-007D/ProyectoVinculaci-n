-- Participante 1: canonical schema from database/script.sql.
-- Apply as postgres after the four existing administrative migrations.
BEGIN;

DO $$
BEGIN
  IF to_regclass('public.memberships') IS NULL
     OR to_regclass('public.institution_memberships') IS NOT NULL
     OR to_regclass('public.tenant_modules') IS NOT NULL THEN
    RAISE EXCEPTION 'Schema differs from this branch. Audit the official schema before applying; do not rename or duplicate tables automatically.';
  END IF;
END;
$$;

-- Existing memberships remain active. Revocation can now be explicit.
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.roles r ON r.role_id = m.role_id
    JOIN public.institutions i ON i.institution_id = m.institution_id
    WHERE m.profile_id = auth.uid() AND m.is_active AND i.is_active
      AND r.name::text = 'super_admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_member_of_institution(target_institution_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.institutions i ON i.institution_id = m.institution_id
    WHERE m.profile_id = auth.uid() AND m.institution_id = target_institution_id
      AND m.is_active AND i.is_active
  );
$$;

CREATE OR REPLACE FUNCTION public.has_institution_role(
  target_institution_id UUID, required_roles public.user_role_type[]
)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.roles r ON r.role_id = m.role_id
    JOIN public.institutions i ON i.institution_id = m.institution_id
    WHERE m.profile_id = auth.uid() AND m.institution_id = target_institution_id
      AND m.is_active AND i.is_active AND r.name = ANY(required_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_read_profile(target_profile_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    target_profile_id = auth.uid() OR public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.memberships mine
      JOIN public.memberships theirs ON theirs.institution_id = mine.institution_id
      JOIN public.institutions i ON i.institution_id = mine.institution_id
      WHERE mine.profile_id = auth.uid() AND theirs.profile_id = target_profile_id
        AND mine.is_active AND theirs.is_active AND i.is_active
    )
  );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin(), public.is_member_of_institution(UUID),
  public.has_institution_role(UUID, public.user_role_type[]), public.can_read_profile(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(), public.is_member_of_institution(UUID),
  public.has_institution_role(UUID, public.user_role_type[]), public.can_read_profile(UUID)
  TO authenticated, service_role;

-- Replace all legacy permissive policies: an old FOR ALL policy would otherwise
-- still widen SELECT, even after dropping only the two known insecure names.
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'memberships', 'institutions', 'module_settings', 'menus')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

-- A parent menu must belong to the same institution. Fail instead of silently
-- deleting or reassigning existing cross-tenant links during deployment.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.menus'::regclass AND conname = 'menus_institution_menu_key') THEN
    ALTER TABLE public.menus ADD CONSTRAINT menus_institution_menu_key UNIQUE (institution_id, menu_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.menus'::regclass AND conname = 'menus_parent_same_institution') THEN
    ALTER TABLE public.menus ADD CONSTRAINT menus_parent_same_institution
      FOREIGN KEY (institution_id, parent_id) REFERENCES public.menus(institution_id, menu_id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.menus'::regclass AND conname = 'menus_no_self_parent') THEN
    ALTER TABLE public.menus ADD CONSTRAINT menus_no_self_parent CHECK (parent_id IS DISTINCT FROM menu_id);
  END IF;
END;
$$;
ALTER TABLE public.menus DROP CONSTRAINT IF EXISTS fk_menus_parent;

REVOKE ALL ON public.profiles, public.memberships, public.institutions,
  public.module_settings, public.menus FROM PUBLIC, anon, authenticated;
-- Revoke historical column-level grants too (table REVOKE does not remove them).
DO $$
DECLARE t TEXT; cols TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['profiles','memberships','institutions','module_settings','menus'] LOOP
    SELECT string_agg(quote_ident(column_name), ', ') INTO cols
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t;
    EXECUTE format('REVOKE SELECT (%s), INSERT (%s), UPDATE (%s), REFERENCES (%s) ON public.%I FROM PUBLIC, anon, authenticated', cols, cols, cols, cols, t);
  END LOOP;
END;
$$;

GRANT SELECT ON public.profiles, public.memberships, public.institutions,
  public.module_settings, public.menus TO authenticated;
GRANT UPDATE (first_name, last_name, phone) ON public.profiles TO authenticated;
CREATE POLICY profiles_scoped_read ON public.profiles FOR SELECT TO authenticated
  USING (public.can_read_profile(profile_id));
CREATE POLICY profiles_own_update ON public.profiles FOR UPDATE TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
-- Membership writes only through the existing validated administrative RPCs.
CREATE POLICY memberships_scoped_read ON public.memberships FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_super_admin()
    OR (is_active AND public.is_member_of_institution(institution_id)));

CREATE POLICY institutions_scoped_read ON public.institutions FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_member_of_institution(institution_id));
GRANT INSERT, UPDATE, DELETE ON public.institutions TO authenticated;
CREATE POLICY institutions_superadmin_insert ON public.institutions FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());
CREATE POLICY institutions_superadmin_update ON public.institutions FOR UPDATE TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());
CREATE POLICY institutions_superadmin_delete ON public.institutions FOR DELETE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY module_settings_scoped_read ON public.module_settings FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_member_of_institution(institution_id));
-- Settings writes remain behind set_institution_module_enabled().

GRANT INSERT, UPDATE, DELETE ON public.menus TO authenticated;
CREATE POLICY menus_scoped_read ON public.menus FOR SELECT TO authenticated
  USING (public.is_super_admin() OR public.is_member_of_institution(institution_id));
CREATE POLICY menus_admin_write ON public.menus FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.user_role_type[]))
  WITH CHECK (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.user_role_type[]));

-- Only public module identifiers, never settings JSON or tenant records.
CREATE OR REPLACE FUNCTION public.get_public_enabled_modules(target_slug TEXT)
RETURNS TABLE (module_name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT ms.module_name::text
  FROM public.module_settings ms
  JOIN public.institutions i ON i.institution_id = ms.institution_id
  WHERE i.slug = target_slug AND i.is_active AND ms.is_enabled
    AND ms.module_name IN ('inicio', 'projects', 'dece', 'simuladores', 'portal')
  ORDER BY ms.module_name;
$$;
REVOKE ALL ON FUNCTION public.get_public_enabled_modules(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_enabled_modules(TEXT) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
