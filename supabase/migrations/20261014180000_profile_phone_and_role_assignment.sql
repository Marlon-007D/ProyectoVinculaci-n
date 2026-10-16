-- Teléfonos celulares ecuatorianos: 10 dígitos, formato 09XXXXXXXX.
-- NOT VALID conserva filas históricas para que puedan completar su número real,
-- Se exige teléfono en asignación de rol, pero se dejan actualizar datos de MFA
-- en perfiles históricos que todavía no tienen número.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone VARCHAR(10);

UPDATE public.profiles AS p
SET phone = u.raw_user_meta_data->>'phone'
FROM auth.users AS u
WHERE u.id = p.profile_id
  AND p.phone IS NULL
  AND COALESCE(u.raw_user_meta_data->>'phone', '') ~ '^09[0-9]{8}$';

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

CREATE OR REPLACE FUNCTION public.handle_new_auth_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  metadata_phone TEXT := NEW.raw_user_meta_data->>'phone';
  metadata_first_name TEXT := NEW.raw_user_meta_data->>'first_name';
  metadata_last_name TEXT := NEW.raw_user_meta_data->>'last_name';
BEGIN
  -- Las cuentas creadas manualmente sin perfil se completan al asignarles un rol.
  IF NULLIF(trim(metadata_first_name), '') IS NULL
     OR NULLIF(trim(metadata_last_name), '') IS NULL
     OR COALESCE(metadata_phone, '') !~ '^09[0-9]{8}$' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.profiles (profile_id, first_name, last_name, email, phone)
  VALUES (NEW.id, trim(metadata_first_name), trim(metadata_last_name), NEW.email, metadata_phone)
  ON CONFLICT (profile_id) DO UPDATE
    SET first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        email = EXCLUDED.email,
        phone = EXCLUDED.phone;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
CREATE TRIGGER on_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_profile();

-- El rol nunca completa apellidos con etiquetas institucionales; requiere datos
-- personales explícitos y guarda el teléfono validado en el perfil.
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
$$;

REVOKE ALL ON FUNCTION public.assign_institution_role(TEXT, UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_institution_role(TEXT, UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

COMMENT ON COLUMN public.profiles.phone IS
  'Celular ecuatoriano obligatorio para perfiles nuevos: 10 dígitos con formato 09XXXXXXXX.';
