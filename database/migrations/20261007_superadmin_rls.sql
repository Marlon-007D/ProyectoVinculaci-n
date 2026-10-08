-- Permite que la aplicación lea la membresía inicial del usuario y que
-- super_admin administre instituciones y membresías entre instituciones.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.memberships AS m
        JOIN public.roles AS r ON r.role_id = m.role_id
        WHERE m.profile_id = auth.uid()
          AND r.name = 'super_admin'
    );
$$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

DROP POLICY IF EXISTS institutions_tenant_policy ON public.institutions;
CREATE POLICY institutions_tenant_policy ON public.institutions
    FOR ALL TO authenticated
    USING (institution_id = public.get_current_institution_id() OR public.is_super_admin())
    WITH CHECK (institution_id = public.get_current_institution_id() OR public.is_super_admin());

DROP POLICY IF EXISTS module_settings_tenant_policy ON public.module_settings;
CREATE POLICY module_settings_tenant_policy ON public.module_settings
    FOR ALL TO authenticated
    USING (institution_id = public.get_current_institution_id() OR public.is_super_admin())
    WITH CHECK (institution_id = public.get_current_institution_id() OR public.is_super_admin());

DROP POLICY IF EXISTS memberships_tenant_policy ON public.memberships;
CREATE POLICY memberships_tenant_policy ON public.memberships
    FOR ALL TO authenticated
    USING (institution_id = public.get_current_institution_id() OR public.is_super_admin())
    WITH CHECK (institution_id = public.get_current_institution_id() OR public.is_super_admin());

DROP POLICY IF EXISTS memberships_self_read ON public.memberships;
CREATE POLICY memberships_self_read ON public.memberships
    FOR SELECT TO authenticated
    USING (profile_id = auth.uid());

DROP POLICY IF EXISTS profiles_super_admin_read ON public.profiles;
CREATE POLICY profiles_super_admin_read ON public.profiles
    FOR SELECT TO authenticated
    USING (public.is_super_admin());

DROP POLICY IF EXISTS audit_events_tenant_policy ON public.audit_events;
CREATE POLICY audit_events_tenant_policy ON public.audit_events
    FOR SELECT TO authenticated
    USING (institution_id = public.get_current_institution_id() OR public.is_super_admin());

DROP POLICY IF EXISTS audit_events_insert_authenticated ON public.audit_events;
CREATE POLICY audit_events_insert_authenticated ON public.audit_events
    FOR INSERT TO authenticated
    WITH CHECK (
        profile_id = auth.uid()
        AND (public.is_super_admin() OR institution_id = public.get_current_institution_id())
    );
