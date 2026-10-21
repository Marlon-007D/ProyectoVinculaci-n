-- Integración del módulo de proyectos. Revisar con el responsable de base de datos antes de desplegar.
-- Requiere 202610110001_projects_multitenant.sql y la base común actual.
BEGIN;
CREATE OR REPLACE FUNCTION public.projects_session_verified()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.profile_id=auth.uid()
 AND (p.mfa_required OR p.mfa_enabled) AND coalesce(auth.jwt()->>'aal','aal1')<>'aal2');
$$;
CREATE OR REPLACE FUNCTION public.project_module_enabled(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.institutions i JOIN public.module_settings m USING(institution_id)
 WHERE i.institution_id=target AND i.is_active AND m.module_name='projects' AND m.is_enabled);
$$;
CREATE OR REPLACE FUNCTION public.project_can_manage(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.projects_session_verified() AND public.project_module_enabled(target) AND
 (public.is_super_admin() OR EXISTS(SELECT 1 FROM public.memberships m JOIN public.roles r USING(role_id)
 WHERE m.profile_id=auth.uid() AND m.institution_id=target AND r.name IN ('institution_admin','project_manager')));
$$;
REVOKE ALL ON FUNCTION public.projects_session_verified() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.projects_session_verified() TO authenticated;
CREATE OR REPLACE FUNCTION public.project_operation(target_institution uuid, operation text, payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  project_row public.projects%ROWTYPE;
  budget_row public.budget_items%ROWTYPE;
  result jsonb;
  amount numeric;
  used numeric;
  hours numeric;
  audit_id text;
  person public.profiles%ROWTYPE;
BEGIN
  IF NOT public.project_can_manage(target_institution) THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar proyectos de esta institución, o el módulo está deshabilitado.' USING ERRCODE = '42501';
  END IF;
  IF operation = 'create_project' THEN
    amount := (payload->>'budget_total')::numeric;
    IF amount IS NULL OR amount::text IN ('NaN', 'Infinity', '-Infinity') OR amount < 0 OR amount > 9999999999.99 OR amount <> round(amount, 2) THEN
      RAISE EXCEPTION 'El presupuesto debe estar entre 0 y 9999999999.99, con máximo dos decimales.';
    END IF;
    IF nullif(btrim(payload->>'name'), '') IS NULL THEN RAISE EXCEPTION 'Escribe el nombre del proyecto.'; END IF;
    IF nullif(payload->>'start_date','') IS NULL OR nullif(payload->>'end_date','') IS NULL OR (payload->>'end_date')::date < (payload->>'start_date')::date THEN RAISE EXCEPTION 'Introduce un período de ejecución válido.'; END IF;
    INSERT INTO public.projects(institution_id, title, description, total_budget, start_date, end_date, is_active, is_public)
      VALUES (target_institution, btrim(payload->>'name'), btrim(payload->>'description'), amount,
        nullif(payload->>'start_date', '')::date, nullif(payload->>'end_date', '')::date, true, false)
      RETURNING * INTO project_row;
    result := to_jsonb(project_row);
  ELSE
    -- Serializa las escrituras financieras de un mismo proyecto; evita sobregiros concurrentes.
    SELECT * INTO project_row FROM public.projects
      WHERE project_id = (payload->>'project_id')::uuid AND institution_id = target_institution FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Proyecto inexistente o no autorizado.' USING ERRCODE = '42501'; END IF;
    CASE operation
    WHEN 'set_status' THEN
      IF jsonb_typeof(payload->'active') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Indica el estado del proyecto.'; END IF;
      UPDATE public.projects SET is_active=(payload->>'active')::boolean WHERE project_id=project_row.project_id RETURNING to_jsonb(projects.*) INTO result;
    WHEN 'toggle_status' THEN
      UPDATE public.projects SET is_active = NOT is_active WHERE project_id = project_row.project_id RETURNING to_jsonb(projects.*) INTO result;
    WHEN 'publish' THEN
      IF NOT public.project_can_publish(target_institution) THEN RAISE EXCEPTION 'Solo un administrador puede aprobar la publicación.' USING ERRCODE = '42501'; END IF;
      IF payload->>'published' IS NULL THEN RAISE EXCEPTION 'Indica el estado de publicación.'; END IF;
      UPDATE public.projects SET is_public = (payload->>'published')::boolean WHERE project_id = project_row.project_id RETURNING to_jsonb(projects.*) INTO result;
    WHEN 'add_budget' THEN
      amount := (payload->>'amount')::numeric;
      IF amount IS NULL OR amount::text IN ('NaN', 'Infinity', '-Infinity') OR amount <= 0 OR amount <> round(amount, 2) THEN RAISE EXCEPTION 'El rubro debe tener un importe positivo con máximo dos decimales.'; END IF;
      IF nullif(btrim(payload->>'name'), '') IS NULL THEN RAISE EXCEPTION 'Escribe el nombre del rubro.'; END IF;
      SELECT coalesce(sum(allocated_amount), 0) INTO used FROM public.budget_items WHERE project_id = project_row.project_id;
      IF used + amount > project_row.total_budget THEN RAISE EXCEPTION 'Los rubros superan el presupuesto del proyecto.'; END IF;
      INSERT INTO public.budget_items(project_id, name, allocated_amount) VALUES(project_row.project_id, btrim(payload->>'name'), amount)
        RETURNING to_jsonb(budget_items.*) INTO result;
    WHEN 'update_budget' THEN
      amount := (payload->>'amount')::numeric;
      IF amount IS NULL OR amount::text IN ('NaN','Infinity','-Infinity') OR amount<=0 OR amount<>round(amount,2) OR nullif(btrim(payload->>'name'),'') IS NULL THEN RAISE EXCEPTION 'Rubro inválido.'; END IF;
      SELECT * INTO budget_row FROM public.budget_items WHERE project_id=project_row.project_id AND budget_item_id=(payload->>'budget_item_id')::uuid;
      IF NOT FOUND THEN RAISE EXCEPTION 'Rubro no autorizado.' USING ERRCODE='42501'; END IF;
      SELECT coalesce(sum(e.amount),0) INTO used FROM public.expenses e WHERE e.budget_item_id=budget_row.budget_item_id;
      IF amount<used THEN RAISE EXCEPTION 'La asignación no puede ser menor al gasto ejecutado.'; END IF;
      SELECT coalesce(sum(allocated_amount),0) INTO used FROM public.budget_items WHERE project_id=project_row.project_id AND budget_item_id<>budget_row.budget_item_id;
      IF used+amount>project_row.total_budget THEN RAISE EXCEPTION 'Los rubros superan el presupuesto.'; END IF;
      UPDATE public.budget_items SET name=btrim(payload->>'name'),allocated_amount=amount WHERE budget_item_id=budget_row.budget_item_id RETURNING to_jsonb(budget_items.*) INTO result;
    WHEN 'add_expense', 'delete_expense', 'delete_budget' THEN
      SELECT * INTO budget_row FROM public.budget_items WHERE budget_item_id = (payload->>'budget_item_id')::uuid AND project_id = project_row.project_id;
      IF NOT FOUND THEN RAISE EXCEPTION 'Rubro inexistente o no autorizado.' USING ERRCODE = '42501'; END IF;
      IF operation = 'add_expense' THEN
        amount := (payload->>'amount')::numeric;
        IF amount IS NULL OR amount::text IN ('NaN', 'Infinity', '-Infinity') OR amount <= 0 OR amount <> round(amount, 2) THEN RAISE EXCEPTION 'El gasto debe tener un importe positivo con máximo dos decimales.'; END IF;
        IF nullif(btrim(payload->>'description'), '') IS NULL OR nullif(payload->>'date', '') IS NULL THEN RAISE EXCEPTION 'Completa el concepto y la fecha del gasto.'; END IF;
        SELECT coalesce(sum(e.amount), 0) INTO used FROM public.expenses e WHERE e.budget_item_id = budget_row.budget_item_id;
        IF used + amount > budget_row.allocated_amount THEN RAISE EXCEPTION 'El gasto supera el saldo del rubro. Actualiza los datos.'; END IF;
        INSERT INTO public.expenses(budget_item_id, description, amount, expense_date, invoice_number, created_by)
          VALUES(budget_row.budget_item_id, btrim(payload->>'description'), amount, (payload->>'date')::date, nullif(btrim(payload->>'invoice_number'), ''), auth.uid())
          RETURNING to_jsonb(expenses.*) INTO result;
      ELSIF operation = 'delete_expense' THEN
        IF EXISTS(SELECT 1 FROM public.expense_files WHERE expense_id=(payload->>'expense_id')::uuid) THEN RAISE EXCEPTION 'Retira los respaldos privados antes de eliminar el gasto.'; END IF;
        DELETE FROM public.expenses WHERE expense_id = (payload->>'expense_id')::uuid AND budget_item_id = budget_row.budget_item_id RETURNING to_jsonb(expenses.*) INTO result;
      ELSE
        IF EXISTS (SELECT 1 FROM public.expenses WHERE budget_item_id = budget_row.budget_item_id) THEN RAISE EXCEPTION 'No se puede eliminar un rubro con gastos registrados.'; END IF;
        DELETE FROM public.budget_items WHERE budget_item_id = budget_row.budget_item_id RETURNING to_jsonb(budget_items.*) INTO result;
      END IF;
    WHEN 'add_member' THEN
      IF nullif(btrim(payload->>'role'),'') IS NULL OR length(btrim(payload->>'role'))>100 THEN RAISE EXCEPTION 'Introduce una responsabilidad de hasta 100 caracteres.'; END IF;
      IF nullif(payload->>'profile_id','') IS NOT NULL THEN
        SELECT p.* INTO person FROM public.profiles p JOIN public.memberships m USING(profile_id)
          WHERE p.profile_id=(payload->>'profile_id')::uuid AND m.institution_id=target_institution;
        IF NOT FOUND THEN RAISE EXCEPTION 'Perfil ajeno a la institución.' USING ERRCODE='42501'; END IF;
        INSERT INTO public.project_members(project_id,profile_id,full_name,email,role)
          VALUES(project_row.project_id,person.profile_id,concat_ws(' ',person.first_name,person.last_name),person.email,btrim(payload->>'role')) RETURNING to_jsonb(project_members.*) INTO result;
      ELSE
        IF nullif(btrim(payload->>'full_name'),'') IS NULL OR coalesce(payload->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Completa el nombre y un correo válido.'; END IF;
        hours := (payload->>'hours_assigned')::numeric;
        IF hours IS NULL OR hours::text IN ('NaN','Infinity','-Infinity') OR hours<=0 OR hours>10000 OR hours<>trunc(hours) THEN RAISE EXCEPTION 'Horas inválidas.'; END IF;
        INSERT INTO public.project_members(project_id,full_name,email,role,hours_assigned)
          VALUES(project_row.project_id,btrim(payload->>'full_name'),lower(btrim(payload->>'email')),btrim(payload->>'role'),hours::integer) RETURNING to_jsonb(project_members.*) INTO result;
      END IF;
    WHEN 'delete_member' THEN
      DELETE FROM public.project_members WHERE project_member_id = (payload->>'project_member_id')::uuid AND project_id = project_row.project_id RETURNING to_jsonb(project_members.*) INTO result;
    ELSE RAISE EXCEPTION 'Operación no reconocida.';
    END CASE;
  END IF;
  IF result IS NULL THEN RAISE EXCEPTION 'El registro ya no existe. Actualiza los datos.'; END IF;
  audit_id := coalesce(result->>'expense_id', result->>'budget_item_id', result->>'project_member_id', result->>'project_id');
  INSERT INTO public.audit_events(institution_id, profile_id, action, entity_type, entity_id, payload)
    VALUES(target_institution, auth.uid(), 'PROJECT_' || upper(operation), 'projects', audit_id,
      jsonb_build_object('project_id', project_row.project_id, 'operation', operation, 'record', result));
  RETURN result;
END;
$$;


CREATE OR REPLACE FUNCTION public.project_member_options(target_institution uuid)
RETURNS TABLE(profile_id uuid,full_name text,email varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p.profile_id,concat_ws(' ',p.first_name,p.last_name),p.email FROM public.profiles p
 JOIN public.memberships m USING(profile_id) WHERE m.institution_id=target_institution
 AND public.project_can_manage(target_institution) ORDER BY p.first_name,p.last_name;
$$;
REVOKE ALL ON FUNCTION public.project_member_options(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_member_options(uuid) TO authenticated;
COMMIT;
