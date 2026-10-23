BEGIN;

DROP POLICY IF EXISTS news_tenant_policy ON public.news;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.news TO authenticated;

CREATE POLICY news_editor_write ON public.news
  FOR ALL TO authenticated
  USING (
    public.is_super_admin()
    OR public.has_institution_role(
      institution_id,
      ARRAY['institution_admin', 'editor']::public.user_role_type[]
    )
  )
  WITH CHECK (
    public.is_super_admin()
    OR public.has_institution_role(
      institution_id,
      ARRAY['institution_admin', 'editor']::public.user_role_type[]
    )
  );

COMMIT;
