-- SOLO LECTURA. Revisa presencia; no acredita compatibilidad de columnas o RLS.
SELECT name AS required_table, to_regclass('public.' || name) IS NOT NULL AS present
FROM unnest(ARRAY['institutions','profiles','memberships','roles','module_settings',
 'projects','budget_items','expenses','project_members','expense_files','audit_events',
 'pages','page_sections','section_type_schemas','publication_versions','themes','site_settings','menus']) AS name;
SELECT signature AS shared_function, to_regprocedure(signature) IS NOT NULL AS present
FROM unnest(ARRAY['public.is_super_admin()','public.get_accessible_module_settings()']) AS signature;
SELECT name AS storage_table, to_regclass(name) IS NOT NULL AS present
FROM unnest(ARRAY['storage.objects','storage.buckets']) AS name;
