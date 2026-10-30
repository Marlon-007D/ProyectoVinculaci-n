-- PROPUESTA, NO APLICADA. Interruptor reversible del segundo factor (MFA) para la demo.
-- Revisar con el responsable de base de datos. Ejecutar por partes en el SQL Editor.
--
--   PARTE A  diagnóstico (solo lectura; ejecutar y revisar ANTES de la parte B)
--   PARTE B  desactivar la exigencia de MFA/aal2 (reversible)
--   PARTE C  reactivarla (deja el comportamiento como estaba)
--
-- El frontend tiene su propio interruptor (VITE_MFA_ENABLED). Este es el del servidor:
-- si la BD sigue exigiendo aal2, las RPC de proyectos/portal rechazan (42501) aunque el frontend no pida código.

-- ============================================================================
-- PARTE A. DIAGNÓSTICO (solo lectura)
-- ============================================================================

-- A1. Perfiles con MFA exigido o activo (quiénes se verían afectados).
SELECT p.email, p.mfa_required, p.mfa_enabled,
       (SELECT string_agg(r.name || '@' || i.slug, ', ')
          FROM public.memberships m
          JOIN public.roles r ON r.role_id = m.role_id
          JOIN public.institutions i ON i.institution_id = m.institution_id
         WHERE m.profile_id = p.profile_id AND m.is_active) AS membresias
  FROM public.profiles p
 WHERE p.mfa_required OR p.mfa_enabled
 ORDER BY p.mfa_enabled DESC, p.email;

-- A2. Resumen.
SELECT count(*) FILTER (WHERE mfa_required)                    AS con_mfa_required,
       count(*) FILTER (WHERE mfa_enabled)                     AS con_mfa_enabled,
       count(*) FILTER (WHERE mfa_required AND NOT mfa_enabled) AS pendientes_de_enrolar,
       count(*)                                                AS perfiles_totales
  FROM public.profiles;

-- A3. Funciones del esquema public cuyo código exige aal2 / MFA (políticas y RPC).
SELECT p.proname AS funcion, pg_get_function_identity_arguments(p.oid) AS argumentos,
       (pg_get_functiondef(p.oid) ILIKE '%aal2%') AS exige_aal2,
       (pg_get_functiondef(p.oid) ILIKE '%mfa_required%' OR pg_get_functiondef(p.oid) ILIKE '%mfa_enabled%') AS consulta_mfa
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.prokind = 'f'
   AND (pg_get_functiondef(p.oid) ILIKE '%aal2%' OR pg_get_functiondef(p.oid) ILIKE '%mfa_required%' OR pg_get_functiondef(p.oid) ILIKE '%mfa_enabled%')
 ORDER BY 1;

-- A4. Políticas RLS que mencionan MFA/aal directamente (se espera 0 filas: pasan por funciones).
SELECT schemaname, tablename, policyname, cmd
  FROM pg_policies
 WHERE coalesce(qual, '') ILIKE '%aal%' OR coalesce(with_check, '') ILIKE '%aal%'
    OR coalesce(qual, '') ILIKE '%mfa_%' OR coalesce(with_check, '') ILIKE '%mfa_%';

-- A5. Cuántas políticas dependen de projects_session_verified() (la función central de la exigencia).
SELECT count(*) AS politicas_que_la_usan
  FROM pg_policies
 WHERE coalesce(qual, '') ILIKE '%projects_session_verified%' OR coalesce(with_check, '') ILIKE '%projects_session_verified%';

-- A6. Definiciones actuales: comparar con las de esta propuesta antes de reemplazarlas.
SELECT pg_get_functiondef('public.projects_session_verified()'::regprocedure);
SELECT pg_get_functiondef('public.own_mfa_enrollment_required()'::regprocedure);
SELECT pg_get_functiondef('public.own_mfa_enabled_for_assigned_user()'::regprocedure);

-- ============================================================================
-- PARTE B. DESACTIVAR LA EXIGENCIA (reversible)
-- ============================================================================
-- Si A6 muestra cuerpos distintos a los que se reemplazan abajo, NO continuar: ajustar primero.
BEGIN;

-- B1. Interruptor central. false = no se exige MFA. Cambiar el cuerpo es todo lo que hace falta para alternar.
CREATE OR REPLACE FUNCTION public.mfa_enforced()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT false;
$$;
REVOKE ALL ON FUNCTION public.mfa_enforced() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mfa_enforced() TO authenticated;

-- B2. La verificación de sesión de proyectos/portal solo exige aal2 si el interruptor está activo.
--     (CREATE OR REPLACE conserva los GRANT existentes.)
CREATE OR REPLACE FUNCTION public.projects_session_verified()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND (
    NOT public.mfa_enforced()
    OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.profile_id = auth.uid()
      AND (p.mfa_required OR p.mfa_enabled) AND coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2')
  );
$$;

-- B3. Las RPC que consulta el frontend con MFA activo responden "no" mientras el interruptor esté apagado.
CREATE OR REPLACE FUNCTION public.own_mfa_enrollment_required()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.mfa_enforced() AND COALESCE((
    SELECT p.mfa_required AND NOT p.mfa_enabled
      FROM public.profiles AS p
     WHERE p.profile_id = auth.uid()
       AND EXISTS (SELECT 1 FROM public.memberships AS m WHERE m.profile_id = p.profile_id)
  ), FALSE);
$$;

CREATE OR REPLACE FUNCTION public.own_mfa_enabled_for_assigned_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.mfa_enforced() AND COALESCE((
    SELECT p.mfa_enabled
      FROM public.profiles AS p
     WHERE p.profile_id = auth.uid()
       AND EXISTS (SELECT 1 FROM public.memberships AS m WHERE m.profile_id = p.profile_id)
  ), FALSE);
$$;

-- No se tocan: profiles.mfa_required / mfa_enabled (se conservan para poder reactivar),
-- complete_own_mfa_enrollment() (sigue exigiendo aal2 porque solo se usa al enrolar),
-- ni las funciones de invitación (siguen marcando mfa_required = NOT mfa_enabled; sin efecto mientras mfa_enforced() sea false).
COMMIT;

-- Verificación (debe devolver false / true / false / false):
SELECT public.mfa_enforced() AS mfa_enforced, public.projects_session_verified() AS sesion_ok_sin_aal2,
       public.own_mfa_enrollment_required() AS pide_enrolar, public.own_mfa_enabled_for_assigned_user() AS pide_codigo;

-- ============================================================================
-- PARTE C. REACTIVAR (volver a exigir MFA)
-- ============================================================================
-- Las funciones de B2 y B3 ya se comportan como las originales cuando mfa_enforced() es true,
-- así que basta con volver a encender el interruptor. Ejecutar solo cuando se quiera reactivar.
--
-- CREATE OR REPLACE FUNCTION public.mfa_enforced()
-- RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
--   SELECT true;
-- $$;
--
-- Y en el frontend: VITE_MFA_ENABLED=true y volver a compilar.
-- Para volver al SQL anterior sin la función (opcional): reaplicar las definiciones originales de
-- supabase/proposals/projects/202610220000_projects_dependencies.sql (projects_session_verified) y
-- database/superadmin.sql (own_mfa_enrollment_required, own_mfa_enabled_for_assigned_user), y luego
-- DROP FUNCTION public.mfa_enforced();  -- solo después de reaplicarlas, porque las nuevas la usan.
