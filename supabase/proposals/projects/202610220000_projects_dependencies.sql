-- Dependencias del CRUD sobre las tablas institucionales ya existentes.
-- No altera cuentas, configuración MFA ni la función compartida is_super_admin.
BEGIN;
CREATE OR REPLACE FUNCTION public.projects_session_verified()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.profile_id=auth.uid()
 AND (p.mfa_required OR p.mfa_enabled) AND coalesce(auth.jwt()->>'aal','aal1')<>'aal2');
$$;
REVOKE ALL ON FUNCTION public.projects_session_verified() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.projects_session_verified() TO authenticated;
CREATE OR REPLACE FUNCTION public.project_module_enabled(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.institutions i JOIN public.module_settings m USING(institution_id)
 WHERE i.institution_id=target AND i.is_active AND m.module_name='projects' AND m.is_enabled);
$$;

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
REVOKE ALL ON FUNCTION public.project_receipt_access(text) FROM PUBLIC,anon;
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

ALTER TABLE public.expense_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expense_files FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.expense_files TO authenticated;
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
COMMIT;
