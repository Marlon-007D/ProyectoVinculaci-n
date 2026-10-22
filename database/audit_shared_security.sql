-- Read-only inventory. Execute in the OFFICIAL shared project before migration.
-- Export the resulting JSON; no profile data, tokens or document names included.
BEGIN READ ONLY;
SELECT jsonb_pretty(jsonb_build_object(
  'captured_at', CURRENT_TIMESTAMP,
  'tables', (SELECT jsonb_agg(jsonb_build_object('table', table_name, 'column', column_name,
    'type', data_type, 'nullable', is_nullable) ORDER BY table_name, ordinal_position)
    FROM information_schema.columns WHERE table_schema = 'public'
      AND table_name IN ('profiles','memberships','institution_memberships','institutions','menus','module_settings','tenant_modules')),
  'policies', (SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p
    WHERE schemaname = 'public' OR (schemaname = 'storage' AND tablename = 'objects')),
  'rls', (SELECT jsonb_agg(jsonb_build_object('schema', n.nspname, 'table', c.relname, 'enabled', c.relrowsecurity))
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public','storage') AND c.relkind = 'r'),
  'constraints', (SELECT jsonb_agg(jsonb_build_object('table', conrelid::regclass::text,
    'name', conname, 'definition', pg_get_constraintdef(oid)))
    FROM pg_constraint WHERE conrelid IN ('public.menus'::regclass, 'public.profiles'::regclass)),
  'buckets', (SELECT jsonb_agg(jsonb_build_object('id', id, 'public', public)) FROM storage.buckets),
  'functions', (SELECT jsonb_agg(jsonb_build_object('name', p.oid::regprocedure::text,
    'security_definer', p.prosecdef, 'config', p.proconfig, 'definition', pg_get_functiondef(p.oid)))
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname IN ('is_super_admin','is_member_of_institution',
      'has_institution_role','get_public_enabled_modules','get_accessible_module_settings','can_access_tenant_object')),
  'grants', (SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.role_table_grants g
    WHERE table_schema = 'public' AND table_name IN ('profiles','memberships','module_settings','menus'))
));
-- Supabase migration ledger is deliberately separate: absence is not evidence
-- that a migration did not run manually. Run only when that table exists.
SELECT to_regclass('supabase_migrations.schema_migrations') AS migration_ledger;
-- If present, also export:
-- SELECT version, name FROM supabase_migrations.schema_migrations ORDER BY version;
ROLLBACK;
