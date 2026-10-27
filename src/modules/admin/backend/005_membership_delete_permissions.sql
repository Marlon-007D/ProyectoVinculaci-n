-- Run once in Supabase SQL Editor after 002_tenant_admin.sql.
-- No Edge deployment or service key in the browser is required.
BEGIN;

CREATE OR REPLACE FUNCTION public.admin_tenant_can_delete_membership(
  target_institution_id uuid, target_profile_id uuid, target_role_id uuid
) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT COALESCE(
    auth.uid() IS NOT NULL
    AND target_profile_id <> auth.uid()
    AND public.admin_tenant_actor_role(target_institution_id) IN ('super_admin', 'institution_admin')
    AND NOT EXISTS (
      SELECT 1 FROM public.roles r WHERE r.role_id = target_role_id
        AND public.admin_tenant_role_name(r.name::text) = 'super_admin'
    ), false);
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_can_delete_membership(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_can_delete_membership(uuid,uuid,uuid) TO authenticated;

-- The restrictive policy also constrains any inherited permissive/global policy.
DROP POLICY IF EXISTS admin_tenant_memberships_delete_guard ON public.memberships;
CREATE POLICY admin_tenant_memberships_delete_guard ON public.memberships
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (public.admin_tenant_can_delete_membership(institution_id,profile_id,role_id));
DROP POLICY IF EXISTS admin_tenant_memberships_delete ON public.memberships;
CREATE POLICY admin_tenant_memberships_delete ON public.memberships
  FOR DELETE TO authenticated
  USING (public.admin_tenant_can_delete_membership(institution_id,profile_id,role_id));
GRANT DELETE ON public.memberships TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_tenant_cleanup_deleted_membership()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  DELETE FROM public.admin_tenant_member_modules
    WHERE institution_id = OLD.institution_id AND profile_id = OLD.profile_id;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_cleanup_deleted_membership() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS admin_tenant_cleanup_deleted_membership ON public.memberships;
CREATE TRIGGER admin_tenant_cleanup_deleted_membership AFTER DELETE ON public.memberships
  FOR EACH ROW EXECUTE FUNCTION public.admin_tenant_cleanup_deleted_membership();

NOTIFY pgrst, 'reload schema';
COMMIT;
