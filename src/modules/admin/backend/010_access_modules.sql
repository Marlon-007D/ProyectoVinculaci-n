-- Apply after 009. No changes to existing grants or memberships during installation.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_tenant_update_access(
 target_institution_id uuid,target_email text,target_role_id uuid,target_first_name text,
 target_last_name text,target_phone text,target_modules text[] DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE recipient uuid;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(target_institution_id::text));
 SELECT u.id INTO recipient FROM auth.users u JOIN public.memberships m ON m.profile_id=u.id
 WHERE lower(u.email)=lower(trim(target_email)) AND m.institution_id=target_institution_id AND m.is_active;
 IF recipient IS NULL THEN RAISE EXCEPTION 'No hay una membresía activa para editar.' USING ERRCODE='42501'; END IF;
 PERFORM public.admin_tenant_assign_role(target_institution_id,target_email,target_role_id,target_first_name,target_last_name,target_phone,target_modules);
 INSERT INTO public.admin_tenant_member_modules(institution_id,profile_id,module_name)
 SELECT target_institution_id,recipient,chosen FROM (SELECT DISTINCT unnest(COALESCE(target_modules,'{}')) chosen) modules
 ON CONFLICT DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_update_access(uuid,text,uuid,text,text,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_update_access(uuid,text,uuid,text,text,text,text[]) TO authenticated;

-- Active registration recipients also need verified, institution-specific contact
-- data when an Auth invite email opens the password completion screen.
CREATE OR REPLACE FUNCTION public.admin_tenant_own_account(target_institution_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT jsonb_build_object('pending',false,'email',u.email,'profile',jsonb_build_object(
 'first_name',COALESCE(q.first_name,p.first_name,''),'last_name',COALESCE(q.last_name,p.last_name,''),
 'phone',COALESCE(q.phone,p.phone,'')),'membership',jsonb_build_object('institution_id',m.institution_id,
 'is_active',m.is_active,'roles',jsonb_build_object('name',r.name::text),
 'institutions',jsonb_build_object('slug',i.slug,'name',i.name)))
 FROM public.memberships m JOIN auth.users u ON u.id=m.profile_id
 JOIN public.roles r ON r.role_id=m.role_id JOIN public.institutions i ON i.institution_id=m.institution_id
 LEFT JOIN public.profiles p ON p.profile_id=m.profile_id
 LEFT JOIN public.admin_membership_requests q ON q.profile_id=m.profile_id AND q.institution_id=m.institution_id AND q.status='approved'
 WHERE m.institution_id=target_institution_id AND m.profile_id=auth.uid() AND m.is_active AND i.is_active
 AND u.email_confirmed_at IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_own_account(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_own_account(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
