-- All object keys: <institution UUID>/<relative file path>.
BEGIN;

INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', TRUE), ('documents', 'documents', FALSE)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

CREATE OR REPLACE FUNCTION public.can_access_tenant_object(object_name TEXT, admin_only BOOLEAN DEFAULT FALSE)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT auth.uid() IS NOT NULL
    AND split_part(object_name, '/', 2) <> ''
    AND object_name !~ '(^|/)\.\.?(/|$)' AND object_name !~ '//'
    AND EXISTS (
      SELECT 1 FROM public.institutions i
      WHERE i.institution_id::text = split_part(object_name, '/', 1) AND i.is_active
        AND CASE WHEN admin_only THEN
          public.is_super_admin() OR public.has_institution_role(i.institution_id, ARRAY['institution_admin']::public.user_role_type[])
        ELSE public.is_member_of_institution(i.institution_id) END
    );
$$;
REVOKE ALL ON FUNCTION public.can_access_tenant_object(TEXT, BOOLEAN) FROM PUBLIC, anon;
-- PostgreSQL may check function permissions while planning an anonymous RLS
-- query, even for a CASE branch returning FALSE. The helper itself rejects anon.
GRANT EXECUTE ON FUNCTION public.can_access_tenant_object(TEXT, BOOLEAN) TO anon, authenticated;

-- Keep unrelated bucket policies. Restrictive guards prevent pre-existing broad
-- permissive policies from reopening these two buckets (policies combine by OR).
DROP POLICY IF EXISTS dylan_storage_read_guard ON storage.objects;
DROP POLICY IF EXISTS dylan_storage_insert_guard ON storage.objects;
DROP POLICY IF EXISTS dylan_storage_update_guard ON storage.objects;
DROP POLICY IF EXISTS dylan_storage_delete_guard ON storage.objects;
DROP POLICY IF EXISTS dylan_media_read ON storage.objects;
DROP POLICY IF EXISTS dylan_media_insert ON storage.objects;
DROP POLICY IF EXISTS dylan_media_update ON storage.objects;
DROP POLICY IF EXISTS dylan_media_delete ON storage.objects;
DROP POLICY IF EXISTS dylan_documents_read ON storage.objects;
DROP POLICY IF EXISTS dylan_documents_insert ON storage.objects;

CREATE POLICY dylan_storage_read_guard ON storage.objects AS RESTRICTIVE FOR SELECT TO anon, authenticated
  USING (CASE WHEN bucket_id = 'documents' THEN
    CASE WHEN auth.uid() IS NULL THEN FALSE ELSE public.can_access_tenant_object(name) END
    ELSE TRUE END);
CREATE POLICY dylan_storage_insert_guard ON storage.objects AS RESTRICTIVE FOR INSERT TO anon, authenticated
  WITH CHECK (CASE WHEN bucket_id IN ('media', 'documents') THEN
    CASE WHEN auth.uid() IS NULL THEN FALSE ELSE public.can_access_tenant_object(name, bucket_id = 'media') END
    ELSE TRUE END);
CREATE POLICY dylan_storage_update_guard ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon, authenticated
  USING (CASE WHEN bucket_id = 'documents' THEN FALSE WHEN bucket_id = 'media' THEN
    CASE WHEN auth.uid() IS NULL THEN FALSE ELSE public.can_access_tenant_object(name, TRUE) END ELSE TRUE END)
  WITH CHECK (CASE WHEN bucket_id = 'documents' THEN FALSE WHEN bucket_id = 'media' THEN
    CASE WHEN auth.uid() IS NULL THEN FALSE ELSE public.can_access_tenant_object(name, TRUE) END ELSE TRUE END);
CREATE POLICY dylan_storage_delete_guard ON storage.objects AS RESTRICTIVE FOR DELETE TO anon, authenticated
  USING (CASE WHEN bucket_id = 'documents' THEN FALSE WHEN bucket_id = 'media' THEN
    CASE WHEN auth.uid() IS NULL THEN FALSE ELSE public.can_access_tenant_object(name, TRUE) END ELSE TRUE END);

CREATE POLICY dylan_media_read ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'media');
CREATE POLICY dylan_media_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.can_access_tenant_object(name, TRUE));
CREATE POLICY dylan_media_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.can_access_tenant_object(name, TRUE))
  WITH CHECK (bucket_id = 'media' AND public.can_access_tenant_object(name, TRUE));
CREATE POLICY dylan_media_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.can_access_tenant_object(name, TRUE));
CREATE POLICY dylan_documents_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents' AND public.can_access_tenant_object(name));
CREATE POLICY dylan_documents_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents' AND public.can_access_tenant_object(name));

COMMIT;
