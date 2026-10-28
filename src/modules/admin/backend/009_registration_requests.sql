-- Apply after 008_guest_role_label.sql has committed, and after 007.
BEGIN;
INSERT INTO public.roles(role_id,name) SELECT gen_random_uuid(),'guest'::public.user_role_type
 WHERE NOT EXISTS(SELECT 1 FROM public.roles WHERE name::text='guest');

CREATE OR REPLACE FUNCTION public.admin_tenant_can_assign(target_institution_id uuid, role_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT COALESCE(CASE public.admin_tenant_actor_role(target_institution_id)
 WHEN 'super_admin' THEN public.admin_tenant_role_name(role_name)='institution_admin'
 WHEN 'institution_admin' THEN public.admin_tenant_role_name(role_name) IN
 ('teacher','secretary','staff','dece','projects_manager','content_editor','student','guest') ELSE false END,false);
$$;

CREATE OR REPLACE FUNCTION public.admin_tenant_snapshot_v3(target_institution_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE snapshot jsonb := public.admin_tenant_snapshot_v2(target_institution_id); incoming jsonb;
BEGIN
 SELECT COALESCE(jsonb_agg(row),'[]'::jsonb) INTO incoming FROM (
   SELECT jsonb_build_object('request_id',m.profile_id,'profile_id',m.profile_id,'institution_id',m.institution_id,
    'source','registration','email',COALESCE(u.email,''),'first_name',COALESCE(p.first_name,u.raw_user_meta_data->>'first_name',''),
    'last_name',COALESCE(p.last_name,u.raw_user_meta_data->>'last_name',''),'phone',COALESCE(p.phone,'')) row
   FROM public.memberships m JOIN public.roles r ON r.role_id=m.role_id JOIN auth.users u ON u.id=m.profile_id
   LEFT JOIN public.profiles p ON p.profile_id=m.profile_id
   WHERE m.institution_id=target_institution_id AND NOT m.is_active AND r.name::text IN ('guest','invitado','pending','viewer')
   AND NOT EXISTS(SELECT 1 FROM public.admin_membership_requests q WHERE q.profile_id=m.profile_id AND q.institution_id=m.institution_id)
   AND NOT EXISTS(SELECT 1 FROM public.admin_tenant_invitations v WHERE v.profile_id=m.profile_id AND v.institution_id=m.institution_id AND v.accepted_at IS NULL)
 ) rows;
 RETURN jsonb_set(snapshot,'{requests}',(snapshot->'requests') || incoming);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_tenant_approve_registration(
 target_institution_id uuid,target_profile_id uuid,target_request_id uuid,target_role_id uuid,
 target_first_name text,target_last_name text,target_phone text,target_modules text[] DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE request public.admin_membership_requests%ROWTYPE; existing_role text; active boolean; email text;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(target_institution_id::text));
 IF target_profile_id=auth.uid() OR NOT public.admin_tenant_capabilities(target_institution_id,target_role_id) THEN
  RAISE EXCEPTION 'No puedes aprobar este rol en esta institución.' USING ERRCODE='42501'; END IF;
 SELECT * INTO request FROM public.admin_membership_requests q
 WHERE q.institution_id=target_institution_id AND q.profile_id=target_profile_id AND q.request_id=target_request_id FOR UPDATE;
 SELECT public.admin_tenant_role_name(r.name::text),m.is_active INTO existing_role,active
 FROM public.memberships m JOIN public.roles r ON r.role_id=m.role_id
 WHERE m.institution_id=target_institution_id AND m.profile_id=target_profile_id FOR UPDATE OF m;
 IF existing_role='super_admin' OR (existing_role='institution_admin' AND public.admin_tenant_actor_role(target_institution_id)<>'super_admin') THEN
  RAISE EXCEPTION 'La cuenta está protegida.' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.admin_tenant_invitations v WHERE v.institution_id=target_institution_id AND v.profile_id=target_profile_id AND v.accepted_at IS NULL) THEN
  RAISE EXCEPTION 'Esta cuenta debe aceptar su invitación por correo.' USING ERRCODE='42501'; END IF;
 IF request.request_id IS NOT NULL THEN
  IF request.status<>'pending' THEN RAISE EXCEPTION 'La solicitud ya fue revisada.'; END IF;
 ELSIF target_request_id<>target_profile_id OR active IS DISTINCT FROM false OR existing_role NOT IN ('guest','invitado','pending','viewer') OR existing_role IS NULL THEN
  RAISE EXCEPTION 'No hay un registro pendiente en esta institución.' USING ERRCODE='42501';
 END IF;
 IF request.request_id IS NULL AND EXISTS(SELECT 1 FROM public.admin_membership_requests q WHERE q.institution_id=target_institution_id AND q.profile_id=target_profile_id) THEN
  RAISE EXCEPTION 'El registro ya fue revisado.' USING ERRCODE='42501'; END IF;
 SELECT u.email INTO email FROM auth.users u WHERE u.id=target_profile_id;
 PERFORM public.admin_tenant_assign_role(target_institution_id,email,target_role_id,target_first_name,target_last_name,target_phone,target_modules);
 -- Explicit selections are kept for every approved role, including base/admin.
 INSERT INTO public.admin_tenant_member_modules(institution_id,profile_id,module_name)
 SELECT target_institution_id,target_profile_id,chosen FROM (SELECT DISTINCT unnest(COALESCE(target_modules,'{}')) chosen) items ON CONFLICT DO NOTHING;
 IF request.request_id IS NOT NULL THEN
  UPDATE public.admin_membership_requests SET status='approved',reviewed_at=now(),reviewed_by=auth.uid()
  WHERE request_id=request.request_id AND institution_id=target_institution_id;
 ELSE
  INSERT INTO public.admin_membership_requests(request_id,institution_id,profile_id,first_name,last_name,phone,status,reviewed_at,reviewed_by)
  VALUES(gen_random_uuid(),target_institution_id,target_profile_id,trim(target_first_name),trim(target_last_name),target_phone,'approved',now(),auth.uid());
 END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_snapshot_v3(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_snapshot_v3(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_tenant_approve_registration(uuid,uuid,uuid,uuid,text,text,text,text[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_approve_registration(uuid,uuid,uuid,uuid,text,text,text,text[]) TO authenticated;
CREATE OR REPLACE FUNCTION public.admin_tenant_accept_invitation(target_institution_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE invitation public.admin_tenant_invitations%ROWTYPE;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(target_institution_id::text));
  SELECT * INTO invitation FROM public.admin_tenant_invitations WHERE institution_id=target_institution_id AND profile_id=auth.uid() FOR UPDATE;
  IF invitation.profile_id IS NULL OR invitation.accepted_at IS NOT NULL OR public.admin_tenant_own_invitation(target_institution_id) IS NULL THEN
    RAISE EXCEPTION 'La invitación no está pendiente o el correo no está confirmado.' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.memberships m JOIN public.roles r ON r.role_id=m.role_id
      WHERE m.profile_id=invitation.invited_by AND m.institution_id=target_institution_id AND m.is_active
      AND ((public.admin_tenant_role_name(r.name::text)='super_admin' AND invitation.role_id IN(SELECT role_id FROM public.roles WHERE public.admin_tenant_role_name(name::text)='institution_admin'))
        OR (public.admin_tenant_role_name(r.name::text)='institution_admin' AND invitation.role_id IN(SELECT role_id FROM public.roles WHERE public.admin_tenant_role_name(name::text) IN('teacher','secretary','staff','student','dece','projects_manager','content_editor','guest'))))) THEN
    RAISE EXCEPTION 'La autoridad que emitió la invitación ya no tiene permisos.' USING ERRCODE='42501'; END IF;
  UPDATE public.admin_tenant_invitations SET accepted_at=now() WHERE institution_id=target_institution_id AND profile_id=auth.uid();
  UPDATE public.memberships SET is_active=true WHERE institution_id=target_institution_id AND profile_id=auth.uid() AND role_id=invitation.role_id AND NOT is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'La membresía pendiente cambió.'; END IF;
END;
$$;

NOTIFY pgrst,'reload schema';
COMMIT;
