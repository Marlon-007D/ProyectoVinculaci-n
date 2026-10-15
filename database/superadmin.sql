-- Registrar los roles válidos del enum.
-- No agregar "superadmin": el valor correcto es "super_admin".
INSERT INTO public.roles (name, description)
VALUES
  ('super_admin', 'Superadministrador global de la plataforma'),
  ('institution_admin', 'Administrador de institución educativa'),
  ('dece_staff', 'Personal y profesionales del DECE'),
  ('project_manager', 'Gestor de proyectos y presupuestos'),
  ('editor', 'Editor de páginas y contenidos'),
  ('viewer', 'Usuario lector')
ON CONFLICT (name) DO NOTHING;

-- Permisos de la Edge Function (clave service_role solo en el servidor).
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.roles, public.institutions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.memberships, public.profiles TO service_role;

-- MFA solo queda pendiente para una cuenta cuando recibe un rol.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT FALSE;

-- Los perfiles históricos sin teléfono deben poder actualizar su estado MFA.
-- Los números se exigen al crear perfil o al cambiar explícitamente el teléfono.
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_phone_ec_mobile_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_phone_ec_mobile_check
  CHECK (phone IS NULL OR phone ~ '^09[0-9]{8}$') NOT VALID;

CREATE OR REPLACE FUNCTION public.enforce_profile_phone_on_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.phone IS NULL OR NEW.phone !~ '^09[0-9]{8}$' THEN
    RAISE EXCEPTION 'El perfil requiere un celular de 10 dígitos que empiece con 09.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_phone_required_trigger ON public.profiles;
CREATE TRIGGER profiles_phone_required_trigger
BEFORE INSERT OR UPDATE OF phone ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_profile_phone_on_write();

-- Eliminar una posible versión anterior para registrar exactamente
-- los nombres de parámetros que envía la interfaz.
DROP FUNCTION IF EXISTS public.assign_institution_role(TEXT, UUID, UUID);
DROP FUNCTION IF EXISTS public.assign_institution_role(TEXT, UUID, UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.assign_institution_role(TEXT, UUID, UUID, TEXT, TEXT, TEXT);

CREATE FUNCTION public.assign_institution_role(
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
    role_id
  )
  VALUES (
    target_institution_id,
    target_profile_id,
    target_role_id
  )
  ON CONFLICT (institution_id, profile_id)
  DO UPDATE SET role_id = EXCLUDED.role_id;
END;
$$;

-- La app consulta esta marca para mostrar el enrolamiento solo a quien fue asignado.
CREATE OR REPLACE FUNCTION public.own_mfa_enrollment_required()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT p.mfa_required AND NOT p.mfa_enabled
    FROM public.profiles AS p
    WHERE p.profile_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.memberships AS m WHERE m.profile_id = p.profile_id
      )
  ), FALSE);
$$;

REVOKE ALL ON FUNCTION public.own_mfa_enrollment_required() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.own_mfa_enrollment_required() TO authenticated;

CREATE OR REPLACE FUNCTION public.own_mfa_enabled_for_assigned_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((
    SELECT p.mfa_enabled
    FROM public.profiles AS p
    WHERE p.profile_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.memberships AS m WHERE m.profile_id = p.profile_id
      )
  ), FALSE);
$$;

REVOKE ALL ON FUNCTION public.own_mfa_enabled_for_assigned_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.own_mfa_enabled_for_assigned_user() TO authenticated;

-- Solo marca MFA activo si la sesión actual alcanzó AAL2.
CREATE OR REPLACE FUNCTION public.complete_own_mfa_enrollment()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL OR COALESCE(auth.jwt()->>'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'Verifica primero el código de autenticación en dos pasos.'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.memberships WHERE profile_id = auth.uid()) THEN
    RAISE EXCEPTION 'La cuenta todavía no tiene un rol asignado.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
  SET mfa_enabled = TRUE, mfa_required = FALSE
  WHERE profile_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el perfil de la cuenta.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_own_mfa_enrollment() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_own_mfa_enrollment() TO authenticated;

-- Las cuentas que ya tenían un rol completan MFA una vez, salvo que ya esté activo.
UPDATE public.profiles AS p
SET mfa_required = TRUE
WHERE p.mfa_enabled = FALSE
  AND EXISTS (SELECT 1 FROM public.memberships AS m WHERE m.profile_id = p.profile_id);

REVOKE ALL
  ON FUNCTION public.assign_institution_role(TEXT, UUID, UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC;

GRANT EXECUTE
  ON FUNCTION public.assign_institution_role(TEXT, UUID, UUID, TEXT, TEXT, TEXT)
  TO authenticated;

-- Permite quitar una membresía dentro del alcance del administrador actual.
DROP FUNCTION IF EXISTS public.remove_institution_role(UUID, UUID);

CREATE OR REPLACE FUNCTION public.remove_institution_role(
  target_institution_id UUID,
  target_profile_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  target_role_name TEXT;
BEGIN
  IF NOT public.is_super_admin()
     AND NOT public.has_institution_role(
       target_institution_id,
       ARRAY['institution_admin']::public.user_role_type[]
     ) THEN
    RAISE EXCEPTION 'No tienes permisos para quitar roles en esta institución.'
      USING ERRCODE = '42501';
  END IF;

  SELECT r.name::TEXT
    INTO target_role_name
  FROM public.memberships AS m
  JOIN public.roles AS r ON r.role_id = m.role_id
  WHERE m.profile_id = target_profile_id
    AND m.institution_id = target_institution_id;

  IF target_role_name IS NULL THEN
    RAISE EXCEPTION 'No se encontró ese rol en la institución seleccionada.';
  END IF;

  IF target_role_name = 'super_admin' THEN
    RAISE EXCEPTION 'El superadministrador global no se puede quitar desde esta pantalla.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.memberships
  WHERE profile_id = target_profile_id
    AND institution_id = target_institution_id;

END;
$$;

REVOKE ALL ON FUNCTION public.remove_institution_role(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_institution_role(UUID, UUID) TO authenticated;

-- Elimina una institución y todos sus datos asociados (FK con ON DELETE CASCADE).
-- Solo el superadministrador global puede ejecutar esta operación irreversible.
CREATE OR REPLACE FUNCTION public.delete_institution(
  target_institution_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Solo el superadministrador global puede eliminar instituciones.'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.institutions
  WHERE institution_id = target_institution_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La institución seleccionada no existe.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_institution(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_institution(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
