-- PROPUESTA, NO APLICADA. Cuadro de honor: diagnóstico, publicación de borradores y datos de ejemplo.
-- Parte A: diagnóstico (solo lectura; córrela primero y dime el resultado).
-- Parte B: publica las distinciones en borrador (equivale a drizzle/0014 de la rama de Brigitte).
-- Parte C: datos de ejemplo por institución (solo si A muestra que faltan períodos o distinciones).

-- ============================== A. DIAGNÓSTICO ==============================
-- A1. Por institución: períodos, período vigente, distinciones por estado y lo que ve el portal público.
SELECT i.slug,
       i.is_active                                                        AS institucion_activa,
       (SELECT count(*) FROM public.academic_periods p WHERE p.institution_id = i.institution_id)                       AS periodos,
       (SELECT count(*) FROM public.academic_periods p WHERE p.institution_id = i.institution_id AND p.is_active)       AS periodos_vigentes,
       (SELECT count(*) FROM public.honors h WHERE h.institution_id = i.institution_id)                                  AS distinciones,
       (SELECT count(*) FROM public.honors h WHERE h.institution_id = i.institution_id AND h.status = 'draft')          AS en_borrador,
       (SELECT count(*) FROM public.honors h WHERE h.institution_id = i.institution_id AND h.status = 'published')      AS publicadas,
       (SELECT count(*) FROM public.honors h WHERE h.institution_id = i.institution_id AND h.honor_category = 'official')      AS oficiales,
       (SELECT count(*) FROM public.honors h WHERE h.institution_id = i.institution_id AND h.honor_category = 'institutional') AS institucionales,
       (SELECT count(*) FROM public.public_honors ph WHERE ph.institution_id = i.institution_id)                         AS visibles_en_portal,
       (SELECT count(*) FROM public.students s WHERE s.institution_id = i.institution_id)                                AS estudiantes
  FROM public.institutions i
 ORDER BY i.slug;

-- A2. Distinciones cuyo período no existe o es de otra institución (se espera 0 filas).
SELECT h.honor_id, h.institution_id, h.academic_period_id
  FROM public.honors h
  LEFT JOIN public.academic_periods p ON p.academic_period_id = h.academic_period_id AND p.institution_id = h.institution_id
 WHERE p.academic_period_id IS NULL;

-- A3. Definición de la vista pública (debe filtrar status = 'published').
SELECT pg_get_viewdef('public.public_honors'::regclass, true);

-- A4. Políticas sobre honors (el panel lee la tabla con la sesión del admin; el portal lee la vista como anon).
SELECT policyname, roles, cmd, qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'honors';

-- ============================== B. PUBLICAR BORRADORES ==============================
-- El tablero no tiene flujo de borrador: la vista pública solo muestra 'published'.
-- UPDATE public.honors SET status = 'published' WHERE status = 'draft';

-- ============================== C. DATOS DE EJEMPLO ==============================
-- Crea el período vigente del año si la institución no tiene ninguno vigente, y 3 distinciones oficiales
-- con los primeros estudiantes de ESA institución (nunca mezcla instituciones). Idempotente.
-- BEGIN;
-- INSERT INTO public.academic_periods (institution_id, name, start_date, end_date, is_active)
-- SELECT i.institution_id, '2026-2027', DATE '2026-09-01', DATE '2027-06-30', true
--   FROM public.institutions i
--  WHERE i.is_active
--    AND NOT EXISTS (SELECT 1 FROM public.academic_periods p WHERE p.institution_id = i.institution_id AND p.is_active);
--
-- WITH ranked AS (
--   SELECT s.institution_id, s.student_id, row_number() OVER (PARTITION BY s.institution_id ORDER BY s.last_name, s.first_name) AS n
--     FROM public.students s
-- ), current_period AS (
--   SELECT DISTINCT ON (institution_id) institution_id, academic_period_id
--     FROM public.academic_periods WHERE is_active ORDER BY institution_id, start_date DESC
-- )
-- INSERT INTO public.honors (honor_id, institution_id, academic_period_id, student_id, achievement, honor_category, official_order, status)
-- SELECT gen_random_uuid(), r.institution_id, c.academic_period_id, r.student_id,
--        CASE r.n WHEN 1 THEN 'Abanderado del Pabellón Nacional' WHEN 2 THEN 'Portaestandarte de la ciudad' ELSE 'Portaestandarte del plantel' END,
--        'official', r.n::int, 'published'
--   FROM ranked r JOIN current_period c USING (institution_id)
--  WHERE r.n <= 3
--    AND NOT EXISTS (SELECT 1 FROM public.honors h WHERE h.institution_id = r.institution_id AND h.academic_period_id = c.academic_period_id);
-- COMMIT;
--
-- Reversión de C: DELETE de las filas creadas (identificables por honor_id recién generado o por el período '2026-2027').
