-- Ejecutar en el SQL Editor del proyecto institucional. No modifica tablas, cuentas ni MFA.
-- Transparencia paginada: filtra, busca, ordena y pagina en el servidor para UNA institución
-- y devuelve solo la página visible (máx. 50 filas) más los totales públicos agregados.
-- Requiere el consolidado del CRUD (public.project_module_enabled). Es repetible.
BEGIN;
DO $$
BEGIN
 IF to_regprocedure('public.project_module_enabled(uuid)') IS NULL THEN
  RAISE EXCEPTION 'Falta public.project_module_enabled(uuid). Aplicar antes APLICAR_CRUD_LOGICO.sql.';
 END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_public_page(
 institution_slug text,
 search_text text DEFAULT '',
 status_filter text DEFAULT 'all',
 sort_key text DEFAULT 'name',
 page_number integer DEFAULT 1,
 page_size integer DEFAULT 9)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 target uuid;
 term text := left(nullif(btrim(coalesce(search_text,'')),''),100);
 pattern text;
 result jsonb;
BEGIN
 IF page_number IS NULL OR page_number<1 OR page_size IS NULL OR page_size<1 OR page_size>50 THEN
  RAISE EXCEPTION 'Paginación inválida.' USING ERRCODE='22023';
 END IF;
 IF status_filter IS NULL OR status_filter NOT IN ('all','active','closed')
  OR sort_key IS NULL OR sort_key NOT IN ('name','recent','budget','spent','execution') THEN
  RAISE EXCEPTION 'Filtro de transparencia inválido.' USING ERRCODE='22023';
 END IF;
 SELECT i.institution_id INTO target FROM public.institutions i
  WHERE i.slug=institution_slug AND i.is_active AND public.project_module_enabled(i.institution_id);
 IF target IS NULL THEN
  RETURN jsonb_build_object('total',0,'page',page_number,'page_size',page_size,'rows','[]'::jsonb,
   'summary',jsonb_build_object('count',0,'budget',0,'spent',0,'active',0,'closed',0));
 END IF;
 -- Búsqueda sin distinguir mayúsculas ni tildes; los comodines del usuario son literales.
 IF term IS NOT NULL THEN
  pattern := '%'||replace(replace(replace(lower(translate(term,'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun')),'\','\\'),'%','\%'),'_','\_')||'%';
 END IF;
 WITH published AS (
  SELECT p.project_id,p.title,p.description,p.is_active,p.total_budget,p.start_date,p.end_date,p.created_at,
   coalesce(s.total,0) AS spent
  FROM public.projects p
  LEFT JOIN LATERAL (SELECT sum(e.amount) AS total FROM public.budget_items b JOIN public.expenses e USING(budget_item_id)
   WHERE b.project_id=p.project_id AND b.deleted_at IS NULL AND e.deleted_at IS NULL) s ON true
  WHERE p.institution_id=target AND p.is_public AND p.deleted_at IS NULL
 ), filtered AS (
  SELECT * FROM published
  WHERE (status_filter='all' OR is_active=(status_filter='active'))
   AND (pattern IS NULL OR lower(translate(title||' '||coalesce(description,''),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun')) LIKE pattern ESCAPE '\')
 ), ranked AS (
  SELECT *, row_number() OVER (ORDER BY
   CASE WHEN sort_key='name' THEN lower(title) END ASC,
   CASE WHEN sort_key='recent' THEN created_at END DESC,
   CASE WHEN sort_key='budget' THEN total_budget END DESC,
   CASE WHEN sort_key='spent' THEN spent END DESC,
   CASE WHEN sort_key='execution' THEN CASE WHEN total_budget>0 THEN spent/total_budget ELSE 0 END END DESC,
   project_id) AS ordinal
  FROM filtered
 ), visible AS (
  SELECT * FROM ranked WHERE ordinal>(page_number-1)::bigint*page_size AND ordinal<=page_number::bigint*page_size
 )
 SELECT jsonb_build_object(
  'total',(SELECT count(*) FROM filtered),
  'page',page_number,
  'page_size',page_size,
  'rows',coalesce((SELECT jsonb_agg(jsonb_build_object(
    'project_id',v.project_id,'title',v.title,'description',v.description,'is_active',v.is_active,
    'total_budget',v.total_budget,'spent',v.spent,'balance',v.total_budget-v.spent,
    'start_date',v.start_date,'end_date',v.end_date) ORDER BY v.ordinal) FROM visible v),'[]'::jsonb),
  'summary',(SELECT jsonb_build_object('count',count(*),'budget',coalesce(sum(total_budget),0),
    'spent',coalesce(sum(spent),0),'active',count(*) FILTER (WHERE is_active),
    'closed',count(*) FILTER (WHERE NOT is_active)) FROM published)
 ) INTO result;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.project_public_page(text,text,text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_public_page(text,text,text,text,integer,integer) TO anon,authenticated;
COMMIT;
