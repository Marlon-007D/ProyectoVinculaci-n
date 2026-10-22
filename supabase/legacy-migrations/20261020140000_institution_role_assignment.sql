-- Match SQL assignment permissions to the invitation endpoint.
BEGIN;
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

  IF NOT public.is_super_admin() AND EXISTS (
    SELECT 1 FROM public.memberships m
    JOIN public.roles r ON r.role_id = m.role_id
    WHERE m.profile_id = target_profile_id
      AND m.institution_id = target_institution_id
      AND r.name::TEXT IN ('super_admin', 'institution_admin')
  ) THEN
    RAISE EXCEPTION 'Solo el superadministrador puede cambiar membresias administrativas.'
      USING ERRCODE = '42501';
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
NOTIFY pgrst, 'reload schema';
COMMIT;
