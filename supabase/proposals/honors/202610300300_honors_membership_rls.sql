-- PROPUESTA, NO APLICADA. RLS de distinciones y períodos basada en membresía activa (no en "una institución por sesión").
-- Causa: honors_tenant_policy y academic_periods_tenant_policy (drizzle/0012) comparan con get_current_institution_id(),
-- que devuelve UNA institución. Un institution_admin con membresía en varias solo ve la actual.
-- Parte A: diagnóstico (solo lectura). Parte B: reemplazo de políticas. Parte C: reversión.

-- ============================== A. DIAGNÓSTICO ==============================
-- A1. Qué institución devuelve hoy la función para el admin (pega su UUID).
--   SELECT set_config('request.jwt.claims', json_build_object('sub', '<UUID-DEL-ADMIN>', 'role', 'authenticated')::text, true);
--   SET LOCAL ROLE authenticated; SELECT public.get_current_institution_id(); RESET ROLE;
-- A2. Cuerpo de la función (el repo no la define; confirma de dónde toma la institución).
SELECT pg_get_functiondef('public.get_current_institution_id()'::regprocedure);
-- A3. Todas las políticas que dependen de ella (honors, academic_periods, events, students u otras).
SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check
  FROM pg_policies
 WHERE coalesce(qual, '') ILIKE '%get_current_institution_id%' OR coalesce(with_check, '') ILIKE '%get_current_institution_id%'
 ORDER BY tablename, policyname;
-- A4. Helpers que usa esta propuesta (deben existir; news ya los usa en supabase/migrations/20261023052527).
SELECT proname, pg_get_function_identity_arguments(oid) FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace AND proname IN ('is_super_admin', 'has_institution_role');
-- A5. Roles que acepta has_institution_role.
SELECT enum_range(NULL::public.user_role_type);

-- ============================== B. REEMPLAZAR POLÍTICAS ==============================
BEGIN;

-- B1. honors: lectura por membresía activa (o superadmin).
DROP POLICY IF EXISTS honors_tenant_policy ON public.honors;
CREATE POLICY honors_member_read ON public.honors FOR SELECT TO authenticated
  USING (public.is_super_admin()
         OR institution_id IN (SELECT m.institution_id FROM public.memberships m WHERE m.profile_id = auth.uid() AND m.is_active));

-- B2. honors: escritura solo del administrador (o editor de contenido) de ESA institución.
CREATE POLICY honors_editor_insert ON public.honors FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin', 'editor']::public.user_role_type[]));
CREATE POLICY honors_editor_update ON public.honors FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin', 'editor']::public.user_role_type[]))
  WITH CHECK (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin', 'editor']::public.user_role_type[]));
CREATE POLICY honors_editor_delete ON public.honors FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin', 'editor']::public.user_role_type[]));

-- B3. honors publicadas de instituciones activas: legibles para cualquier sesión autenticada (igual que anon).
CREATE POLICY honors_published_authenticated_read ON public.honors FOR SELECT TO authenticated
  USING (status = 'published'
         AND EXISTS (SELECT 1 FROM public.institutions i WHERE i.institution_id = honors.institution_id AND i.is_active));

-- B4. academic_periods: lectura por membresía; escritura solo administrador de esa institución.
DROP POLICY IF EXISTS academic_periods_tenant_policy ON public.academic_periods;
CREATE POLICY academic_periods_member_read ON public.academic_periods FOR SELECT TO authenticated
  USING (public.is_super_admin()
         OR institution_id IN (SELECT m.institution_id FROM public.memberships m WHERE m.profile_id = auth.uid() AND m.is_active));
CREATE POLICY academic_periods_admin_insert ON public.academic_periods FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.user_role_type[]));
CREATE POLICY academic_periods_admin_update ON public.academic_periods FOR UPDATE TO authenticated
  USING (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.user_role_type[]))
  WITH CHECK (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.user_role_type[]));
CREATE POLICY academic_periods_admin_delete ON public.academic_periods FOR DELETE TO authenticated
  USING (public.is_super_admin() OR public.has_institution_role(institution_id, ARRAY['institution_admin']::public.user_role_type[]));

-- B5. students (lectura para el tablero): el administrador solo lee los de sus instituciones. La política DECE
--     (dylan_dece_students_access) y la del superadmin no se tocan.
CREATE POLICY students_admin_member_read ON public.students FOR SELECT TO authenticated
  USING (public.has_institution_role(institution_id, ARRAY['institution_admin']::public.user_role_type[]));

COMMIT;

-- Verificación como el admin (debe dar > 0 en CADA institución donde tiene membresía y 0 en las demás):
--   SELECT set_config('request.jwt.claims', json_build_object('sub', '<UUID-DEL-ADMIN>', 'role', 'authenticated')::text, true);
--   SET LOCAL ROLE authenticated;
--   SELECT institution_id, count(*) FROM public.honors GROUP BY 1;
--   SELECT institution_id, count(*) FROM public.academic_periods GROUP BY 1;
--   RESET ROLE;

-- ============================== C. REVERSIÓN (restaura drizzle/0012) ==============================
-- BEGIN;
-- DROP POLICY IF EXISTS honors_member_read ON public.honors;
-- DROP POLICY IF EXISTS honors_editor_insert ON public.honors;
-- DROP POLICY IF EXISTS honors_editor_update ON public.honors;
-- DROP POLICY IF EXISTS honors_editor_delete ON public.honors;
-- DROP POLICY IF EXISTS honors_published_authenticated_read ON public.honors;
-- DROP POLICY IF EXISTS academic_periods_member_read ON public.academic_periods;
-- DROP POLICY IF EXISTS academic_periods_admin_insert ON public.academic_periods;
-- DROP POLICY IF EXISTS academic_periods_admin_update ON public.academic_periods;
-- DROP POLICY IF EXISTS academic_periods_admin_delete ON public.academic_periods;
-- DROP POLICY IF EXISTS students_admin_member_read ON public.students;
-- CREATE POLICY honors_tenant_policy ON public.honors FOR ALL TO authenticated
--   USING (public.is_super_admin() OR institution_id = public.get_current_institution_id())
--   WITH CHECK (public.is_super_admin() OR institution_id = public.get_current_institution_id());
-- CREATE POLICY academic_periods_tenant_policy ON public.academic_periods FOR ALL TO authenticated
--   USING (public.is_super_admin() OR institution_id = public.get_current_institution_id())
--   WITH CHECK (public.is_super_admin() OR institution_id = public.get_current_institution_id());
-- COMMIT;

-- RIESGOS
-- 1. Las políticas de SELECT son permisivas y se suman: nada que dependa de get_current_institution_id() en otras tablas cambia.
-- 2. B3 hace públicas para cualquier sesión las distinciones publicadas de instituciones activas, igual que ya lo es para anon.
-- 3. has_institution_role y el enum user_role_type deben aceptar 'institution_admin' y 'editor' (A4/A5); si no, el INSERT/UPDATE falla al crear la política.
-- 4. B5 da lectura de students (columnas con GRANT de drizzle/0011: nombres y curso) a los institution_admin de cada institución; no incluye otras columnas.
-- 5. Si has_institution_role no distingue instituciones inactivas, un admin conserva escritura en una institución desactivada hasta que se retire su membresía.
