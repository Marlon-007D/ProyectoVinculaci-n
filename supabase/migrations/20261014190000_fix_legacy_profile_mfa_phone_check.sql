-- Corrige el bloqueo de MFA en perfiles antiguos cuyo teléfono todavía es NULL.
-- La asignación de rol sigue exigiendo el celular, pero cambiar mfa_enabled o
-- mfa_required no modifica phone y debe funcionar para usuarios históricos.
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
