-- Solicitudes de acceso: no crean membresías ni conceden permisos al registrarse.
CREATE TABLE public.admin_membership_requests (
  request_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(institution_id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name text NOT NULL CHECK (length(trim(first_name)) BETWEEN 1 AND 100),
  last_name text NOT NULL CHECK (length(trim(last_name)) BETWEEN 1 AND 100),
  phone text NOT NULL CHECK (phone ~ '^09[0-9]{8}$'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  UNIQUE (institution_id, profile_id),
  CHECK ((status = 'pending' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (status = 'approved' AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL))
);
--> statement-breakpoint
CREATE FUNCTION public.admin_can_manage_membership_requests(target_institution uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.institutions i WHERE i.institution_id = target_institution AND i.is_active
  ) AND EXISTS (
    SELECT 1 FROM public.memberships m JOIN public.roles r ON r.role_id = m.role_id
    WHERE m.profile_id = auth.uid() AND m.is_active
      AND (r.name::text = 'super_admin' OR (m.institution_id = target_institution AND r.name::text = 'institution_admin'))
  );
$$;
--> statement-breakpoint
ALTER TABLE public.admin_membership_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_membership_requests FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_membership_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.admin_membership_requests TO authenticated;
CREATE POLICY admin_membership_requests_read ON public.admin_membership_requests FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.admin_can_manage_membership_requests(institution_id));
--> statement-breakpoint
CREATE FUNCTION public.request_institution_access(target_institution text, target_slug text, given_name text, family_name text, contact_phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE institution uuid; request uuid; request_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Inicia sesión para solicitar acceso.' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = auth.uid() AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'Confirma tu correo antes de solicitar acceso.' USING ERRCODE = '42501';
  END IF;
  SELECT i.institution_id INTO institution FROM public.institutions i
    WHERE i.is_active AND (i.institution_id::text = target_institution OR i.slug = target_institution)
      AND (NULLIF(target_slug, '') IS NULL OR i.slug = target_slug);
  IF institution IS NULL THEN RAISE EXCEPTION 'No se encontró la institución activa seleccionada.'; END IF;
  IF EXISTS (SELECT 1 FROM public.memberships m JOIN public.roles r USING(role_id)
    WHERE m.profile_id = auth.uid() AND m.is_active AND r.name::text = 'super_admin') THEN
    RAISE EXCEPTION 'Una cuenta global no necesita solicitar una membresía institucional.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.memberships m WHERE m.profile_id = auth.uid() AND m.institution_id = institution
    AND (m.role_id IS NOT NULL OR NOT m.is_active)) THEN
    RAISE EXCEPTION 'Tu cuenta ya tiene una membresía en esta institución. Contacta a su administrador.';
  END IF;
  INSERT INTO public.admin_membership_requests(institution_id, profile_id, first_name, last_name, phone)
    VALUES (institution, auth.uid(), trim(given_name), trim(family_name), trim(contact_phone))
    ON CONFLICT (institution_id, profile_id) DO NOTHING;
  SELECT r.request_id, r.status INTO request, request_status FROM public.admin_membership_requests r
    WHERE r.institution_id = institution AND r.profile_id = auth.uid();
  IF request_status <> 'pending' THEN RAISE EXCEPTION 'Tu solicitud ya fue revisada. Contacta al administrador.'; END IF;
  RETURN request;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION public.own_institution_access_request(target_institution text, target_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT jsonb_build_object('request_id', r.request_id, 'status', r.status)
  FROM public.admin_membership_requests r JOIN public.institutions i USING (institution_id)
  WHERE r.profile_id = auth.uid() AND i.is_active
    AND (i.institution_id::text = target_institution OR i.slug = target_institution)
    AND (NULLIF(target_slug, '') IS NULL OR i.slug = target_slug);
$$;
--> statement-breakpoint
CREATE FUNCTION public.admin_pending_institution_access(target_institution_id uuid)
RETURNS TABLE(request_id uuid, profile_id uuid, institution_id uuid, email text, first_name text, last_name text, phone text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF NOT public.admin_can_manage_membership_requests(target_institution_id) THEN
    RAISE EXCEPTION 'No tienes permisos para consultar solicitudes de esta institución.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT r.request_id, r.profile_id, r.institution_id, u.email::text, r.first_name, r.last_name, r.phone
    FROM public.admin_membership_requests r JOIN auth.users u ON u.id = r.profile_id
    WHERE r.institution_id = target_institution_id AND r.status = 'pending'
      AND NOT EXISTS (SELECT 1 FROM public.memberships m JOIN public.roles role ON role.role_id = m.role_id
        WHERE m.profile_id = r.profile_id AND role.name::text = 'super_admin')
    ORDER BY r.created_at;
END;
$$;
--> statement-breakpoint
CREATE FUNCTION public.approve_institution_access(target_request_id uuid, target_role_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE request public.admin_membership_requests%ROWTYPE; target_email text; role_name text;
BEGIN
  SELECT * INTO request FROM public.admin_membership_requests WHERE request_id = target_request_id FOR UPDATE;
  IF request.request_id IS NULL OR NOT public.admin_can_manage_membership_requests(request.institution_id) THEN
    RAISE EXCEPTION 'No tienes permisos para aprobar esta solicitud.' USING ERRCODE = '42501';
  END IF;
  IF request.profile_id = auth.uid() THEN RAISE EXCEPTION 'No puedes aprobar tu propia solicitud.' USING ERRCODE = '42501'; END IF;
  IF request.status <> 'pending' THEN RAISE EXCEPTION 'La solicitud ya fue revisada.'; END IF;
  IF EXISTS (SELECT 1 FROM public.memberships m JOIN public.roles r USING(role_id)
    WHERE m.profile_id = request.profile_id AND r.name::text = 'super_admin') THEN
    RAISE EXCEPTION 'Las cuentas globales no se administran desde las solicitudes institucionales.' USING ERRCODE = '42501';
  END IF;
  SELECT name::text INTO role_name FROM public.roles WHERE role_id = target_role_id;
  IF role_name IS NULL OR role_name NOT IN ('institution_admin', 'dece_staff', 'project_manager', 'projects_manager', 'editor', 'content_editor', 'dece', 'viewer', 'student') THEN
    RAISE EXCEPTION 'Selecciona un rol institucional válido.' USING ERRCODE = '42501';
  END IF;
  IF role_name = 'institution_admin' AND NOT EXISTS (SELECT 1 FROM public.memberships m JOIN public.roles r USING(role_id)
    WHERE m.profile_id = auth.uid() AND m.is_active AND r.name::text = 'super_admin') THEN
    RAISE EXCEPTION 'Solo el administrador global puede asignar administradores institucionales.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.memberships m WHERE m.profile_id = request.profile_id AND m.institution_id = request.institution_id
    AND (m.role_id IS NOT NULL OR NOT m.is_active)) THEN
    RAISE EXCEPTION 'La cuenta ya tiene una membresía asignada o desactivada. Revisa sus permisos antes de continuar.';
  END IF;
  SELECT u.email INTO target_email FROM auth.users u WHERE u.id = request.profile_id;
  PERFORM public.assign_institution_role(target_email, request.institution_id, target_role_id, request.first_name, request.last_name, request.phone);
  UPDATE public.admin_membership_requests SET status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
    WHERE request_id = request.request_id;
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.admin_can_manage_membership_requests(uuid),
  public.request_institution_access(text,text,text,text,text), public.own_institution_access_request(text,text),
  public.admin_pending_institution_access(uuid), public.approve_institution_access(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_can_manage_membership_requests(uuid),
  public.request_institution_access(text,text,text,text,text), public.own_institution_access_request(text,text),
  public.admin_pending_institution_access(uuid), public.approve_institution_access(uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
