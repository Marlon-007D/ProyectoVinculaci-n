-- Local proposal: not applied automatically. Does not alter other modules' functions.
BEGIN;
INSERT INTO public.roles(role_id,name)
 SELECT gen_random_uuid(),label::public.user_role_type FROM unnest(ARRAY['teacher','secretary','staff']) label
 WHERE NOT EXISTS(SELECT 1 FROM public.roles r WHERE r.name::text=label);
CREATE OR REPLACE FUNCTION public.admin_tenant_role_name(value text) RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT CASE value WHEN 'superadmin' THEN 'super_admin' WHEN 'admin' THEN 'institution_admin'
 WHEN 'docente' THEN 'teacher' WHEN 'secretaria' THEN 'secretary' WHEN 'personal' THEN 'staff'
 WHEN 'dece_staff' THEN 'dece' WHEN 'project_manager' THEN 'projects_manager' WHEN 'editor' THEN 'content_editor' ELSE value END;
$$;
CREATE OR REPLACE FUNCTION public.admin_tenant_actor_role(target_institution_id uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT public.admin_tenant_role_name(r.name::text) FROM public.memberships m
 JOIN public.roles r ON r.role_id=m.role_id JOIN public.institutions i ON i.institution_id=m.institution_id
 WHERE m.profile_id=auth.uid() AND m.institution_id=target_institution_id AND m.is_active AND i.is_active
 ORDER BY CASE public.admin_tenant_role_name(r.name::text) WHEN 'super_admin' THEN 0 WHEN 'institution_admin' THEN 1 ELSE 2 END LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION public.admin_tenant_can_assign(target_institution_id uuid, role_name text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT COALESCE(CASE public.admin_tenant_actor_role(target_institution_id)
 WHEN 'super_admin' THEN public.admin_tenant_role_name(role_name)='institution_admin'
 WHEN 'institution_admin' THEN public.admin_tenant_role_name(role_name) IN ('teacher','secretary','staff','dece','projects_manager','content_editor','student') ELSE false END,false);
$$;
CREATE TABLE IF NOT EXISTS public.admin_tenant_member_modules (
 institution_id uuid NOT NULL REFERENCES public.institutions(institution_id),
 profile_id uuid NOT NULL REFERENCES auth.users(id), module_name text NOT NULL,
 PRIMARY KEY(institution_id,profile_id,module_name),
 CHECK(module_name IN ('inicio','projects','dece','simuladores','portal'))
);
CREATE OR REPLACE FUNCTION public.admin_tenant_unique_superadmin() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF NEW.is_active AND EXISTS(SELECT 1 FROM public.roles r WHERE r.role_id=NEW.role_id AND public.admin_tenant_role_name(r.name::text)='super_admin') THEN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(NEW.institution_id::text));
  IF EXISTS(SELECT 1 FROM public.memberships m JOIN public.roles r ON r.role_id=m.role_id WHERE m.institution_id=NEW.institution_id AND m.profile_id<>NEW.profile_id AND m.is_active AND public.admin_tenant_role_name(r.name::text)='super_admin') THEN
   RAISE EXCEPTION 'La institución ya tiene un Super Admin activo.' USING ERRCODE='23505';
  END IF;
 END IF;
 RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS admin_tenant_one_superadmin ON public.memberships;
CREATE TRIGGER admin_tenant_one_superadmin BEFORE INSERT OR UPDATE OF role_id,is_active,institution_id ON public.memberships
 FOR EACH ROW EXECUTE FUNCTION public.admin_tenant_unique_superadmin();
ALTER TABLE public.admin_tenant_member_modules ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_tenant_member_modules FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION public.admin_tenant_own_module_grants() RETURNS TABLE(institution_id uuid,module_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT g.institution_id,g.module_name FROM public.admin_tenant_member_modules g
 WHERE g.profile_id=auth.uid() AND public.admin_tenant_actor_role(g.institution_id) IS NOT NULL;
$$;
CREATE OR REPLACE FUNCTION public.admin_tenant_capabilities(target_institution_id uuid, target_role_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT COALESCE((SELECT public.admin_tenant_can_assign(target_institution_id,r.name::text) FROM public.roles r WHERE r.role_id=target_role_id),false);
$$;
CREATE OR REPLACE FUNCTION public.admin_tenant_snapshot(target_institution_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE actor text:=public.admin_tenant_actor_role(target_institution_id); result jsonb;
BEGIN
 IF target_institution_id IS NULL OR actor IS NULL OR actor NOT IN ('super_admin','institution_admin') THEN
  RAISE EXCEPTION 'No tienes permisos en la institución activa.' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('version',1,'institution_id',target_institution_id,'actor_role',actor,
 'roles',COALESCE((SELECT jsonb_agg(jsonb_build_object('role_id',r.role_id,'name',r.name::text)) FROM public.roles r WHERE public.admin_tenant_can_assign(target_institution_id,r.name::text)),'[]'::jsonb),
 'modules',COALESCE((SELECT jsonb_agg(s.module_name) FROM public.module_settings s WHERE s.institution_id=target_institution_id AND s.is_enabled),'[]'::jsonb),
 'members',COALESCE((SELECT jsonb_agg(jsonb_build_object('profile_id',m.profile_id,'institution_id',m.institution_id,'email',COALESCE(u.email,''),'first_name',COALESCE(p.first_name,''),'last_name',COALESCE(p.last_name,''),'phone',COALESCE(p.phone,''),'role_name',COALESCE(r.name::text,'pending'),'is_active',m.is_active,
 'modules',COALESCE((SELECT jsonb_agg(g.module_name) FROM public.admin_tenant_member_modules g WHERE g.institution_id=m.institution_id AND g.profile_id=m.profile_id),'[]'::jsonb)))
 FROM public.memberships m JOIN auth.users u ON u.id=m.profile_id LEFT JOIN public.profiles p ON p.profile_id=m.profile_id LEFT JOIN public.roles r ON r.role_id=m.role_id WHERE m.institution_id=target_institution_id),'[]'::jsonb),
 'requests',COALESCE((SELECT jsonb_agg(jsonb_build_object('request_id',q.request_id,'profile_id',q.profile_id,'institution_id',q.institution_id,'email',COALESCE(u.email,''),'first_name',q.first_name,'last_name',q.last_name,'phone',q.phone))
 FROM public.admin_membership_requests q JOIN auth.users u ON u.id=q.profile_id WHERE q.institution_id=target_institution_id AND q.status='pending'),'[]'::jsonb)) INTO result;
 RETURN result;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_tenant_assign_role(target_institution_id uuid,target_email text,target_role_id uuid,target_first_name text,target_last_name text,target_phone text,target_modules text[] DEFAULT '{}') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE desired text; recipient uuid; existing_role text; actor text;
BEGIN
 SELECT r.name::text INTO desired FROM public.roles r WHERE r.role_id=target_role_id;
 IF NOT public.admin_tenant_can_assign(target_institution_id,desired) THEN RAISE EXCEPTION 'No puedes asignar ese rol en esta institución.' USING ERRCODE='42501'; END IF;
 -- Serialize changes of authority inside this institution, including concurrent assignments.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(target_institution_id::text));
 actor:=public.admin_tenant_actor_role(target_institution_id);
 IF NOT public.admin_tenant_can_assign(target_institution_id,desired) THEN RAISE EXCEPTION 'Tu autorización cambió.' USING ERRCODE='42501'; END IF;
 IF NULLIF(trim(target_first_name),'') IS NULL OR NULLIF(trim(target_last_name),'') IS NULL OR target_phone IS NULL OR target_phone !~ '^09[0-9]{8}$' THEN RAISE EXCEPTION 'Revisa los nombres y el celular.'; END IF;
 SELECT u.id INTO recipient FROM auth.users u WHERE lower(u.email)=lower(trim(target_email));
 IF recipient IS NULL THEN RAISE EXCEPTION 'La cuenta aún no existe.' USING ERRCODE='P0002'; END IF;
 IF recipient=auth.uid() THEN RAISE EXCEPTION 'No puedes cambiar tu propio rol.' USING ERRCODE='42501'; END IF;
 SELECT r.name::text INTO existing_role FROM public.memberships m JOIN public.roles r ON r.role_id=m.role_id WHERE m.profile_id=recipient AND m.institution_id=target_institution_id FOR UPDATE OF m;
 IF public.admin_tenant_role_name(existing_role)='super_admin' OR (existing_role IS NOT NULL AND public.admin_tenant_role_name(existing_role)='institution_admin' AND actor<>'super_admin') THEN RAISE EXCEPTION 'No puedes modificar una autoridad superior.' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(COALESCE(target_modules,'{}')) chosen WHERE chosen NOT IN ('inicio','projects','dece','simuladores','portal') OR NOT EXISTS(SELECT 1 FROM public.module_settings s WHERE s.institution_id=target_institution_id AND s.module_name=chosen AND s.is_enabled)) THEN RAISE EXCEPTION 'El módulo no está habilitado en la institución.' USING ERRCODE='42501'; END IF;
 INSERT INTO public.profiles(profile_id,email,first_name,last_name,phone,mfa_required) VALUES(recipient,lower(trim(target_email)),trim(target_first_name),trim(target_last_name),target_phone,true) ON CONFLICT(profile_id) DO NOTHING;
 INSERT INTO public.memberships(institution_id,profile_id,role_id,is_active) VALUES(target_institution_id,recipient,target_role_id,true) ON CONFLICT(institution_id,profile_id) DO UPDATE SET role_id=EXCLUDED.role_id,is_active=true;
 DELETE FROM public.admin_tenant_member_modules WHERE institution_id=target_institution_id AND profile_id=recipient;
 IF public.admin_tenant_role_name(desired)<>'institution_admin' THEN
  INSERT INTO public.admin_tenant_member_modules(institution_id,profile_id,module_name) SELECT target_institution_id,recipient,chosen FROM (SELECT DISTINCT unnest(COALESCE(target_modules,'{}')) chosen) items;
 END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_tenant_approve_request(target_institution_id uuid,target_request_id uuid,target_role_id uuid,target_modules text[] DEFAULT '{}') RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE pending public.admin_membership_requests%ROWTYPE; recipient_email text;
BEGIN
 IF NOT public.admin_tenant_capabilities(target_institution_id,target_role_id) THEN RAISE EXCEPTION 'Sin permisos para aprobar.' USING ERRCODE='42501'; END IF;
 SELECT * INTO pending FROM public.admin_membership_requests q WHERE q.institution_id=target_institution_id AND q.request_id=target_request_id FOR UPDATE;
 IF pending.request_id IS NULL OR pending.status<>'pending' THEN RAISE EXCEPTION 'No hay una solicitud pendiente en esta institución.' USING ERRCODE='42501'; END IF;
 SELECT u.email INTO recipient_email FROM auth.users u WHERE u.id=pending.profile_id;
 PERFORM public.admin_tenant_assign_role(target_institution_id,recipient_email,target_role_id,pending.first_name,pending.last_name,pending.phone,target_modules);
 UPDATE public.admin_membership_requests SET status='approved',reviewed_at=now(),reviewed_by=auth.uid() WHERE request_id=pending.request_id AND institution_id=target_institution_id;
END;
$$;
CREATE OR REPLACE FUNCTION public.admin_tenant_remove_role(target_institution_id uuid,target_profile_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE desired text;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(target_institution_id::text));
 SELECT r.name::text INTO desired FROM public.memberships m JOIN public.roles r ON r.role_id=m.role_id WHERE m.institution_id=target_institution_id AND m.profile_id=target_profile_id FOR UPDATE OF m;
 IF target_profile_id=auth.uid() OR NOT public.admin_tenant_can_assign(target_institution_id,desired) THEN RAISE EXCEPTION 'No puedes retirar ese rol en esta institución.' USING ERRCODE='42501'; END IF;
 UPDATE public.memberships SET is_active=false WHERE institution_id=target_institution_id AND profile_id=target_profile_id;
 DELETE FROM public.admin_tenant_member_modules WHERE institution_id=target_institution_id AND profile_id=target_profile_id;
END;
$$;
-- Restrictive guards intersect existing permissive policies; no bypass via legacy global membership reads.
CREATE OR REPLACE FUNCTION public.admin_tenant_can_read_profile(target_profile_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT target_profile_id=auth.uid() OR EXISTS(SELECT 1 FROM public.memberships m WHERE m.profile_id=target_profile_id AND public.admin_tenant_actor_role(m.institution_id) IN ('super_admin','institution_admin'));
$$;
DROP POLICY IF EXISTS admin_tenant_memberships_guard ON public.memberships;
CREATE POLICY admin_tenant_memberships_guard ON public.memberships AS RESTRICTIVE FOR ALL TO authenticated
 USING(profile_id=auth.uid() OR public.admin_tenant_actor_role(institution_id) IN ('super_admin','institution_admin')) WITH CHECK(false);
DROP POLICY IF EXISTS admin_tenant_requests_guard ON public.admin_membership_requests;
CREATE POLICY admin_tenant_requests_guard ON public.admin_membership_requests AS RESTRICTIVE FOR ALL TO authenticated
 USING(profile_id=auth.uid() OR public.admin_tenant_actor_role(institution_id) IN ('super_admin','institution_admin')) WITH CHECK(false);
DROP POLICY IF EXISTS admin_tenant_profiles_guard ON public.profiles;
CREATE POLICY admin_tenant_profiles_guard ON public.profiles AS RESTRICTIVE FOR SELECT TO authenticated USING(public.admin_tenant_can_read_profile(profile_id));
-- Retire only Admin's old global RPC entrypoints. Leave other modules and their functions untouched.
DO $$ DECLARE fn record; BEGIN
 FOR fn IN SELECT p.oid::regprocedure signature FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname IN ('assign_institution_role','remove_institution_role','approve_institution_member','approve_institution_access','list_managed_memberships','admin_pending_institution_access') LOOP
  EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',fn.signature);
 END LOOP;
 FOR fn IN SELECT p.oid::regprocedure signature FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname LIKE 'admin_tenant_%' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon',fn.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',fn.signature);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
