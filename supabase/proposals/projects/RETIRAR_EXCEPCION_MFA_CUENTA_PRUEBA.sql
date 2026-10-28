-- Retira únicamente la excepción persistente y vuelve a exigir MFA a su UUID.
-- Ejecutar cuando termine la prueba o se quiera configurar el autenticador.
BEGIN;
DO $$
DECLARE target_profile uuid;
BEGIN
 SELECT split_part(encode(tgargs,'escape'),E'\\000',1)::uuid INTO target_profile
 FROM pg_trigger WHERE tgrelid='public.profiles'::regclass
 AND tgname='zz_projects_test_account_mfa_exception';
 DROP TRIGGER IF EXISTS zz_projects_test_account_mfa_exception ON public.profiles;
 IF target_profile IS NOT NULL THEN
   UPDATE public.profiles SET mfa_required=true WHERE profile_id=target_profile;
 END IF;
END $$;
DROP FUNCTION IF EXISTS public.projects_test_account_mfa_exception();
COMMIT;
