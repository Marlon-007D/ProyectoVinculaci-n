-- Apply after institutional_registration.sql. Role delegation is enforced server-side.
BEGIN;
ALTER TYPE public.user_role_type ADD VALUE IF NOT EXISTS 'student';
COMMIT;
BEGIN;
INSERT INTO public.roles (name, description) VALUES ('student', 'Estudiante') ON CONFLICT (name) DO NOTHING;
CREATE OR REPLACE FUNCTION public.assign_institution_role(
  target_email TEXT,
  target_institution_id UUID,
  target_role_id UUID,
  target_first_name TEXT,
  target_last_name TEXT,
  target_phone TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_profile_id UUID;
  target_role_name TEXT;
BEGIN
  IF NOT public.is_super_admin()
     AND NOT public.has_institution_role(
       target_institution_id,
       ARRAY['institution_admin']::public.user_role_type[]
     ) THEN
    RAISE EXCEPTION 'No tienes permisos para administrar esta institución.'
      USING ERRCODE = '42501';
  END IF;

  SELECT r.name::TEXT
    INTO target_role_name
  FROM public.roles AS r
  WHERE r.role_id = target_role_id;

  IF public.is_super_admin() AND target_role_name IS DISTINCT FROM 'institution_admin' THEN
    RAISE EXCEPTION 'El superadministrador solo asigna administradores institucionales.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_super_admin() AND target_role_name NOT IN ('dece_staff', 'project_manager', 'editor', 'student', 'dece', 'projects_manager', 'content_editor') THEN
    RAISE EXCEPTION 'Selecciona un rol operativo institucional.' USING ERRCODE = '42501';
  END IF;
  IF target_role_name IS NULL THEN
    RAISE EXCEPTION 'El rol seleccionado no existe.';
  END IF;

  IF target_role_name = 'super_admin' THEN
    RAISE EXCEPTION 'El rol global no se asigna desde este formulario.'
      USING ERRCODE = '42501';
  END IF;

  IF target_role_name = 'institution_admin' AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo el superadministrador global puede asignar administradores institucionales.'
      USING ERRCODE = '42501';
  END IF;

  IF NULLIF(trim(target_first_name), '') IS NULL
     OR NULLIF(trim(target_last_name), '') IS NULL THEN
    RAISE EXCEPTION 'Escribe los nombres y apellidos reales de la persona.';
  END IF;

  IF target_phone IS NULL OR trim(target_phone) !~ '^09[0-9]{8}$' THEN
    RAISE EXCEPTION 'El teléfono debe tener 10 dígitos y empezar con 09.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.institutions AS i
    WHERE i.institution_id = target_institution_id
      AND i.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'La institución no existe o está inactiva.';
  END IF;

  SELECT u.id
    INTO target_profile_id
  FROM auth.users AS u
  WHERE lower(u.email) = lower(trim(target_email));

  IF target_profile_id IS NULL THEN
    RAISE EXCEPTION
      'No existe una cuenta registrada en Authentication con ese correo.';
  END IF;

  PERFORM 1 FROM public.memberships
    WHERE profile_id = target_profile_id AND institution_id = target_institution_id FOR UPDATE;
  IF EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.roles r ON r.role_id = m.role_id
    WHERE m.profile_id = target_profile_id
      AND m.institution_id = target_institution_id
      AND (r.name::TEXT = 'super_admin' OR (r.name::TEXT = 'institution_admin' AND NOT public.is_super_admin()))
  ) THEN
    RAISE EXCEPTION 'Solo el superadministrador puede cambiar membresias administrativas.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_super_admin() AND NOT EXISTS (
    SELECT 1 FROM public.memberships WHERE institution_id = target_institution_id AND profile_id = target_profile_id
  ) THEN
    RAISE EXCEPTION 'La cuenta no pertenece a esta institución.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.profiles AS existing_profile (profile_id, first_name, last_name, email, phone, mfa_required)
  SELECT
    u.id,
    trim(target_first_name),
    trim(target_last_name),
    u.email,
    trim(target_phone),
    TRUE
  FROM auth.users AS u
  WHERE u.id = target_profile_id
  ON CONFLICT (profile_id)
  DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    mfa_required = NOT existing_profile.mfa_enabled;

  INSERT INTO public.memberships (
    institution_id,
    profile_id,
    role_id,
    is_active
  )
  VALUES (
    target_institution_id,
    target_profile_id,
    target_role_id,
    TRUE
  )
  ON CONFLICT (institution_id, profile_id)
  DO UPDATE SET role_id = EXCLUDED.role_id, is_active = TRUE;
END;
$$;
REVOKE ALL ON FUNCTION public.assign_institution_role(TEXT, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_institution_role(TEXT, UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT SELECT ON public.roles TO authenticated;

-- Separate management lookup: no caller-supplied tenant can widen the result.
DO $$
DECLARE legacy_function regprocedure;
BEGIN
  FOR legacy_function IN SELECT p.oid::regprocedure FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'list_accessible_institution_memberships'
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', legacy_function);
  END LOOP;
END;
$$;
CREATE OR REPLACE FUNCTION public.list_managed_memberships(target_institution_id UUID DEFAULT NULL)
RETURNS TABLE (profile_id UUID, institution_id UUID, email TEXT, first_name TEXT, last_name TEXT,
  role_name TEXT, institution_name TEXT, mfa_enabled BOOLEAN, mfa_required BOOLEAN, is_active BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT p.profile_id, m.institution_id, p.email::text, p.first_name::text, p.last_name::text,
    r.name::text, i.name::text, coalesce(p.mfa_enabled, false), coalesce(p.mfa_required, false), m.is_active
  FROM public.memberships m JOIN public.profiles p USING (profile_id)
  JOIN public.roles r USING (role_id) JOIN public.institutions i USING (institution_id)
  WHERE auth.uid() IS NOT NULL AND i.is_active
    AND (target_institution_id IS NULL OR m.institution_id = target_institution_id)
    AND CASE WHEN public.is_super_admin() THEN r.name::text = 'institution_admin'
      ELSE m.institution_id = target_institution_id AND r.name::text <> 'super_admin'
        AND public.has_institution_role(m.institution_id, ARRAY['institution_admin']::public.user_role_type[])
      END
  ORDER BY p.first_name, p.last_name;
$$;
REVOKE ALL ON FUNCTION public.list_managed_memberships(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_managed_memberships(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_institution_member(target_profile_id UUID, target_institution_id UUID, target_role_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE selected_role TEXT; previous_role TEXT;
BEGIN
  IF public.is_super_admin() OR NOT public.has_institution_role(target_institution_id, ARRAY['institution_admin']::public.user_role_type[]) THEN
    RAISE EXCEPTION 'Solo el administrador del plantel puede aprobar sus miembros.' USING ERRCODE = '42501';
  END IF;
  SELECT r.name::text INTO selected_role FROM public.roles r WHERE r.role_id = target_role_id;
  IF selected_role IS NULL OR selected_role NOT IN ('dece_staff', 'project_manager', 'editor', 'student', 'dece', 'projects_manager', 'content_editor') THEN
    RAISE EXCEPTION 'Selecciona un rol operativo institucional.' USING ERRCODE = '42501';
  END IF;
  SELECT r.name::text INTO previous_role FROM public.memberships m JOIN public.roles r USING (role_id)
    WHERE m.profile_id = target_profile_id AND m.institution_id = target_institution_id FOR UPDATE OF m;
  IF previous_role IS NULL OR previous_role IN ('super_admin', 'institution_admin') THEN
    RAISE EXCEPTION 'No se puede modificar esta membresía.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.memberships SET role_id = target_role_id, is_active = TRUE
    WHERE profile_id = target_profile_id AND institution_id = target_institution_id;
  UPDATE public.profiles SET mfa_required = NOT coalesce(mfa_enabled, false) WHERE profile_id = target_profile_id;
END;
$$;
REVOKE ALL ON FUNCTION public.approve_institution_member(UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_institution_member(UUID, UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_institution_role(target_institution_id UUID, target_profile_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE previous_role TEXT; pending_role UUID;
BEGIN
  IF NOT public.is_super_admin() AND NOT public.has_institution_role(target_institution_id, ARRAY['institution_admin']::public.user_role_type[]) THEN
    RAISE EXCEPTION 'No tienes permisos para modificar esta institución.' USING ERRCODE = '42501';
  END IF;
  SELECT r.name::text INTO previous_role FROM public.memberships m JOIN public.roles r USING (role_id)
    WHERE m.profile_id = target_profile_id AND m.institution_id = target_institution_id FOR UPDATE OF m;
  IF previous_role IS NULL OR previous_role = 'super_admin'
    OR (public.is_super_admin() AND previous_role <> 'institution_admin')
    OR (NOT public.is_super_admin() AND previous_role = 'institution_admin') THEN
    RAISE EXCEPTION 'No tienes permisos para retirar este rol.' USING ERRCODE = '42501';
  END IF;
  SELECT role_id INTO pending_role FROM public.roles WHERE name::text = 'viewer';
  IF pending_role IS NULL THEN RAISE EXCEPTION 'No se pudo preparar la membresía pendiente.'; END IF;
  UPDATE public.memberships SET role_id = pending_role, is_active = FALSE
    WHERE profile_id = target_profile_id AND institution_id = target_institution_id;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_institution_role(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_institution_role(UUID, UUID) TO authenticated;

-- This returns only the signed-in person's pending institutions, never private data.
CREATE OR REPLACE FUNCTION public.own_pending_institutions()
RETURNS TABLE (institution_id UUID, name TEXT, slug TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT i.institution_id, i.name::text, i.slug::text
  FROM public.memberships m JOIN public.institutions i USING (institution_id) JOIN public.roles r USING (role_id)
  WHERE m.profile_id = auth.uid() AND NOT m.is_active AND i.is_active
    AND r.name::text IN ('invitado', 'viewer', 'guest', 'pending');
$$;
REVOKE ALL ON FUNCTION public.own_pending_institutions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.own_pending_institutions() TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
