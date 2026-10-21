-- Imágenes públicas de identidad institucional; requiere portal_editor_atomic.
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('portal-assets','portal-assets',true,5242880,ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=true,file_size_limit=5242880,allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.portal_asset_can_upload(object_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tenant uuid;
BEGIN
 IF object_path !~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(png|jpg|webp)$' THEN RETURN false; END IF;
 BEGIN tenant:=split_part(object_path,'/',1)::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
 RETURN public.portal_editor_allowed(tenant,false);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_asset_can_upload(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_asset_can_upload(text) TO authenticated;

DROP POLICY IF EXISTS portal_assets_insert ON storage.objects;
CREATE POLICY portal_assets_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='portal-assets' AND public.portal_asset_can_upload(name));
DROP POLICY IF EXISTS portal_assets_insert_scope ON storage.objects;
CREATE POLICY portal_assets_insert_scope ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(bucket_id<>'portal-assets' OR public.portal_asset_can_upload(name));
DROP POLICY IF EXISTS portal_assets_no_anon_writes ON storage.objects;
CREATE POLICY portal_assets_no_anon_writes ON storage.objects AS RESTRICTIVE FOR INSERT TO anon
WITH CHECK(bucket_id<>'portal-assets');
-- Versioned URLs are immutable. Deletion/retention is an administrative operation,
-- so replacing a logo cannot break another page that still references the image.
DROP POLICY IF EXISTS portal_assets_no_updates ON storage.objects;
CREATE POLICY portal_assets_no_updates ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
USING(bucket_id<>'portal-assets') WITH CHECK(bucket_id<>'portal-assets');
DROP POLICY IF EXISTS portal_assets_no_deletes ON storage.objects;
CREATE POLICY portal_assets_no_deletes ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(bucket_id<>'portal-assets');
COMMIT;
