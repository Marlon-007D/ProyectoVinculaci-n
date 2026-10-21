-- Additive security layer. No team table, function or existing policy is replaced.
BEGIN;
CREATE SCHEMA IF NOT EXISTS app_security;
REVOKE ALL ON SCHEMA app_security FROM PUBLIC;
GRANT USAGE ON SCHEMA app_security TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION app_security.module_for_table(t TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN t IN ('projects','budget_items','expenses','expense_files','project_members') THEN 'projects'
    WHEN t LIKE 'dece_%' OR t IN ('students','student_family_members','student_emergency_contacts','form_definitions','form_versions','form_questions','form_question_options','form_submissions','form_answers','form_answer_options') THEN 'dece'
    WHEN t IN ('invoice_products','invoices','invoice_items','simulation_settings') THEN 'simuladores'
    WHEN t IN ('themes','site_settings','pages','page_sections','menus','publication_versions','media_assets','news','events','staff','honors') THEN 'portal'
    ELSE NULL END;
$$;

CREATE OR REPLACE FUNCTION app_security.module_enabled(tenant UUID, module_name TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.institutions i WHERE i.institution_id = tenant AND i.is_active)
    AND (module_name IS NULL OR EXISTS (
      SELECT 1 FROM public.module_settings s
      WHERE s.institution_id = tenant AND s.module_name = module_enabled.module_name AND s.is_enabled));
$$;

CREATE OR REPLACE FUNCTION app_security.active_member(tenant UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.institutions i WHERE i.institution_id = tenant AND i.is_active
      AND (public.is_super_admin() OR EXISTS (
        SELECT 1 FROM public.memberships m WHERE m.institution_id = tenant
          AND m.profile_id = auth.uid() AND m.is_active)));
$$;

-- Resolve real FK chains; never infer a tenant from client JWT metadata.
CREATE OR REPLACE FUNCTION app_security.row_tenant(t TEXT, r JSONB, depth INTEGER DEFAULT 0)
RETURNS UUID LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE parent_table TEXT; parent_key TEXT; foreign_key TEXT; parent_row JSONB;
BEGIN
  IF depth > 8 THEN RETURN NULL; END IF;
  IF r ? 'institution_id' THEN RETURN (r->>'institution_id')::UUID; END IF;
  IF r ? 'tenant_id' THEN RETURN (r->>'tenant_id')::UUID; END IF;
  CASE
    WHEN t IN ('budget_items','project_members') THEN parent_table := 'projects'; parent_key := 'project_id'; foreign_key := 'project_id';
    WHEN t = 'expenses' THEN parent_table := 'budget_items'; parent_key := 'budget_item_id'; foreign_key := 'budget_item_id';
    WHEN t = 'expense_files' THEN parent_table := 'expenses'; parent_key := 'expense_id'; foreign_key := 'expense_id';
    WHEN t IN ('page_sections','publication_versions') THEN parent_table := 'pages'; parent_key := 'page_id'; foreign_key := 'page_id';
    WHEN t IN ('dece_visits','dece_actions','dece_documents','dece_case_assignments') THEN parent_table := 'dece_cases'; parent_key := 'dece_case_id'; foreign_key := 'dece_case_id';
    WHEN t = 'dece_observations' THEN parent_table := 'dece_visits'; parent_key := 'dece_visit_id'; foreign_key := 'dece_visit_id';
    WHEN t IN ('student_family_members','student_emergency_contacts','form_submissions') THEN parent_table := 'students'; parent_key := 'student_id'; foreign_key := 'student_id';
    WHEN t = 'form_versions' THEN parent_table := 'form_definitions'; parent_key := 'form_definition_id'; foreign_key := 'form_definition_id';
    WHEN t = 'form_questions' THEN parent_table := 'form_versions'; parent_key := 'form_version_id'; foreign_key := 'form_version_id';
    WHEN t = 'form_question_options' THEN parent_table := 'form_questions'; parent_key := 'form_question_id'; foreign_key := 'form_question_id';
    WHEN t = 'form_answers' THEN parent_table := 'form_submissions'; parent_key := 'form_submission_id'; foreign_key := 'form_submission_id';
    WHEN t = 'form_answer_options' THEN parent_table := 'form_answers'; parent_key := 'form_answer_id'; foreign_key := 'form_answer_id';
    WHEN t = 'invoice_items' THEN parent_table := 'invoices'; parent_key := 'id'; foreign_key := 'invoice_id';
    ELSE RETURN NULL;
  END CASE;
  EXECUTE format('SELECT to_jsonb(p) FROM public.%I p WHERE %I = $1', parent_table, parent_key)
    INTO parent_row USING (r->>foreign_key)::UUID;
  IF parent_row IS NULL THEN RETURN NULL; END IF;
  RETURN app_security.row_tenant(parent_table, parent_row, depth + 1);
END;
$$;

CREATE OR REPLACE FUNCTION app_security.member_row(t TEXT, r JSONB)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT CASE WHEN app_security.row_tenant(t,r) IS NULL THEN
    -- Keep the simulator's existing anonymous-session policies authoritative.
    t IN ('invoice_products','invoices','invoice_items')
  ELSE app_security.active_member(app_security.row_tenant(t,r))
    AND app_security.module_enabled(app_security.row_tenant(t,r), app_security.module_for_table(t)) END;
$$;

CREATE OR REPLACE FUNCTION app_security.read_row(t TEXT, r JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE tenant UUID := app_security.row_tenant(t,r); visible BOOLEAN := FALSE;
BEGIN
  IF app_security.member_row(t,r) THEN RETURN TRUE; END IF;
  IF t = 'projects' THEN
    RETURN app_security.module_enabled(tenant,'projects') AND COALESCE((r->>'is_public')::BOOLEAN,FALSE) AND COALESCE((r->>'is_active')::BOOLEAN,TRUE);
  END IF;
  IF NOT app_security.module_enabled(tenant,'portal') THEN RETURN FALSE; END IF;
  CASE
    WHEN t IN ('themes','site_settings','menus','events') THEN visible := TRUE;
    WHEN t IN ('media_assets','staff') THEN visible := COALESCE((r->>'is_public')::BOOLEAN,FALSE);
    WHEN t = 'news' THEN visible := COALESCE((r->>'is_published')::BOOLEAN,FALSE) AND (r->>'published_at' IS NULL OR (r->>'published_at')::TIMESTAMPTZ <= CURRENT_TIMESTAMP);
    WHEN t = 'pages' THEN visible := r->>'status' = 'published';
    WHEN t IN ('page_sections','publication_versions') THEN
      SELECT p.status::TEXT = 'published' INTO visible FROM public.pages p WHERE p.page_id = (r->>'page_id')::UUID;
      IF t = 'page_sections' THEN visible := visible AND COALESCE((r->>'is_visible')::BOOLEAN,FALSE);
      ELSE visible := visible AND COALESCE(r->'content_snapshot'->>'publication_state','published') = 'published'; END IF;
    ELSE visible := FALSE;
  END CASE;
  RETURN COALESCE(visible,FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION app_security.manage_row(t TEXT, r JSONB)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT app_security.member_row(t,r) AND (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.memberships m JOIN public.roles role ON role.role_id = m.role_id
      WHERE m.profile_id = auth.uid() AND m.is_active AND m.institution_id = app_security.row_tenant(t,r)
        AND (role.name::TEXT = 'institution_admin'
          OR (app_security.module_for_table(t) = 'portal' AND role.name::TEXT = 'editor')
          OR (app_security.module_for_table(t) = 'dece' AND role.name::TEXT = 'dece_staff'))));
$$;

-- SECURITY DEFINER module RPCs bypass RLS, but cannot bypass this write trigger.
CREATE OR REPLACE FUNCTION app_security.check_active_write()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL AND COALESCE(current_setting('role',TRUE),'none') NOT IN ('anon','authenticated') THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  -- FK cascades are authorized by the checked parent operation.
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP <> 'INSERT' AND NOT app_security.member_row(TG_TABLE_NAME,to_jsonb(OLD)) THEN
    RAISE EXCEPTION 'La membresia o el modulo de esta institucion no esta activo.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP <> 'DELETE' AND NOT app_security.member_row(TG_TABLE_NAME,to_jsonb(NEW)) THEN
    RAISE EXCEPTION 'No puedes escribir datos de esta institucion.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA app_security FROM PUBLIC;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app_security TO anon, authenticated, service_role;

DO $$
DECLARE t TEXT; guard TEXT; readable TEXT; cmd TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','budget_items','expenses','expense_files','project_members',
    'themes','site_settings','pages','page_sections','menus','publication_versions','media_assets','news','events','staff','honors','academic_periods',
    'students','student_family_members','student_emergency_contacts','dece_cases','dece_visits','dece_observations','dece_actions','dece_documents','dece_case_assignments',
    'form_definitions','form_versions','form_questions','form_question_options','form_submissions','form_answers','form_answer_options',
    'invoice_products','invoices','invoice_items','simulation_settings'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
    guard := format('app_security.member_row(%L,to_jsonb(%I))',t,t);
    readable := format('app_security.read_row(%L,to_jsonb(%I))',t,t);
    FOREACH cmd IN ARRAY ARRAY['select','insert','update','delete'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS p1_active_%s ON public.%I',cmd,t);
    END LOOP;
    EXECUTE format('CREATE POLICY p1_active_select ON public.%I AS RESTRICTIVE FOR SELECT TO anon,authenticated USING (%s)',t,readable);
    EXECUTE format('CREATE POLICY p1_active_insert ON public.%I AS RESTRICTIVE FOR INSERT TO anon,authenticated WITH CHECK (%s)',t,guard);
    EXECUTE format('CREATE POLICY p1_active_update ON public.%I AS RESTRICTIVE FOR UPDATE TO anon,authenticated USING (%s) WITH CHECK (%s)',t,guard,guard);
    EXECUTE format('CREATE POLICY p1_active_delete ON public.%I AS RESTRICTIVE FOR DELETE TO anon,authenticated USING (%s)',t,guard);
    EXECUTE format('DROP TRIGGER IF EXISTS p1_check_active_write ON public.%I',t);
    EXECUTE format('CREATE TRIGGER p1_check_active_write BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app_security.check_active_write()',t);
    -- Supplement JWT-only legacy policies for portal editors and tenant admins.
    IF t IN ('themes','site_settings','menus','publication_versions','media_assets','news','events','staff','honors','simulation_settings','academic_periods','student_family_members','student_emergency_contacts') THEN
      EXECUTE format('DROP POLICY IF EXISTS p1_module_manager ON public.%I',t);
      EXECUTE format('CREATE POLICY p1_module_manager ON public.%I FOR ALL TO authenticated USING (app_security.manage_row(%L,to_jsonb(%I))) WITH CHECK (app_security.manage_row(%L,to_jsonb(%I)))',t,t,t,t,t);
      EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO authenticated',t);
    END IF;
  END LOOP;
  -- Explicitly published projects only; budgets and receipts stay private.
  DROP POLICY IF EXISTS p1_public_projects ON public.projects;
  CREATE POLICY p1_public_projects ON public.projects FOR SELECT TO anon,authenticated
    USING (is_public AND app_security.module_enabled(institution_id,'projects'));
  GRANT SELECT ON public.projects TO anon;
  DROP POLICY IF EXISTS p1_project_receipts ON public.expense_files;
  CREATE POLICY p1_project_receipts ON public.expense_files FOR ALL TO authenticated
    USING (app_security.member_row('expense_files',to_jsonb(expense_files)) AND
      (public.is_super_admin() OR public.has_institution_role(app_security.row_tenant('expense_files',to_jsonb(expense_files)), ARRAY['institution_admin','project_manager']::public.user_role_type[])))
    WITH CHECK (app_security.member_row('expense_files',to_jsonb(expense_files)) AND
      (public.is_super_admin() OR public.has_institution_role(app_security.row_tenant('expense_files',to_jsonb(expense_files)), ARRAY['institution_admin','project_manager']::public.user_role_type[])));
  GRANT SELECT,INSERT,UPDATE,DELETE ON public.expense_files TO authenticated;
  DROP POLICY IF EXISTS p1_academic_periods_read ON public.academic_periods;
  CREATE POLICY p1_academic_periods_read ON public.academic_periods FOR SELECT TO authenticated
    USING (app_security.active_member(institution_id));
END;
$$;
NOTIFY pgrst,'reload schema';
COMMIT;
