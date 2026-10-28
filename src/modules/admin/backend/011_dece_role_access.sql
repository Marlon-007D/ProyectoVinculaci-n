-- Local migration: apply after 010 to align the verified DECE role and its module.
BEGIN;
INSERT INTO public.admin_tenant_member_modules(institution_id,profile_id,module_name)
 SELECT m.institution_id,m.profile_id,'dece'
 FROM public.memberships m JOIN public.roles r ON r.role_id=m.role_id
 JOIN public.institutions i ON i.institution_id=m.institution_id
 JOIN public.module_settings s ON s.institution_id=m.institution_id AND s.module_name='dece' AND s.is_enabled
 WHERE m.is_active AND i.is_active AND public.admin_tenant_role_name(r.name::text)='dece'
 ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.admin_tenant_own_module_grants() RETURNS TABLE(institution_id uuid,module_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT g.institution_id,g.module_name FROM public.admin_tenant_member_modules g
 WHERE g.profile_id=auth.uid() AND public.admin_tenant_actor_role(g.institution_id) IS NOT NULL
 UNION
 SELECT m.institution_id,'dece'::text FROM public.memberships m
 JOIN public.roles r ON r.role_id=m.role_id JOIN public.institutions i ON i.institution_id=m.institution_id
 JOIN public.module_settings s ON s.institution_id=m.institution_id AND s.module_name='dece' AND s.is_enabled
 WHERE m.profile_id=auth.uid() AND m.is_active AND i.is_active AND public.admin_tenant_role_name(r.name::text)='dece';
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_own_module_grants() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_own_module_grants() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
