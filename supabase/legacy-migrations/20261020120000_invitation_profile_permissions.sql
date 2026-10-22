-- Invitation recovery: service_role bypasses RLS, but still needs SQL grants.
-- Existing profiles can be created by the Auth trigger before the Edge upsert.
BEGIN;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS mfa_required BOOLEAN NOT NULL DEFAULT FALSE;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.roles, public.institutions TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.profiles, public.memberships TO service_role;

-- Refresh PostgREST after adding a column missing in an older shared schema.
NOTIFY pgrst, 'reload schema';
COMMIT;
