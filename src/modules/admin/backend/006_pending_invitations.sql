-- Apply after 002_tenant_admin.sql. No existing membership is deactivated by installation.
BEGIN;
CREATE TABLE IF NOT EXISTS public.admin_tenant_invitations (
  institution_id uuid REFERENCES public.institutions(institution_id) NOT NULL,
  profile_id uuid REFERENCES auth.users(id) NOT NULL,
  role_id uuid REFERENCES public.roles(role_id) NOT NULL,
  invited_by uuid REFERENCES auth.users(id) NOT NULL,
  details jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  PRIMARY KEY(institution_id,profile_id)
);
ALTER TABLE public.admin_tenant_invitations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_tenant_invitations FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.admin_tenant_prepare_invitation(
  target_institution_id uuid,target_email text,target_role_id uuid,
  target_first_name text,target_last_name text,target_phone text,target_modules text[] DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE recipient uuid;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(target_institution_id::text));
  SELECT id INTO recipient FROM auth.users WHERE lower(email)=lower(trim(target_email));
  IF recipient IS NULL THEN RAISE EXCEPTION 'La cuenta pendiente no existe.'; END IF;
  IF EXISTS(SELECT 1 FROM public.admin_tenant_invitations WHERE institution_id=target_institution_id AND profile_id=recipient AND accepted_at IS NULL) THEN
    RAISE EXCEPTION 'Ya existe una invitación pendiente para esta cuenta.'; END IF;
  IF EXISTS(SELECT 1 FROM public.memberships WHERE institution_id=target_institution_id AND profile_id=recipient AND is_active) THEN
    RAISE EXCEPTION 'La cuenta ya tiene una membresía activa.' USING ERRCODE='42501'; END IF;
  PERFORM public.admin_tenant_assign_role(target_institution_id,target_email,target_role_id,target_first_name,target_last_name,target_phone,target_modules);
  UPDATE public.memberships SET is_active=false WHERE institution_id=target_institution_id AND profile_id=recipient;
  INSERT INTO public.admin_tenant_invitations(institution_id,profile_id,role_id,invited_by,details)
    VALUES(target_institution_id,recipient,target_role_id,auth.uid(),jsonb_build_object('first_name',trim(target_first_name),'last_name',trim(target_last_name),'phone',target_phone))
    ON CONFLICT(institution_id,profile_id) DO UPDATE SET role_id=EXCLUDED.role_id,invited_by=EXCLUDED.invited_by,details=EXCLUDED.details,created_at=now(),accepted_at=null;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_tenant_own_invitation(target_institution_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('pending',true,'profile',v.details,'email',u.email,'membership',
    jsonb_build_object('institution_id',m.institution_id,'is_active',m.is_active,'roles',jsonb_build_object('name',r.name::text),'institutions',jsonb_build_object('slug',i.slug,'name',i.name)))
  FROM public.admin_tenant_invitations v
  JOIN auth.users u ON u.id=v.profile_id
  JOIN public.memberships m ON m.profile_id=v.profile_id AND m.institution_id=v.institution_id AND m.role_id=v.role_id
  JOIN public.roles r ON r.role_id=v.role_id JOIN public.institutions i ON i.institution_id=v.institution_id
  WHERE v.profile_id=auth.uid() AND v.institution_id=target_institution_id AND v.accepted_at IS NULL
    AND NOT m.is_active AND i.is_active AND u.email_confirmed_at IS NOT NULL;
$$;
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
        OR (public.admin_tenant_role_name(r.name::text)='institution_admin' AND invitation.role_id IN(SELECT role_id FROM public.roles WHERE public.admin_tenant_role_name(name::text) IN('teacher','secretary','staff','student','dece','projects_manager','content_editor'))))) THEN
    RAISE EXCEPTION 'La autoridad que emitió la invitación ya no tiene permisos.' USING ERRCODE='42501'; END IF;
  UPDATE public.admin_tenant_invitations SET accepted_at=now() WHERE institution_id=target_institution_id AND profile_id=auth.uid();
  UPDATE public.memberships SET is_active=true WHERE institution_id=target_institution_id AND profile_id=auth.uid() AND role_id=invitation.role_id AND NOT is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'La membresía pendiente cambió.'; END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_tenant_guard_pending_activation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.is_active AND NOT OLD.is_active AND EXISTS(SELECT 1 FROM public.admin_tenant_invitations
    WHERE institution_id=NEW.institution_id AND profile_id=NEW.profile_id AND accepted_at IS NULL) THEN
    RAISE EXCEPTION 'El destinatario debe aceptar la invitación antes de activar la membresía.' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_guard_pending_activation() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS admin_tenant_guard_pending_activation ON public.memberships;
CREATE TRIGGER admin_tenant_guard_pending_activation BEFORE UPDATE OF is_active ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.admin_tenant_guard_pending_activation();
CREATE OR REPLACE FUNCTION public.admin_tenant_snapshot_v2(target_institution_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE snapshot jsonb:=public.admin_tenant_snapshot(target_institution_id);
BEGIN
  RETURN jsonb_set(snapshot,'{members}',COALESCE((SELECT jsonb_agg(member || jsonb_build_object('invitation_pending',EXISTS(
    SELECT 1 FROM public.admin_tenant_invitations v WHERE v.institution_id=target_institution_id
      AND v.profile_id=(member->>'profile_id')::uuid AND v.accepted_at IS NULL AND (member->>'is_active')::boolean=false
  ))) FROM jsonb_array_elements(snapshot->'members') member),'[]'::jsonb));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_prepare_invitation(uuid,text,uuid,text,text,text,text[]) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_tenant_own_invitation(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_tenant_accept_invitation(uuid) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_tenant_snapshot_v2(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_prepare_invitation(uuid,text,uuid,text,text,text,text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_tenant_own_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_tenant_accept_invitation(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_tenant_snapshot_v2(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
