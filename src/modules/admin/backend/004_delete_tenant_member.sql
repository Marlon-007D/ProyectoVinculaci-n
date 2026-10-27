-- Apply after 002_tenant_admin.sql. Local proposal; never deletes Auth accounts.
BEGIN;
CREATE OR REPLACE FUNCTION public.admin_tenant_delete_member(target_institution_id uuid, target_profile_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- Reuse scoped authority checks, self/higher-role protections and transaction lock.
  -- Any subsequent failure rolls the deactivation and module cleanup back.
  PERFORM public.admin_tenant_remove_role(target_institution_id, target_profile_id);
  DELETE FROM public.memberships
    WHERE institution_id = target_institution_id AND profile_id = target_profile_id;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_tenant_delete_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_tenant_delete_member(uuid, uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
