-- Apply after 012. Student defaults are restricted to enabled institutional modules.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_tenant_default_modules(role_name text) RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE public.admin_tenant_role_name(role_name)
 WHEN 'student' THEN ARRAY['inicio','projects','simuladores']
 WHEN 'dece' THEN ARRAY['dece'] WHEN 'projects_manager' THEN ARRAY['projects']
 WHEN 'content_editor' THEN ARRAY['portal'] ELSE ARRAY[]::text[] END;
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_default_modules(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_default_modules(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_tenant_sync_role_module() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.admin_tenant_member_modules(institution_id,profile_id,module_name)
 SELECT m.institution_id,m.profile_id,s.module_name FROM public.memberships m
 JOIN public.roles r ON r.role_id=m.role_id JOIN public.institutions i ON i.institution_id=m.institution_id AND i.is_active
 JOIN public.module_settings s ON s.institution_id=m.institution_id AND s.is_enabled AND s.module_name=ANY(public.admin_tenant_default_modules(r.name::text))
 WHERE m.institution_id=NEW.institution_id AND m.profile_id=NEW.profile_id
 AND (m.is_active OR EXISTS(SELECT 1 FROM public.admin_tenant_invitations v WHERE v.institution_id=m.institution_id AND v.profile_id=m.profile_id AND v.accepted_at IS NULL))
 ON CONFLICT DO NOTHING;
 RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_sync_role_module() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS admin_tenant_sync_role_module ON public.memberships;
-- Deferred until all role/grant writes finish: assign_role replaces grants later
-- in the same transaction, so an immediate membership trigger loses its insert.
CREATE CONSTRAINT TRIGGER admin_tenant_sync_role_module AFTER INSERT OR UPDATE ON public.memberships
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.admin_tenant_sync_role_module();

INSERT INTO public.admin_tenant_member_modules(institution_id,profile_id,module_name)
 SELECT m.institution_id,m.profile_id,s.module_name FROM public.memberships m
 JOIN public.roles r ON r.role_id=m.role_id JOIN public.institutions i ON i.institution_id=m.institution_id AND i.is_active
 JOIN public.module_settings s ON s.institution_id=m.institution_id AND s.is_enabled AND s.module_name=ANY(public.admin_tenant_default_modules(r.name::text))
 WHERE m.is_active OR EXISTS(SELECT 1 FROM public.admin_tenant_invitations v WHERE v.institution_id=m.institution_id AND v.profile_id=m.profile_id AND v.accepted_at IS NULL)
 ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_tenant_own_module_grants() RETURNS TABLE(institution_id uuid,module_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT g.institution_id,g.module_name FROM public.admin_tenant_member_modules g
 JOIN public.module_settings s ON s.institution_id=g.institution_id AND s.module_name=g.module_name AND s.is_enabled
 WHERE g.profile_id=auth.uid() AND public.admin_tenant_actor_role(g.institution_id) IS NOT NULL
 UNION
 SELECT m.institution_id,s.module_name FROM public.memberships m
 JOIN public.roles r ON r.role_id=m.role_id JOIN public.institutions i ON i.institution_id=m.institution_id AND i.is_active
 JOIN public.module_settings s ON s.institution_id=m.institution_id AND s.is_enabled AND s.module_name=ANY(public.admin_tenant_default_modules(r.name::text))
 WHERE m.profile_id=auth.uid() AND m.is_active;
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_own_module_grants() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_own_module_grants() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_tenant_snapshot_v4(target_institution_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE snapshot jsonb := public.admin_tenant_snapshot_v3(target_institution_id);
BEGIN
 RETURN jsonb_set(snapshot,'{members}',COALESCE((SELECT jsonb_agg(member || jsonb_build_object('modules',
  COALESCE((SELECT jsonb_agg(module_name ORDER BY module_name) FROM (
   SELECT DISTINCT g.module_name FROM public.admin_tenant_member_modules g
   JOIN public.module_settings s ON s.institution_id=g.institution_id AND s.module_name=g.module_name AND s.is_enabled
   WHERE g.institution_id=target_institution_id AND g.profile_id=(member->>'profile_id')::uuid
  ) enabled),'[]'::jsonb))) FROM jsonb_array_elements(snapshot->'members') member),'[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_snapshot_v4(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_snapshot_v4(uuid) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_tenant_own_invitation(target_institution_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('pending',true,'requires_password',
      (COALESCE(u.raw_app_meta_data ? 'admin_tenant_invitation',false) AND COALESCE(u.raw_user_meta_data->>'admin_tenant_onboarding','false')='true'), 'profile',v.details,'email',u.email,'membership',
    jsonb_build_object('institution_id',m.institution_id,'is_active',m.is_active,'roles',jsonb_build_object('name',r.name::text),'institutions',jsonb_build_object('slug',i.slug,'name',i.name)))
  FROM public.admin_tenant_invitations v
  JOIN auth.users u ON u.id=v.profile_id
  JOIN public.memberships m ON m.profile_id=v.profile_id AND m.institution_id=v.institution_id AND m.role_id=v.role_id
  JOIN public.roles r ON r.role_id=v.role_id JOIN public.institutions i ON i.institution_id=v.institution_id
  WHERE v.profile_id=auth.uid() AND v.institution_id=target_institution_id AND v.accepted_at IS NULL
    AND NOT m.is_active AND i.is_active AND u.email_confirmed_at IS NOT NULL;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
