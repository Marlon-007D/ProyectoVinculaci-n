-- PROPUESTA SIN APLICAR: la revisa Marlon y la aprueba Dylan antes de ejecutarla en el SQL Editor.
-- Límites de longitud de los textos del módulo de proyectos. Los mismos valores validan los formularios
-- (src/modules/projects/projectValidation.ts, TEXT_LIMITS): nombre de proyecto y de rubro 120, concepto
-- de gasto 150, responsabilidad 80 y objetivo/descripción 1000, medidos después de recortar espacios.
--
-- No está en la lista de scripts/prepare-projects-crud-upgrade.mjs ni en APLICAR_CRUD_LOGICO.sql.
-- Orden: ejecutar después de APLICAR_CRUD_LOGICO.sql.
--
-- PASO 1 (solo lectura). Ejecutar primero esta consulta. Si alguna fila muestra violaciones > 0,
-- hay registros anteriores que superan el límite: acortarlos antes del paso 3.
SELECT 'projects.title' AS columna, count(*) AS violaciones FROM public.projects WHERE char_length(btrim(title)) NOT BETWEEN 1 AND 120
UNION ALL SELECT 'projects.description', count(*) FROM public.projects WHERE description IS NOT NULL AND char_length(btrim(description)) > 1000
UNION ALL SELECT 'budget_items.name', count(*) FROM public.budget_items WHERE char_length(btrim(name)) NOT BETWEEN 1 AND 120
UNION ALL SELECT 'expenses.description', count(*) FROM public.expenses WHERE char_length(btrim(description)) NOT BETWEEN 1 AND 150
UNION ALL SELECT 'project_members.role', count(*) FROM public.project_members WHERE char_length(btrim(role)) NOT BETWEEN 1 AND 80;

-- PASO 2. Las restricciones se crean NOT VALID: se aplican a los registros nuevos y a los que se editen,
-- sin revisar ni bloquear los existentes. Es seguro repetir el script (omite las que ya existen).
BEGIN;
DO $$
DECLARE
  rule record;
BEGIN
  FOR rule IN SELECT * FROM (VALUES
    ('projects', 'projects_title_length_check', 'char_length(btrim(title)) BETWEEN 1 AND 120'),
    ('projects', 'projects_description_length_check', 'description IS NULL OR char_length(btrim(description)) <= 1000'),
    ('budget_items', 'budget_items_name_length_check', 'char_length(btrim(name)) BETWEEN 1 AND 120'),
    ('expenses', 'expenses_description_length_check', 'char_length(btrim(description)) BETWEEN 1 AND 150'),
    ('project_members', 'project_members_role_length_check', 'char_length(btrim(role)) BETWEEN 1 AND 80')
  ) AS limits(table_name, constraint_name, expression)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = rule.constraint_name AND conrelid = format('public.%I', rule.table_name)::regclass
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s) NOT VALID', rule.table_name, rule.constraint_name, rule.expression);
    END IF;
  END LOOP;
END $$;
COMMIT;

-- PASO 3 (opcional, solo cuando el paso 1 no muestre violaciones): validar también los registros existentes.
-- ALTER TABLE public.projects VALIDATE CONSTRAINT projects_title_length_check;
-- ALTER TABLE public.projects VALIDATE CONSTRAINT projects_description_length_check;
-- ALTER TABLE public.budget_items VALIDATE CONSTRAINT budget_items_name_length_check;
-- ALTER TABLE public.expenses VALIDATE CONSTRAINT expenses_description_length_check;
-- ALTER TABLE public.project_members VALIDATE CONSTRAINT project_members_role_length_check;

-- Reversión: ALTER TABLE public.<tabla> DROP CONSTRAINT <nombre>; con los nombres de arriba.
