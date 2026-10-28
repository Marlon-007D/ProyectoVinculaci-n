-- PROPUESTA SIN APLICAR: la revisa Marlon y la aprueba Dylan antes de ejecutarla en el SQL Editor.
-- Transparencia pública: el respaldo project_public_summary también devuelve start_date y end_date
-- para mostrar el período de ejecución («28 oct 2026 – 31 oct 2026») y el aviso «Plazo vencido».
--
-- Contexto: project_public_page (ACTIVAR_TRANSPARENCIA_PAGINADA.sql) YA devuelve ambas fechas; con
-- aplicar ese archivo el portal las muestra. Esta propuesta solo cubre el respaldo que usa la interfaz
-- mientras project_public_page no existe. La interfaz funciona sin fechas mientras no se aplique ninguna.
--
-- Las fechas pertenecen al mismo resumen que ya se publica (solo proyectos aprobados, sin borrar, de una
-- institución activa con el módulo habilitado). No expone participantes, movimientos ni comprobantes.
-- Requiere APLICAR_CRUD_LOGICO.sql (project_module_enabled). No está en prepare-projects-crud-upgrade.mjs.
-- Es repetible. PostgreSQL no permite cambiar el tipo de retorno con CREATE OR REPLACE, por eso se
-- elimina y se vuelve a crear con los mismos permisos dentro de una transacción.
BEGIN;
DROP FUNCTION IF EXISTS public.project_public_summary(text);
CREATE FUNCTION public.project_public_summary(institution_slug text)
RETURNS TABLE(project_id uuid,title varchar,description text,is_active boolean,total_budget numeric,spent numeric,balance numeric,start_date date,end_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p.project_id,p.title,p.description,p.is_active,p.total_budget,coalesce(s.total,0),p.total_budget-coalesce(s.total,0),p.start_date,p.end_date
 FROM public.projects p JOIN public.institutions i USING(institution_id)
 LEFT JOIN LATERAL (SELECT sum(e.amount) AS total FROM public.budget_items b JOIN public.expenses e USING(budget_item_id)
  WHERE b.project_id=p.project_id AND b.deleted_at IS NULL AND e.deleted_at IS NULL) s ON true
 WHERE i.slug=institution_slug AND public.project_module_enabled(i.institution_id) AND p.is_public AND p.deleted_at IS NULL ORDER BY p.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.project_public_summary(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_public_summary(text) TO anon, authenticated;
COMMIT;

-- Comprobación (solo lectura), con el slug de una institución:
-- SELECT title, start_date, end_date FROM public.project_public_summary('ue-el-esfuerzo');
-- Reversión: volver a ejecutar la definición de 202610220002_projects_crud_logical.sql (sin fechas),
-- precedida de DROP FUNCTION public.project_public_summary(text);
