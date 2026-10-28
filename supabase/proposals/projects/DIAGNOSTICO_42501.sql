-- SOLO LECTURA. Ejecutar en una consulta nueva del SQL Editor.
-- No modifica cuentas, roles, MFA ni datos. No devuelve credenciales.
WITH cuenta AS (
 SELECT p.email,p.mfa_required,p.mfa_enabled,i.slug AS institucion,
 i.is_active AS institucion_activa,m.is_active AS membresia_activa,r.name::text AS rol,
 (SELECT bool_or(s.is_enabled) FROM public.module_settings s
  WHERE s.institution_id=i.institution_id AND s.module_name='projects') AS proyectos_habilitados,
 (SELECT bool_or(s.is_enabled) FROM public.module_settings s
  WHERE s.institution_id=i.institution_id AND s.module_name='portal') AS portal_habilitado
 FROM public.profiles p
 LEFT JOIN public.institutions i ON i.slug='ue-el-esfuerzo'
 LEFT JOIN public.memberships m ON m.profile_id=p.profile_id AND m.institution_id=i.institution_id
 LEFT JOIN public.roles r ON r.role_id=m.role_id
 WHERE lower(p.email)='midemera@espe.edu.ec'
), funciones AS (
 SELECT p.oid::regprocedure::text AS firma,
 has_function_privilege('authenticated',p.oid,'EXECUTE') AS ejecutable_authenticated,
 p.prosecdef AS security_definer,
 pg_get_functiondef(p.oid) AS definicion
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f'
 AND p.proname IN ('projects_session_verified','project_module_enabled','project_can_manage','project_read')
)
SELECT jsonb_pretty(jsonb_build_object(
 'cuenta',(SELECT coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) FROM cuenta c),
 'funciones',(SELECT coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) FROM funciones f)
)) AS resultado;
