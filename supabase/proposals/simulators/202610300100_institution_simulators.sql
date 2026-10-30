-- PROPUESTA, NO APLICADA. Activación de simuladores por institución (segregación por institution_id).
-- Hoy los tres simuladores (facturación, conversor, interés) son fijos en el código y solo se controlan con el
-- módulo 'simuladores' de module_settings. Esta tabla permitiría al admin institucional activar cada uno.
-- Parte A: diagnóstico (solo lectura). Parte B: creación. Parte C: reversión.

-- ============================== A. DIAGNÓSTICO ==============================
-- A1. Instituciones con el módulo de simuladores habilitado.
SELECT i.slug, m.is_enabled
  FROM public.institutions i
  LEFT JOIN public.module_settings m ON m.institution_id = i.institution_id AND m.module_name = 'simuladores'
 ORDER BY i.slug;

-- A2. La tabla no debe existir todavía (se espera 0 filas).
SELECT to_regclass('public.institution_simulators') AS tabla_existente;

-- ============================== B. CREAR ==============================
BEGIN;

CREATE TABLE IF NOT EXISTS public.institution_simulators (
  institution_id uuid NOT NULL REFERENCES public.institutions(institution_id) ON DELETE CASCADE,
  simulator_key  text NOT NULL CHECK (simulator_key IN ('invoice', 'converter', 'interest')),
  is_enabled     boolean NOT NULL DEFAULT true,
  updated_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (institution_id, simulator_key)
);

ALTER TABLE public.institution_simulators ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro activo de la institución (el estudiante ve solo los activos de la suya).
CREATE POLICY institution_simulators_read ON public.institution_simulators FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.memberships m
                  WHERE m.profile_id = auth.uid() AND m.is_active AND m.institution_id = institution_simulators.institution_id));

-- Escritura: solo el admin institucional de esa institución (y el superadmin).
CREATE POLICY institution_simulators_write ON public.institution_simulators FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.memberships m JOIN public.roles r ON r.role_id = m.role_id
                  WHERE m.profile_id = auth.uid() AND m.is_active AND m.institution_id = institution_simulators.institution_id
                    AND r.name IN ('institution_admin', 'super_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM public.memberships m JOIN public.roles r ON r.role_id = m.role_id
                  WHERE m.profile_id = auth.uid() AND m.is_active AND m.institution_id = institution_simulators.institution_id
                    AND r.name IN ('institution_admin', 'super_admin')));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.institution_simulators TO authenticated;
REVOKE ALL ON public.institution_simulators FROM anon;
COMMIT;

-- ============================== C. REVERTIR ==============================
-- DROP TABLE public.institution_simulators;
