-- Compatibilidad con los roles y membresías de arquitectura-admin.
-- Propuesta para integración: ejecutar primero en una base local de pruebas.
-- Requiere memberships.is_active del esquema compartido; no cambia Auth ni MFA.
BEGIN;
CREATE OR REPLACE FUNCTION public.project_can_manage(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.projects_session_verified() AND public.project_module_enabled(target) AND
 (public.is_super_admin() OR EXISTS(SELECT 1 FROM public.memberships m JOIN public.roles r USING(role_id)
 WHERE m.profile_id=auth.uid() AND m.institution_id=target AND m.is_active
 AND r.name::text IN ('institution_admin','project_manager','projects_manager')));
$$;
CREATE OR REPLACE FUNCTION public.project_can_publish(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.project_can_manage(target) AND (public.is_super_admin() OR EXISTS(
 SELECT 1 FROM public.memberships m JOIN public.roles r USING(role_id)
 WHERE m.profile_id=auth.uid() AND m.institution_id=target AND m.is_active AND r.name='institution_admin'));
$$;
CREATE OR REPLACE FUNCTION public.portal_editor_allowed(target uuid, publishing boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.projects_session_verified() AND EXISTS(SELECT 1 FROM public.institutions i
 JOIN public.module_settings m USING(institution_id) WHERE i.institution_id=target AND i.is_active
 AND m.module_name='portal' AND m.is_enabled) AND (public.is_super_admin() OR EXISTS(
 SELECT 1 FROM public.memberships m JOIN public.roles r USING(role_id) WHERE m.profile_id=auth.uid()
 AND m.institution_id=target AND m.is_active
 AND (r.name='institution_admin' OR (NOT publishing AND r.name::text IN ('editor','content_editor')))));
$$;
CREATE OR REPLACE FUNCTION public.project_member_options(target_institution uuid)
RETURNS TABLE(profile_id uuid,full_name text,email varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p.profile_id,concat_ws(' ',p.first_name,p.last_name),p.email FROM public.profiles p
 JOIN public.memberships m USING(profile_id) WHERE m.institution_id=target_institution AND m.is_active
 AND public.project_can_manage(target_institution) ORDER BY p.first_name,p.last_name;
$$;
REVOKE ALL ON FUNCTION public.project_can_manage(uuid), public.project_can_publish(uuid),
 public.portal_editor_allowed(uuid,boolean), public.project_member_options(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_can_manage(uuid), public.project_can_publish(uuid),
 public.portal_editor_allowed(uuid,boolean), public.project_member_options(uuid) TO authenticated;
COMMIT;
