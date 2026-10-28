-- EXCEPCIÓN PERSISTENTE DE PRUEBAS, solicitada para midemera@espe.edu.ec.
-- No es una migración general: no incluir en APLICAR_CRUD_LOGICO ni desplegar al equipo.
-- Mientras exista el trigger, los cambios administrativos de indicadores MFA se
-- mantienen en false SOLO para el UUID de esta cuenta y las cuatro instituciones revisadas.
-- No elimina factores de Auth ni cambia contraseñas, roles o módulos.
-- Retirar con RETIRAR_EXCEPCION_MFA_CUENTA_PRUEBA.sql para volver a exigir MFA.
BEGIN;
CREATE OR REPLACE FUNCTION public.projects_test_account_mfa_exception()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF NEW.profile_id=TG_ARGV[0]::uuid
 AND lower(NEW.email)='midemera@espe.edu.ec'
 AND EXISTS (
   SELECT 1 FROM public.memberships m JOIN public.institutions i USING(institution_id)
   JOIN public.roles r USING(role_id)
   WHERE m.profile_id=NEW.profile_id AND i.institution_id=ANY(TG_ARGV[1]::uuid[])
     AND i.slug='ue-el-esfuerzo' AND i.is_active AND m.is_active
     AND r.name::text='institution_admin'
 ) AND NOT EXISTS (
   SELECT 1 FROM public.memberships m JOIN public.roles r USING(role_id)
   WHERE m.profile_id=NEW.profile_id AND m.is_active
   AND (NOT (m.institution_id=ANY(TG_ARGV[1]::uuid[])) OR r.name::text<>'institution_admin')
 ) THEN
   NEW.mfa_required:=false;
   NEW.mfa_enabled:=false;
 END IF;
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.projects_test_account_mfa_exception() FROM PUBLIC,anon,authenticated;
DO $$
DECLARE target_profile uuid; target_institution uuid; allowed_institutions uuid[];
BEGIN
 SELECT p.profile_id INTO STRICT target_profile FROM public.profiles p
 WHERE lower(p.email)='midemera@espe.edu.ec';
 SELECT i.institution_id INTO STRICT target_institution
 FROM public.memberships m JOIN public.institutions i USING(institution_id)
 JOIN public.roles r USING(role_id)
 WHERE m.profile_id=target_profile AND i.slug='ue-el-esfuerzo'
 AND i.is_active AND m.is_active AND r.name::text='institution_admin';
 SELECT array_agg(institution_id) INTO allowed_institutions FROM public.institutions
 WHERE slug IN ('ue-el-esfuerzo','ue-la-concordia','ue-luz-de-america','ue-puerto-limon');
 IF cardinality(allowed_institutions) IS DISTINCT FROM 4 THEN
   RAISE EXCEPTION 'No se encontraron las cuatro instituciones revisadas.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.memberships m JOIN public.roles r USING(role_id)
 WHERE m.profile_id=target_profile AND m.is_active
 AND (NOT (m.institution_id=ANY(allowed_institutions)) OR r.name::text<>'institution_admin')) THEN
   RAISE EXCEPTION 'La cuenta tiene accesos distintos de los cuatro administradores revisados. No se aplicó la excepción de pruebas.';
 END IF;
 DROP TRIGGER IF EXISTS zz_projects_test_account_mfa_exception ON public.profiles;
 EXECUTE format('CREATE TRIGGER zz_projects_test_account_mfa_exception BEFORE UPDATE OF mfa_required,mfa_enabled ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.projects_test_account_mfa_exception(%L,%L)',target_profile::text,allowed_institutions::text);
 UPDATE public.profiles SET mfa_enabled=false,mfa_required=false WHERE profile_id=target_profile;
END $$;
SELECT email,mfa_required,mfa_enabled,
 EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.profiles'::regclass
 AND tgname='zz_projects_test_account_mfa_exception' AND tgenabled='O') AS excepcion_de_pruebas_instalada
FROM public.profiles WHERE lower(email)='midemera@espe.edu.ec';
COMMIT;
