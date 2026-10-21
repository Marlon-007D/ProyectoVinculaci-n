-- Comprobantes privados de proyectos. Requiere revisión de Storage y permisos.
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('project-receipts','project-receipts',false,10485760,ARRAY['application/pdf','image/png','image/jpeg'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.project_receipt_access(object_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.expenses e JOIN public.budget_items b USING(budget_item_id)
 JOIN public.projects p USING(project_id) WHERE e.expense_id::text=split_part(object_path,'/',2)
 AND p.institution_id::text=split_part(object_path,'/',1)
 AND array_length(string_to_array(object_path,'/'),1)=3 AND split_part(object_path,'/',3)<>''
 AND public.project_can_manage(p.institution_id));
$$;
REVOKE ALL ON FUNCTION public.project_receipt_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_receipt_access(text) TO authenticated;

DROP POLICY IF EXISTS project_receipts_private ON storage.objects;
CREATE POLICY project_receipts_private ON storage.objects AS RESTRICTIVE TO authenticated
USING(bucket_id<>'project-receipts' OR public.project_receipt_access(name))
WITH CHECK(bucket_id<>'project-receipts' OR public.project_receipt_access(name));
DROP POLICY IF EXISTS project_receipts_no_anon ON storage.objects;
CREATE POLICY project_receipts_no_anon ON storage.objects AS RESTRICTIVE TO anon
USING(bucket_id<>'project-receipts') WITH CHECK(bucket_id<>'project-receipts');
DROP POLICY IF EXISTS project_receipts_read ON storage.objects;
CREATE POLICY project_receipts_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='project-receipts' AND public.project_receipt_access(name));
DROP POLICY IF EXISTS project_receipts_insert ON storage.objects;
CREATE POLICY project_receipts_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='project-receipts' AND public.project_receipt_access(name));
DROP POLICY IF EXISTS project_receipts_delete ON storage.objects;
CREATE POLICY project_receipts_delete ON storage.objects FOR DELETE TO authenticated
USING(bucket_id='project-receipts' AND public.project_receipt_access(name));

REVOKE ALL ON public.expense_files FROM anon;
REVOKE ALL ON public.expense_files FROM authenticated;
GRANT SELECT,INSERT,DELETE ON public.expense_files TO authenticated;
DROP POLICY IF EXISTS project_receipt_metadata_scope ON public.expense_files;
CREATE POLICY project_receipt_metadata_scope ON public.expense_files AS RESTRICTIVE TO authenticated
USING(split_part(file_path,'/',2)=expense_id::text AND public.project_receipt_access(file_path))
WITH CHECK(split_part(file_path,'/',2)=expense_id::text AND public.project_receipt_access(file_path));
DROP POLICY IF EXISTS project_receipt_metadata_read ON public.expense_files;
CREATE POLICY project_receipt_metadata_read ON public.expense_files FOR SELECT TO authenticated USING(public.project_receipt_access(file_path));
DROP POLICY IF EXISTS project_receipt_metadata_insert ON public.expense_files;
CREATE POLICY project_receipt_metadata_insert ON public.expense_files FOR INSERT TO authenticated
WITH CHECK(public.project_receipt_access(file_path) AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='project-receipts' AND o.name=file_path));
DROP POLICY IF EXISTS project_receipt_metadata_delete ON public.expense_files;
CREATE POLICY project_receipt_metadata_delete ON public.expense_files FOR DELETE TO authenticated USING(public.project_receipt_access(file_path));
COMMIT;
