-- Apply separately after reviewing the shared Auth schema. No client write grants.
BEGIN;
ALTER TYPE public.user_role_type ADD VALUE IF NOT EXISTS 'invitado';
COMMIT;
BEGIN;
INSERT INTO public.roles (name, description) VALUES ('invitado', 'Solicitud pendiente') ON CONFLICT (name) DO NOTHING;
-- Keep the public lifecycle explicit while preserving existing is_active-based RLS.
ALTER TABLE public.memberships ADD COLUMN IF NOT EXISTS status TEXT
  GENERATED ALWAYS AS (CASE WHEN is_active THEN 'active'::text ELSE 'pending'::text END) STORED;

-- Only this explicitly public catalog can be read before authentication.
CREATE OR REPLACE FUNCTION public.registration_institutions()
RETURNS TABLE (institution_id UUID, name TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT i.institution_id, i.name::text
  FROM public.institutions i WHERE i.is_active ORDER BY i.name;
$$;
REVOKE ALL ON FUNCTION public.registration_institutions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registration_institutions() TO anon, authenticated;

-- Self-registration has no phone field. Administrative assignment still checks
-- the phone in assign_institution_role; provided numbers must remain valid.
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.enforce_profile_phone_on_write()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = ''
AS $$
BEGIN
  IF NEW.phone IS NOT NULL AND NEW.phone !~ '^09[0-9]{8}$' THEN
    RAISE EXCEPTION 'Ingresa un celular ecuatoriano válido de 10 dígitos.';
  END IF;
  RETURN NEW;
END;
$$;

-- The selected institution is a request, never an authorization claim.
-- Provisioning failures roll back the Auth account, profile and membership together.
CREATE OR REPLACE FUNCTION public.handle_new_auth_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  target_institution UUID;
  reader_role UUID;
  requested_role TEXT;
BEGIN
  requested_role := coalesce(NEW.raw_user_meta_data->>'role', 'guest');
  -- Metadata never authorizes an internal role, even if supplied by a caller.
  IF requested_role NOT IN ('guest', 'pending', 'viewer', 'invitado') THEN
    requested_role := 'guest';
  END IF;
  IF coalesce(NEW.raw_user_meta_data->>'institution_id', NEW.raw_user_meta_data->>'registration_institution_id') IS NULL THEN
    -- Invitations without an institution still need a basic profile.
    INSERT INTO public.profiles (profile_id, first_name, last_name, email)
    VALUES (NEW.id, left(trim(coalesce(NEW.raw_user_meta_data->>'first_name', '')), 100),
      left(trim(coalesce(NEW.raw_user_meta_data->>'last_name', '')), 100), NEW.email)
    ON CONFLICT (profile_id) DO NOTHING;
    RETURN NEW;
  END IF;
  target_institution := coalesce(NEW.raw_user_meta_data->>'institution_id', NEW.raw_user_meta_data->>'registration_institution_id')::uuid;
  PERFORM 1 FROM public.institutions WHERE institution_id = target_institution AND is_active FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'La unidad educativa no está disponible para el registro.'; END IF;
  IF length(trim(coalesce(NEW.raw_user_meta_data->>'first_name', ''))) NOT BETWEEN 1 AND 100
     OR length(trim(coalesce(NEW.raw_user_meta_data->>'last_name', ''))) NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Ingresa tus nombres y apellidos.';
  END IF;
  SELECT role_id INTO reader_role FROM public.roles WHERE name::text = 'invitado'
    ORDER BY CASE WHEN name::text = requested_role THEN 0 WHEN name::text = 'guest' THEN 1 WHEN name::text = 'pending' THEN 2 ELSE 3 END
    LIMIT 1;
  IF reader_role IS NULL THEN RAISE EXCEPTION 'No se pudo preparar la membresía institucional.'; END IF;

  INSERT INTO public.profiles (profile_id, first_name, last_name, email)
  VALUES (NEW.id, trim(NEW.raw_user_meta_data->>'first_name'), trim(NEW.raw_user_meta_data->>'last_name'), NEW.email)
  ON CONFLICT (profile_id) DO NOTHING;
  INSERT INTO public.memberships (institution_id, profile_id, role_id, is_active)
  VALUES (target_institution, NEW.id, reader_role, FALSE)
  ON CONFLICT (institution_id, profile_id) DO NOTHING;
  RETURN NEW;
END;
$$;
ALTER FUNCTION public.handle_new_auth_profile() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.handle_new_auth_profile() FROM PUBLIC, anon, authenticated;
-- Replace only account-provisioning triggers. Keep unrelated Auth integrations.
DO $cleanup$
DECLARE existing_trigger RECORD;
BEGIN
  FOR existing_trigger IN
    SELECT t.tgname FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE t.tgrelid = 'auth.users'::regclass AND NOT t.tgisinternal
      AND ((n.nspname = 'public' AND p.proname IN ('handle_new_auth_profile', 'handle_new_user', 'on_auth_user_created', 'create_pending_registration'))
        OR t.tgname IN ('on_auth_user_created', 'zz_institutional_registration'))
  LOOP
    EXECUTE format('DROP TRIGGER %I ON auth.users', existing_trigger.tgname);
  END LOOP;
END;
$cleanup$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_profile();

NOTIFY pgrst, 'reload schema';
COMMIT;
