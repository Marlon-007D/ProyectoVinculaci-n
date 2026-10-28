-- Apply after 006_pending_invitations.sql. Installation does not change memberships.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_tenant_invitation_recipient(
  target_institution_id uuid,target_email text,target_role_id uuid
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE recipient uuid; confirmed boolean; existing_role text;
BEGIN
  IF NOT public.admin_tenant_can_assign(target_institution_id,(SELECT name::text FROM public.roles WHERE role_id=target_role_id)) THEN
    RAISE EXCEPTION 'No puedes invitar este rol en esta institución.' USING ERRCODE='42501'; END IF;
  SELECT id,email_confirmed_at IS NOT NULL INTO recipient,confirmed FROM auth.users WHERE lower(email)=lower(trim(target_email));
  IF recipient IS NULL THEN RETURN NULL; END IF;
  SELECT public.admin_tenant_role_name(r.name::text) INTO existing_role FROM public.memberships m JOIN public.roles r ON r.role_id=m.role_id
    WHERE m.institution_id=target_institution_id AND m.profile_id=recipient;
  IF recipient=auth.uid() OR existing_role='super_admin' OR (existing_role='institution_admin' AND public.admin_tenant_actor_role(target_institution_id)<>'super_admin') THEN
    RAISE EXCEPTION 'No puedes modificar esta cuenta protegida.' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('profile_id',recipient,'confirmed',confirmed);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_tenant_prepare_invitation(
  target_institution_id uuid,target_email text,target_role_id uuid,
  target_first_name text,target_last_name text,target_phone text,target_modules text[] DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE recipient uuid; checked_recipient jsonb;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(target_institution_id::text));
  checked_recipient:=public.admin_tenant_invitation_recipient(target_institution_id,target_email,target_role_id);
  recipient:=(checked_recipient->>'profile_id')::uuid;
  IF recipient IS NULL THEN RAISE EXCEPTION 'La cuenta no existe en Auth.'; END IF;
  IF NULLIF(trim(target_first_name),'') IS NULL OR NULLIF(trim(target_last_name),'') IS NULL OR target_phone IS NULL OR target_phone !~ '^09[0-9]{8}$' THEN
    RAISE EXCEPTION 'Revisa los nombres y el celular.'; END IF;
  IF EXISTS(SELECT 1 FROM unnest(COALESCE(target_modules,'{}')) chosen WHERE chosen NOT IN ('inicio','projects','dece','simuladores','portal')
    OR NOT EXISTS(SELECT 1 FROM public.module_settings s WHERE s.institution_id=target_institution_id AND s.module_name=chosen AND s.is_enabled)) THEN
    RAISE EXCEPTION 'El módulo no está habilitado en esta institución.' USING ERRCODE='42501'; END IF;
  INSERT INTO public.profiles(profile_id,email,first_name,last_name,phone,mfa_required)
    VALUES(recipient,lower(trim(target_email)),trim(target_first_name),trim(target_last_name),target_phone,true) ON CONFLICT(profile_id) DO NOTHING;
  INSERT INTO public.memberships(institution_id,profile_id,role_id,is_active)
    VALUES(target_institution_id,recipient,target_role_id,false)
    ON CONFLICT(institution_id,profile_id) DO UPDATE SET role_id=EXCLUDED.role_id,is_active=false;
  DELETE FROM public.admin_tenant_member_modules WHERE institution_id=target_institution_id AND profile_id=recipient;
  INSERT INTO public.admin_tenant_member_modules(institution_id,profile_id,module_name)
    SELECT target_institution_id,recipient,chosen FROM (SELECT DISTINCT unnest(COALESCE(target_modules,'{}')) chosen) modules;
  INSERT INTO public.admin_tenant_invitations(institution_id,profile_id,role_id,invited_by,details)
    VALUES(target_institution_id,recipient,target_role_id,auth.uid(),jsonb_build_object('first_name',trim(target_first_name),'last_name',trim(target_last_name),'phone',target_phone))
    ON CONFLICT(institution_id,profile_id) DO UPDATE SET role_id=EXCLUDED.role_id,invited_by=EXCLUDED.invited_by,details=EXCLUDED.details,created_at=now(),accepted_at=null;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_invitation_recipient(uuid,text,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_invitation_recipient(uuid,text,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_tenant_prepare_invitation(uuid,text,uuid,text,text,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_prepare_invitation(uuid,text,uuid,text,text,text,text[]) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
