-- Read-only: catalog and institution module configuration, no student records.
SELECT jsonb_build_object(
  'institution', (SELECT jsonb_agg(jsonb_build_object('id', i.institution_id, 'name', i.name, 'slug', i.slug, 'active', i.is_active,
    'dece_enabled', EXISTS(SELECT 1 FROM public.module_settings ms WHERE ms.institution_id = i.institution_id AND ms.module_name = 'dece' AND ms.is_enabled)))
    FROM public.institutions i WHERE i.slug = 'ue-el-esfuerzo'),
  'tables', (SELECT jsonb_agg(jsonb_build_object('table', c.relname, 'rls', c.relrowsecurity))
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'r'
      AND (c.relname LIKE 'dece_%' OR c.relname IN ('students','form_definitions','form_versions','form_questions','form_question_options','form_submissions','form_answers'))),
  'membership_columns', (SELECT jsonb_agg(column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'memberships'),
  'functions', (SELECT jsonb_agg(jsonb_build_object('name', p.oid::regprocedure::text, 'definition', pg_get_functiondef(p.oid)))
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public'
      AND p.proname IN ('assign_institution_role','is_member_of_institution','has_institution_role','create_dece_default_forms','dece_student_portal_summary')),
  'policies', (SELECT jsonb_agg(to_jsonb(p)) FROM pg_policies p WHERE schemaname = 'public'
    AND (tablename LIKE 'dece_%' OR tablename IN ('students','form_definitions','form_versions','form_questions','form_question_options','form_submissions','form_answers')))
) AS audit;
