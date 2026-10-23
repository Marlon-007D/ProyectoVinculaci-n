-- Revocación por RPC: conserva RLS y limita el cambio a la membresía autorizada.
BEGIN;
CREATE OR REPLACE FUNCTION public.remove_institution_role(target_institution_id UUID, target_profile_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE previous_role TEXT; pending_role UUID;
BEGIN
  IF auth.uid() IS NULL OR target_institution_id IS NULL OR target_profile_id IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión y selecciona una membresía válida.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.is_super_admin() AND NOT public.has_institution_role(target_institution_id, ARRAY['institution_admin']::public.user_role_type[]) THEN
    RAISE EXCEPTION 'No tienes permisos para modificar esta institución.' USING ERRCODE = '42501';
  END IF;
  SELECT r.name::text INTO previous_role FROM public.memberships m JOIN public.roles r USING (role_id)
    WHERE m.profile_id = target_profile_id AND m.institution_id = target_institution_id FOR UPDATE OF m;
  IF previous_role IS NULL OR previous_role = 'super_admin'
    OR (public.is_super_admin() AND previous_role <> 'institution_admin')
    OR (NOT public.is_super_admin() AND previous_role = 'institution_admin') THEN
    RAISE EXCEPTION 'No tienes permisos para retirar este rol.' USING ERRCODE = '42501';
  END IF;
  SELECT role_id INTO pending_role FROM public.roles WHERE name::text IN ('invitado', 'pending', 'guest', 'viewer')
    ORDER BY CASE name::text WHEN 'invitado' THEN 0 WHEN 'pending' THEN 1 WHEN 'guest' THEN 2 ELSE 3 END LIMIT 1;
  IF pending_role IS NULL THEN RAISE EXCEPTION 'No se pudo preparar la membresía pendiente.'; END IF;
  UPDATE public.memberships SET role_id = pending_role, is_active = FALSE
    WHERE profile_id = target_profile_id AND institution_id = target_institution_id;
END;
$$;
ALTER FUNCTION public.remove_institution_role(UUID, UUID) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.remove_institution_role(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_institution_role(UUID, UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
