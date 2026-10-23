-- SOLO LECTURA. Ejecutar en SQL Editor después de la actualización y las pruebas.
SELECT to_regprocedure('public.projects_session_verified()') IS NOT NULL AS verificacion_sesion,
       to_regprocedure('public.project_receipt_access(text)') IS NOT NULL AS permisos_comprobantes,
       to_regprocedure('public.project_member_options(uuid)') IS NOT NULL AS participantes,
       to_regprocedure('public.project_read(uuid,uuid,integer,integer)') IS NOT NULL AS lectura_completa,
       to_regprocedure('public.project_retire_receipt(uuid,uuid,uuid)') IS NOT NULL AS retiro_logico_comprobantes,
       to_regprocedure('public.portal_editor_retention_version()') IS NOT NULL AS historial_portal;
SELECT id,public FROM storage.buckets WHERE id IN ('project-receipts','portal-assets') ORDER BY id;
SELECT 'projects' AS tabla,count(*) AS total,count(deleted_at) AS retirados FROM public.projects
UNION ALL SELECT 'budget_items',count(*),count(deleted_at) FROM public.budget_items
UNION ALL SELECT 'expenses',count(*),count(deleted_at) FROM public.expenses
UNION ALL SELECT 'project_members',count(*),count(deleted_at) FROM public.project_members
UNION ALL SELECT 'expense_files',count(*),count(deleted_at) FROM public.expense_files
UNION ALL SELECT 'page_sections',count(*),count(deleted_at) FROM public.page_sections
UNION ALL SELECT 'menus',count(*),count(deleted_at) FROM public.menus;
SELECT action,count(*) AS operaciones FROM public.audit_events WHERE action LIKE 'PROJECT_%' GROUP BY action ORDER BY action;
-- Deben aparecer las políticas restrictivas de conservación y ocultación de historial.
SELECT schemaname,tablename,policyname,permissive,cmd FROM pg_policies
WHERE policyname IN ('project_receipts_retain','project_receipts_no_overwrite','page_sections_live_only','menus_live_only','publication_versions_published_only') ORDER BY tablename,policyname;
