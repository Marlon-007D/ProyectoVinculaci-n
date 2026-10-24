DROP POLICY "honors_tenant_policy" ON public.honors;
CREATE POLICY "honors_tenant_policy"
  ON public.honors
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR institution_id = public.get_current_institution_id()
  )
  WITH CHECK (
    public.is_super_admin()
    OR institution_id = public.get_current_institution_id()
  );

DROP POLICY "academic_periods_tenant_policy" ON public.academic_periods;
CREATE POLICY "academic_periods_tenant_policy"
  ON public.academic_periods
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin()
    OR institution_id = public.get_current_institution_id()
  )
  WITH CHECK (
    public.is_super_admin()
    OR institution_id = public.get_current_institution_id()
  );

CREATE POLICY "students_super_admin_read"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (public.is_super_admin());
