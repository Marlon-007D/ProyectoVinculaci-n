\set ON_ERROR_STOP on
-- ONLY run in the disposable local database, never a shared Supabase project.
DO $$ BEGIN
  IF current_database() <> 'security_rls_test' OR session_user <> 'security_test' THEN
    RAISE EXCEPTION 'This fixture requires the disposable security_rls_test database and security_test owner';
  END IF;
END $$;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE SCHEMA storage;
CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT, raw_user_meta_data JSONB DEFAULT '{}');
CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE FUNCTION auth.jwt() RETURNS JSONB LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb, '{}'::jsonb);
$$;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
CREATE TABLE storage.buckets (id TEXT PRIMARY KEY, name TEXT NOT NULL, public BOOLEAN DEFAULT FALSE);
CREATE TABLE storage.objects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id TEXT REFERENCES storage.buckets(id), name TEXT NOT NULL);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated;
-- Simulate a dangerous policy already present in the shared project.
CREATE POLICY legacy_allow_everything ON storage.objects FOR ALL TO anon, authenticated USING (TRUE) WITH CHECK (TRUE);
\ir ../../database/script.sql
\ir ../../database/superadmin.sql
\ir ../migrations/20261014180000_profile_phone_and_role_assignment.sql
\ir ../migrations/20261014190000_fix_legacy_profile_mfa_phone_check.sql
\ir ../migrations/20261014200000_institution_module_management.sql
\ir ../migrations/20261014210000_secure_institution_membership_listing.sql
CREATE POLICY "Permitir lectura de perfiles a autenticados" ON public.profiles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Permitir lectura de membresias a autenticados" ON public.memberships FOR SELECT TO authenticated USING (TRUE);
\ir ../migrations/20261020100000_core_tenant_security.sql
\ir ../migrations/20261020110000_tenant_storage.sql
\ir ../migrations/20261020120000_invitation_profile_permissions.sql
\ir ../migrations/20261020130000_institution_admin_dece_access.sql
\ir ../migrations/20261020140000_institution_role_assignment.sql
\ir ../migrations/20261020150000_cross_module_active_membership.sql
\ir ../migrations/20261020160000_project_budget_edit_adapter.sql
-- Reapplication must be safe and preserve unrelated bucket policies.
\ir ../migrations/20261020100000_core_tenant_security.sql
\ir ../migrations/20261020110000_tenant_storage.sql
