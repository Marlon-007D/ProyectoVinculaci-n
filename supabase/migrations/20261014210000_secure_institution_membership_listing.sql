-- Lista membresías y estado MFA con alcance institucional validado en servidor.
-- Aplicar después de database/superadmin.sql.
CREATE OR REPLACE FUNCTION public.list_accessible_institution_memberships(
  target_institution_id UUID DEFAULT NULL
)
RETURNS TABLE (
  profile_id UUID,
  institution_id UUID,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  role_name TEXT,
  institution_name TEXT,
  mfa_enabled BOOLEAN,
  mfa_required BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para consultar membresías.'
      USING ERRCODE = '42501';
  END IF;

  IF public.is_super_admin() THEN
    RETURN QUERY
      SELECT m.profile_id, m.institution_id, p.email::TEXT, p.first_name::TEXT,
        p.last_name::TEXT, r.name::TEXT, i.name::TEXT,
        COALESCE(p.mfa_enabled, FALSE), COALESCE(p.mfa_required, FALSE)
      FROM public.memberships AS m
      JOIN public.roles AS r ON r.role_id = m.role_id
      LEFT JOIN public.profiles AS p ON p.profile_id = m.profile_id
      LEFT JOIN public.institutions AS i ON i.institution_id = m.institution_id
      WHERE target_institution_id IS NULL OR m.institution_id = target_institution_id
      ORDER BY i.name NULLS LAST, p.email;
    RETURN;
  END IF;

  IF target_institution_id IS NULL OR NOT public.has_institution_role(
    target_institution_id,
    ARRAY['institution_admin']::public.user_role_type[]
  ) THEN
    RAISE EXCEPTION 'Solo puedes consultar usuarios de una institución que administras.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT m.profile_id, m.institution_id, p.email::TEXT, p.first_name::TEXT,
      p.last_name::TEXT, r.name::TEXT, i.name::TEXT,
      COALESCE(p.mfa_enabled, FALSE), COALESCE(p.mfa_required, FALSE)
    FROM public.memberships AS m
    JOIN public.roles AS r ON r.role_id = m.role_id
    LEFT JOIN public.profiles AS p ON p.profile_id = m.profile_id
    JOIN public.institutions AS i ON i.institution_id = m.institution_id
    WHERE m.institution_id = target_institution_id
      AND r.name <> 'super_admin'
    ORDER BY p.email;
END;
$$;

REVOKE ALL ON FUNCTION public.list_accessible_institution_memberships(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_accessible_institution_memberships(UUID) TO authenticated;
