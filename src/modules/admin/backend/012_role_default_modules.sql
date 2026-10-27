-- Apply after 011. Defaults never enable a disabled institutional module.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_tenant_default_module(role_name text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
 SELECT CASE public.admin_tenant_role_name(role_name)
 WHEN 'dece' THEN 'dece' WHEN 'projects_manager' THEN 'projects' WHEN 'content_editor' THEN 'portal' ELSE NULL END;
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_default_module(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_default_module(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_tenant_sync_role_module() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.admin_tenant_member_modules(institution_id,profile_id,module_name)
 SELECT m.institution_id,m.profile_id,s.module_name FROM public.memberships m
 JOIN public.roles r ON r.role_id=m.role_id JOIN public.institutions i ON i.institution_id=m.institution_id AND i.is_active
 JOIN public.module_settings s ON s.institution_id=m.institution_id AND s.is_enabled AND s.module_name=public.admin_tenant_default_module(r.name::text)
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
 JOIN public.module_settings s ON s.institution_id=m.institution_id AND s.is_enabled AND s.module_name=public.admin_tenant_default_module(r.name::text)
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
 JOIN public.module_settings s ON s.institution_id=m.institution_id AND s.is_enabled AND s.module_name=public.admin_tenant_default_module(r.name::text)
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
NOTIFY pgrst,'reload schema';
COMMIT;
