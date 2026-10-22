-- Manual rollback snapshot from the shared project before 20261020130000/140000.
-- Removes institutional-admin DECE access; does not undo membership changes made later.
BEGIN;
DROP POLICY IF EXISTS dylan_dece_students_access ON public.students;
DROP POLICY IF EXISTS dylan_dece_cases_access ON public.dece_cases;
CREATE OR REPLACE FUNCTION public.can_access_dece_case(target_case_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.dece_cases dc
     where dc.dece_case_id = target_case_id
       and public.has_institution_role(dc.institution_id, array['dece_staff']::public.user_role_type[])
  );
$function$
;
CREATE OR REPLACE FUNCTION public.dece_has_institution_access(target_institution uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select public.has_institution_role(target_institution, array['dece_staff']::public.user_role_type[]);
$function$
;
CREATE OR REPLACE FUNCTION public.assign_institution_role(target_email text, target_institution_id uuid, target_role_id uuid, target_first_name text, target_last_name text, target_phone text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  target_profile_id UUID;
  target_role_name TEXT;
BEGIN
  IF NOT public.is_super_admin()
     AND NOT public.has_institution_role(
       target_institution_id,
       ARRAY['institution_admin']::public.user_role_type[]
     ) THEN
    RAISE EXCEPTION 'No tienes permisos para administrar esta institución.' USING ERRCODE = '42501';
  END IF;

  SELECT r.name::TEXT INTO target_role_name
  FROM public.roles AS r WHERE r.role_id = target_role_id;
  IF target_role_name IS NULL THEN RAISE EXCEPTION 'El rol seleccionado no existe.'; END IF;
  IF target_role_name = 'super_admin' THEN
    RAISE EXCEPTION 'El rol global no se asigna desde este formulario.' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(trim(target_first_name), '') IS NULL OR NULLIF(trim(target_last_name), '') IS NULL THEN
    RAISE EXCEPTION 'Escribe los nombres y apellidos reales de la persona.';
  END IF;
  IF target_phone IS NULL OR trim(target_phone) !~ '^09[0-9]{8}$' THEN
    RAISE EXCEPTION 'El teléfono debe tener 10 dígitos y empezar con 09.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.institutions AS i
    WHERE i.institution_id = target_institution_id AND i.is_active = TRUE
  ) THEN
    RAISE EXCEPTION 'La institución no existe o está inactiva.';
  END IF;

  SELECT u.id INTO target_profile_id
  FROM auth.users AS u WHERE lower(u.email) = lower(trim(target_email));
  IF target_profile_id IS NULL THEN
    RAISE EXCEPTION 'No existe una cuenta registrada en Authentication con ese correo.';
  END IF;

  INSERT INTO public.profiles AS existing_profile
    (profile_id, first_name, last_name, email, phone, mfa_required)
  SELECT u.id, trim(target_first_name), trim(target_last_name), u.email, trim(target_phone), TRUE
  FROM auth.users AS u WHERE u.id = target_profile_id
  ON CONFLICT (profile_id) DO UPDATE SET
    email = EXCLUDED.email,
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    phone = EXCLUDED.phone,
    mfa_required = NOT existing_profile.mfa_enabled;

  INSERT INTO public.memberships (institution_id, profile_id, role_id)
  VALUES (target_institution_id, target_profile_id, target_role_id)
  ON CONFLICT (institution_id, profile_id) DO UPDATE SET role_id = EXCLUDED.role_id;
END;
$function$
;
NOTIFY pgrst, 'reload schema';
COMMIT;
