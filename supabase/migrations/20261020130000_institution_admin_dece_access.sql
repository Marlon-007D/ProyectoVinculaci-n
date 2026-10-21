-- Audited against the official shared schema on 2026-10-20.
-- Extend DECE to active institutional admins without granting other tenants.
BEGIN;

CREATE OR REPLACE FUNCTION public.dece_has_institution_access(target_institution UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.institutions i
    WHERE i.institution_id = target_institution AND i.is_active
      AND (public.is_super_admin() OR public.has_institution_role(
        i.institution_id, ARRAY['institution_admin', 'dece_staff']::public.user_role_type[]))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_access_dece_case(target_case_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.dece_cases dc
    WHERE dc.dece_case_id = target_case_id
      AND public.dece_has_institution_access(dc.institution_id)
  );
$$;

REVOKE ALL ON FUNCTION public.dece_has_institution_access(UUID), public.can_access_dece_case(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dece_has_institution_access(UUID), public.can_access_dece_case(UUID) TO authenticated, service_role;

-- Existing student self-service and staff policies are retained.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.students, public.dece_cases TO authenticated;
DROP POLICY IF EXISTS dylan_dece_students_access ON public.students;
CREATE POLICY dylan_dece_students_access ON public.students FOR ALL TO authenticated
  USING (public.dece_has_institution_access(institution_id))
  WITH CHECK (public.dece_has_institution_access(institution_id));
DROP POLICY IF EXISTS dylan_dece_cases_access ON public.dece_cases;
CREATE POLICY dylan_dece_cases_access ON public.dece_cases FOR ALL TO authenticated
  USING (public.dece_has_institution_access(institution_id))
  WITH CHECK (public.dece_has_institution_access(institution_id));

NOTIFY pgrst, 'reload schema';
COMMIT;
