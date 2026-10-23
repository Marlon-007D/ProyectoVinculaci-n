-- SOLO LECTURA: devuelve estructura y permisos, sin registros ni credenciales.
-- Ejecutar en una consulta NUEVA del SQL Editor y copiar la única celda resultado.
WITH required_functions(signature) AS (
 VALUES ('public.is_super_admin()'), ('public.projects_session_verified()'),
 ('public.project_module_enabled(uuid)'), ('public.project_can_manage(uuid)'),
 ('public.project_can_publish(uuid)'), ('public.project_operation(uuid,text,jsonb)'),
 ('public.project_receipt_access(text)'), ('public.project_member_options(uuid)'),
 ('public.portal_editor_allowed(uuid,boolean)'),
 ('public.portal_editor_save(uuid,uuid,integer,jsonb,boolean)'),
 ('public.get_accessible_module_settings()'), ('auth.uid()'), ('auth.jwt()')
), required_tables(name) AS (
 SELECT unnest(ARRAY['institutions','profiles','memberships','roles','module_settings',
 'projects','budget_items','expenses','project_members','expense_files','audit_events',
 'academic_periods','pages','page_sections','section_type_schemas',
 'publication_versions','portal_editor_drafts','themes','site_settings','menus'])
), table_details AS (
 SELECT r.name,
 to_regclass('public.'||r.name) IS NOT NULL AS present,
 (SELECT c.relrowsecurity FROM pg_class c WHERE c.oid=to_regclass('public.'||r.name)) AS rls,
 (SELECT jsonb_object_agg(c.column_name,c.udt_name ORDER BY c.ordinal_position)
 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=r.name) AS columns
 FROM required_tables r
)
SELECT jsonb_pretty(jsonb_build_object(
 'functions',(SELECT jsonb_object_agg(signature,to_regprocedure(signature) IS NOT NULL) FROM required_functions),
 'tables',(SELECT jsonb_agg(to_jsonb(t) ORDER BY name) FROM table_details t),
 'access_definitions',(SELECT coalesce(jsonb_agg(jsonb_build_object(
 'signature',p.oid::regprocedure::text,'definition',pg_get_functiondef(p.oid)) ORDER BY p.proname),'[]'::jsonb)
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public' AND p.prokind='f' AND p.proname IN (
 'is_super_admin','projects_session_verified','project_module_enabled',
 'project_can_manage','project_can_publish','project_receipt_access','portal_editor_allowed')),
 'project_policies',(SELECT coalesce(jsonb_agg(jsonb_build_object(
 'table',tablename,'policy',policyname,'roles',roles,'command',cmd,
 'mode',permissive,'using',qual,'check',with_check) ORDER BY tablename,policyname),'[]'::jsonb)
 FROM pg_policies WHERE schemaname='public' AND tablename IN ('projects','budget_items','expenses','project_members','expense_files')),
 'storage_tables',jsonb_build_object('objects',to_regclass('storage.objects') IS NOT NULL,'buckets',to_regclass('storage.buckets') IS NOT NULL)
)) AS resultado;
