\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
  IF current_database() <> 'security_rls_test' OR session_user <> 'security_test' THEN
    RAISE EXCEPTION 'Run only in the disposable security_rls_test database';
  END IF;
END $$;
CREATE SCHEMA security_tests;
CREATE FUNCTION security_tests.check_true(ok BOOLEAN, message TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$ BEGIN
  IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'FAIL: %', message; END IF;
  RAISE NOTICE 'PASS: %', message;
END $$;
CREATE FUNCTION security_tests.denied(statement TEXT, message TEXT) RETURNS VOID
LANGUAGE plpgsql AS $$ BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN insufficient_privilege OR check_violation OR foreign_key_violation THEN
    RAISE NOTICE 'PASS: %', message; RETURN;
  END;
  RAISE EXCEPTION 'FAIL: unexpected permission: %', message;
END $$;
GRANT USAGE ON SCHEMA security_tests TO anon, authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA security_tests TO anon, authenticated;

INSERT INTO public.institutions (institution_id, name, slug, is_active) VALUES
 ('10000000-0000-0000-0000-000000000001','Tenant A','tenant-a',TRUE),
 ('20000000-0000-0000-0000-000000000002','Tenant B','tenant-b',TRUE),
 ('30000000-0000-0000-0000-000000000003','Inactive','inactive',FALSE);
INSERT INTO auth.users (id, email) SELECT n::text::uuid, n || '@test.invalid' FROM unnest(ARRAY[
 'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002',
 'b0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001',
 'd0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001']) AS n;
INSERT INTO public.profiles (profile_id, first_name, last_name, email, phone)
 SELECT id, 'Test', 'User', email, '0999999999' FROM auth.users;
INSERT INTO public.memberships (institution_id, profile_id, role_id, is_active)
 SELECT i::uuid, p::uuid, r.role_id, active FROM (VALUES
 ('10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','institution_admin',TRUE),
 ('10000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000002','viewer',TRUE),
 ('20000000-0000-0000-0000-000000000002','b0000000-0000-0000-0000-000000000001','institution_admin',TRUE),
 ('10000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001','super_admin',TRUE),
 ('10000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','viewer',FALSE),
 ('30000000-0000-0000-0000-000000000003','e0000000-0000-0000-0000-000000000001','institution_admin',TRUE)
 ) AS fixtures(i,p,role_name,active) JOIN public.roles r ON r.name::text = fixtures.role_name;
INSERT INTO storage.objects (bucket_id, name) VALUES
 ('media','10000000-0000-0000-0000-000000000001/logo.png'),
 ('documents','10000000-0000-0000-0000-000000000001/private.pdf'),
 ('documents','20000000-0000-0000-0000-000000000002/private.pdf');
INSERT INTO public.menus (menu_id,institution_id,label,url,position) VALUES
 ('f0000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','B','/',0);
UPDATE public.module_settings SET is_enabled = FALSE WHERE module_name = 'dece';

SET LOCAL ROLE anon;
SELECT security_tests.check_true((SELECT count(*) = 1 FROM storage.objects), 'anonymous sees only public media despite legacy allow-all');
SELECT security_tests.denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES ('documents','10000000-0000-0000-0000-000000000001/x.pdf')$q$, 'anonymous cannot upload documents');
SELECT security_tests.denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES ('media','10000000-0000-0000-0000-000000000001/x.png')$q$, 'anonymous cannot upload media');
WITH removed AS (DELETE FROM storage.objects WHERE bucket_id = 'media' RETURNING *)
SELECT security_tests.check_true((SELECT count(*) = 0 FROM removed), 'anonymous cannot delete media');
SELECT security_tests.denied('SELECT * FROM public.profiles', 'anonymous cannot read profiles');
SELECT security_tests.denied('SELECT * FROM public.module_settings', 'anonymous cannot read raw module settings');
SELECT security_tests.check_true((SELECT count(*) = 4 FROM public.get_public_enabled_modules('tenant-a')), 'public RPC exposes only enabled module names');
SELECT security_tests.check_true((SELECT count(*) = 0 FROM public.get_public_enabled_modules('inactive')), 'public RPC hides inactive institution');
SELECT security_tests.check_true((SELECT count(*) = 0 FROM public.get_public_enabled_modules('missing')), 'unknown institution returns empty');
RESET ROLE;

SET LOCAL request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT security_tests.check_true((SELECT count(*) = 3 FROM public.profiles), 'member sees own profile and active tenant peers only');
SELECT security_tests.check_true((SELECT count(*) = 3 FROM public.memberships), 'member sees active tenant memberships only');
SELECT security_tests.check_true((SELECT count(*) = 2 FROM storage.objects), 'member reads public media and own tenant documents only');
SELECT security_tests.check_true((SELECT count(*) = 5 FROM public.get_accessible_module_settings()), 'authenticated settings RPC is tenant scoped');
UPDATE public.profiles SET first_name = 'Updated' WHERE profile_id = auth.uid();
WITH changed AS (UPDATE public.profiles SET first_name = 'Intrusion' WHERE profile_id = 'b0000000-0000-0000-0000-000000000001' RETURNING *)
SELECT security_tests.check_true((SELECT count(*) = 0 FROM changed), 'member cannot update another tenant profile');
INSERT INTO storage.objects(bucket_id,name) VALUES ('documents','10000000-0000-0000-0000-000000000001/member.pdf');
SELECT security_tests.denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES ('documents','20000000-0000-0000-0000-000000000002/intrusion.pdf')$q$, 'cross-tenant document upload denied');
SELECT security_tests.denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES ('media','10000000-0000-0000-0000-000000000001/member.png')$q$, 'ordinary member cannot upload media');
SELECT security_tests.denied($q$UPDATE public.profiles SET mfa_required = FALSE WHERE profile_id = auth.uid()$q$, 'member cannot disable own MFA requirement');
SELECT security_tests.denied($q$UPDATE public.memberships SET is_active = TRUE$q$, 'member cannot reactivate or elevate memberships');
SELECT security_tests.denied($q$INSERT INTO public.menus(institution_id,label,url,position) VALUES ('10000000-0000-0000-0000-000000000001','X','/',1)$q$, 'ordinary member cannot edit menus');
WITH updated AS (UPDATE storage.objects SET name = name || '.changed' WHERE bucket_id = 'documents' RETURNING *)
SELECT security_tests.check_true((SELECT count(*) = 0 FROM updated), 'private documents cannot be edited under legacy policy');
WITH removed AS (DELETE FROM storage.objects WHERE bucket_id = 'documents' RETURNING *)
SELECT security_tests.check_true((SELECT count(*) = 0 FROM removed), 'private documents cannot be deleted under legacy policy');
RESET ROLE;

SET LOCAL request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name) VALUES ('media','10000000-0000-0000-0000-000000000001/admin.png');
WITH changed AS (UPDATE storage.objects SET name = name || '.renamed' WHERE name LIKE '%/logo.png' RETURNING *)
SELECT security_tests.check_true((SELECT count(*) = 1 FROM changed), 'institution admin can update own media');
WITH removed AS (DELETE FROM storage.objects WHERE name LIKE '%/logo.png.renamed' RETURNING *)
SELECT security_tests.check_true((SELECT count(*) = 1 FROM removed), 'institution admin can delete own media');
SELECT security_tests.denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES ('media','20000000-0000-0000-0000-000000000002/cross.png')$q$, 'institution admin cannot write another tenant media');
SELECT security_tests.denied($q$UPDATE storage.objects SET name = '20000000-0000-0000-0000-000000000002/moved.png' WHERE name LIKE '%/admin.png'$q$, 'media rename cannot cross tenants');
SELECT security_tests.denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES ('media','not-a-uuid/invalid.png')$q$, 'malformed tenant path fails closed');
SELECT security_tests.denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES ('media','10000000-0000-0000-0000-000000000001/../escape.png')$q$, 'traversal path denied');
SELECT security_tests.denied($q$INSERT INTO public.menus(institution_id,parent_id,label,url,position) VALUES ('10000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','X','/',1)$q$, 'menu parent cannot belong to another tenant');
RESET ROLE;

SET LOCAL request.jwt.claim.sub = 'c0000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name) VALUES ('media','20000000-0000-0000-0000-000000000002/superadmin.png');
SELECT security_tests.check_true((SELECT count(*) = 0 FROM storage.objects WHERE bucket_id = 'documents' AND name LIKE '20000000%'), 'superadmin requires target membership for private documents');
SELECT security_tests.check_true((SELECT count(*) = 6 FROM public.profiles), 'global admin can manage profiles');
RESET ROLE;

SET LOCAL request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT security_tests.check_true((SELECT count(*) = 1 FROM public.profiles), 'revoked member sees only own profile');
SELECT security_tests.check_true((SELECT count(*) = 0 FROM storage.objects WHERE bucket_id = 'documents'), 'revoked membership cannot read private documents');
SELECT security_tests.denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES ('documents','10000000-0000-0000-0000-000000000001/revoked.pdf')$q$, 'revoked membership cannot upload documents');
RESET ROLE;
SET LOCAL request.jwt.claim.sub = 'e0000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT security_tests.denied($q$INSERT INTO storage.objects(bucket_id,name) VALUES ('media','30000000-0000-0000-0000-000000000003/inactive.png')$q$, 'inactive institution cannot upload media');
RESET ROLE;
-- DECE authorization restored without access to other institutions.
SET LOCAL request.jwt.claim.sub = '';
UPDATE public.module_settings SET is_enabled = TRUE WHERE module_name = 'dece';
INSERT INTO public.students(student_id,institution_id,national_id,first_name,last_name) VALUES
 ('f1000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','test-a','Test','A'),
 ('f2000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','test-b','Test','B');
INSERT INTO public.dece_cases(dece_case_id,institution_id,student_id,case_number,reason,primary_category) VALUES
 ('f3000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','f1000000-0000-0000-0000-000000000001','TEST-A','Test','other'),
 ('f4000000-0000-0000-0000-000000000004','20000000-0000-0000-0000-000000000002','f2000000-0000-0000-0000-000000000002','TEST-B','Test','other');
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT security_tests.check_true((SELECT count(*) = 1 FROM public.students), 'institution admin reads only own DECE students');
SELECT security_tests.check_true((SELECT count(*) = 1 FROM public.dece_cases), 'institution admin reads only own DECE cases');
SELECT security_tests.check_true(public.can_access_dece_case('f3000000-0000-0000-0000-000000000003'), 'institution admin can access own case follow-up');
SELECT security_tests.check_true(NOT public.can_access_dece_case('f4000000-0000-0000-0000-000000000004'), 'institution admin cannot access another tenant follow-up');
SELECT public.assign_institution_role('d0000000-0000-0000-0000-000000000001@test.invalid', '10000000-0000-0000-0000-000000000001', (SELECT role_id FROM public.roles WHERE name = 'dece_staff'), 'Test', 'User', '0999999999');
SELECT security_tests.check_true((SELECT is_active FROM public.memberships WHERE profile_id = 'd0000000-0000-0000-0000-000000000001'), 'authorized reassignment reactivates membership');
SELECT security_tests.denied($q$SELECT public.assign_institution_role('d0000000-0000-0000-0000-000000000001@test.invalid', '20000000-0000-0000-0000-000000000002', (SELECT role_id FROM public.roles WHERE name = 'dece_staff'), 'Test', 'User', '0999999999')$q$, 'institution admin cannot assign roles to another tenant');
SELECT security_tests.denied($q$SELECT public.assign_institution_role('d0000000-0000-0000-0000-000000000001@test.invalid', '10000000-0000-0000-0000-000000000001', (SELECT role_id FROM public.roles WHERE name = 'institution_admin'), 'Test', 'User', '0999999999')$q$, 'institution admin cannot grant administrator privileges');
RESET ROLE;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000002';
SET LOCAL ROLE authenticated;
SELECT security_tests.check_true(NOT public.dece_has_institution_access('10000000-0000-0000-0000-000000000001'), 'ordinary viewer cannot access DECE');
RESET ROLE;
-- Cross-module regression: even an old allow-all policy / definer RPC cannot
-- bypass the added membership layer. Everything below is rolled back.
SET LOCAL request.jwt.claim.sub = '';
CREATE POLICY test_legacy_projects ON public.projects FOR ALL TO anon,authenticated USING(TRUE) WITH CHECK(TRUE);
CREATE POLICY test_legacy_budgets ON public.budget_items FOR ALL TO anon,authenticated USING(TRUE) WITH CHECK(TRUE);
CREATE POLICY test_legacy_pages ON public.pages FOR ALL TO anon,authenticated USING(TRUE) WITH CHECK(TRUE);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.projects,public.budget_items,public.pages TO anon,authenticated;
INSERT INTO public.projects(project_id,institution_id,title,total_budget,is_public) VALUES
 ('f5000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000001','Private A',100,FALSE),
 ('f6000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000001','Approved A',100,TRUE),
 ('f7000000-0000-0000-0000-000000000007','20000000-0000-0000-0000-000000000002','Private B',100,FALSE);
INSERT INTO public.budget_items(budget_item_id,project_id,name,allocated_amount) VALUES
 ('f8000000-0000-0000-0000-000000000008','f6000000-0000-0000-0000-000000000006','Budget',50);
INSERT INTO public.expenses(budget_item_id,description,amount,expense_date) VALUES
 ('f8000000-0000-0000-0000-000000000008','Test',25,CURRENT_DATE);
INSERT INTO public.pages(institution_id,slug,title,status) VALUES
 ('10000000-0000-0000-0000-000000000001','draft-a','Draft A','draft'),
 ('20000000-0000-0000-0000-000000000002','published-b','Published B','published'),
 ('20000000-0000-0000-0000-000000000002','draft-b','Draft B','draft');
CREATE FUNCTION security_tests.unsafe_project_insert(target UUID) RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  INSERT INTO public.projects(institution_id,title,total_budget) VALUES(target,'Definer write',100);
$$;
SET LOCAL request.jwt.claim.sub = 'a0000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT security_tests.check_true((SELECT count(*) = 2 FROM public.projects), 'active admin reads own projects but not another tenant private project');
SELECT security_tests.check_true((SELECT count(*) = 2 FROM public.pages), 'portal preserves own drafts and other tenant published pages only');
SELECT security_tests.denied($q$SELECT security_tests.unsafe_project_insert('20000000-0000-0000-0000-000000000002')$q$, 'definer RPC cannot write another tenant');
SELECT public.p1_update_project_budget('10000000-0000-0000-0000-000000000001','f6000000-0000-0000-0000-000000000006','f8000000-0000-0000-0000-000000000008','Updated',40);
SELECT security_tests.check_true((SELECT allocated_amount = 40 FROM public.budget_items WHERE budget_item_id = 'f8000000-0000-0000-0000-000000000008'), 'budget adapter preserves legitimate edits');
SELECT security_tests.denied($q$SELECT public.p1_update_project_budget('10000000-0000-0000-0000-000000000001','f6000000-0000-0000-0000-000000000006','f8000000-0000-0000-0000-000000000008','Invalid',20)$q$, 'budget cannot be reduced below spent amount');
SELECT security_tests.denied($q$SELECT public.p1_update_project_budget('10000000-0000-0000-0000-000000000001','f6000000-0000-0000-0000-000000000006','f8000000-0000-0000-0000-000000000008','Invalid',1000)$q$, 'budget cannot exceed project total');
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '';
SET LOCAL ROLE anon;
SELECT security_tests.check_true((SELECT count(*) = 1 FROM public.projects), 'public projects exclude private records');
SELECT security_tests.check_true((SELECT count(*) = 0 FROM public.budget_items), 'raw financial rows remain private');
SELECT security_tests.check_true((SELECT count(*) = 1 FROM public.pages), 'public portal cannot read drafts under legacy allow-all');
SELECT security_tests.check_true((SELECT spent = 25 AND balance = 75 FROM public.p1_public_project_summaries('tenant-a')), 'public financial RPC exposes approved aggregate only');
RESET ROLE;
UPDATE public.memberships SET is_active = FALSE WHERE profile_id = 'd0000000-0000-0000-0000-000000000001';
SET LOCAL request.jwt.claim.sub = 'd0000000-0000-0000-0000-000000000001';
SET LOCAL ROLE authenticated;
SELECT security_tests.check_true((SELECT count(*) = 1 FROM public.projects), 'revoked user can only read public projects');
SELECT security_tests.denied($q$SELECT security_tests.unsafe_project_insert('10000000-0000-0000-0000-000000000001')$q$, 'definer RPC cannot bypass revoked membership');
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '';
UPDATE public.module_settings SET is_enabled = FALSE WHERE module_name = 'portal';
SET LOCAL ROLE anon;
SELECT security_tests.check_true((SELECT count(*) = 0 FROM public.pages), 'disabled portal hides previously published pages');
RESET ROLE;
ROLLBACK;
