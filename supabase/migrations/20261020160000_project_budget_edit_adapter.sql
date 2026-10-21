-- Additional adapter for editing a budget item; original project_operation is preserved.
BEGIN;
CREATE OR REPLACE FUNCTION public.p1_update_project_budget(
  target_institution UUID, target_project UUID, target_budget UUID, new_name TEXT, new_amount NUMERIC
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE project_total NUMERIC; spent NUMERIC; other_budgets NUMERIC;
BEGIN
  IF NOT app_security.active_member(target_institution)
     OR NOT app_security.module_enabled(target_institution,'projects')
     OR NOT (public.is_super_admin() OR public.has_institution_role(target_institution,ARRAY['institution_admin','project_manager']::public.user_role_type[])) THEN
    RAISE EXCEPTION 'No puedes editar rubros de esta institucion.' USING ERRCODE = '42501';
  END IF;
  IF new_amount IS NULL OR new_amount::TEXT IN ('NaN','Infinity','-Infinity') OR new_amount <= 0
     OR new_amount <> round(new_amount,2) OR NULLIF(btrim(new_name),'') IS NULL THEN
    RAISE EXCEPTION 'Nombre o importe de rubro invalido.' USING ERRCODE = '22023';
  END IF;
  SELECT total_budget INTO project_total FROM public.projects
    WHERE project_id = target_project AND institution_id = target_institution FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.budget_items WHERE budget_item_id = target_budget AND project_id = target_project) THEN
    RAISE EXCEPTION 'Proyecto o rubro no autorizado.' USING ERRCODE = '42501';
  END IF;
  SELECT COALESCE(sum(amount),0) INTO spent FROM public.expenses WHERE budget_item_id = target_budget;
  SELECT COALESCE(sum(allocated_amount),0) INTO other_budgets FROM public.budget_items WHERE project_id = target_project AND budget_item_id <> target_budget;
  IF new_amount < spent OR new_amount + other_budgets > project_total THEN
    RAISE EXCEPTION 'El importe no puede ser menor al gasto ni exceder el presupuesto.' USING ERRCODE = '23514';
  END IF;
  UPDATE public.budget_items SET name = btrim(new_name), allocated_amount = new_amount WHERE budget_item_id = target_budget AND project_id = target_project;
  INSERT INTO public.audit_events(institution_id,profile_id,action,entity_type,entity_id,payload)
    VALUES(target_institution,auth.uid(),'PROJECT_UPDATE_BUDGET','budget_items',target_budget::TEXT,
      jsonb_build_object('project_id',target_project,'allocated_amount',new_amount));
END;
$$;
REVOKE ALL ON FUNCTION public.p1_update_project_budget(UUID,UUID,UUID,TEXT,NUMERIC) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.p1_update_project_budget(UUID,UUID,UUID,TEXT,NUMERIC) TO authenticated;

-- Approved financial summaries without exposing budget/expense rows publicly.
CREATE OR REPLACE FUNCTION public.p1_public_project_summaries(target_slug TEXT)
RETURNS TABLE(project_id UUID, title TEXT, description TEXT, total_budget NUMERIC, spent NUMERIC, balance NUMERIC)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT p.project_id, p.title::TEXT, p.description::TEXT, p.total_budget,
    COALESCE(executed.amount,0), p.total_budget - COALESCE(executed.amount,0)
  FROM public.projects p JOIN public.institutions i ON i.institution_id = p.institution_id
  LEFT JOIN LATERAL (
    SELECT sum(e.amount) AS amount FROM public.budget_items b
    JOIN public.expenses e ON e.budget_item_id = b.budget_item_id WHERE b.project_id = p.project_id
  ) executed ON TRUE
  WHERE i.slug = target_slug AND p.is_public
    AND (to_jsonb(p)->>'is_active') IS DISTINCT FROM 'false'
    AND app_security.module_enabled(i.institution_id,'projects')
  ORDER BY p.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.p1_public_project_summaries(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.p1_public_project_summaries(TEXT) TO anon,authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
