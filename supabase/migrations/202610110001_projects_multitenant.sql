-- Requiere database/script.sql y database/superadmin.sql. No ejecutar de nuevo el esquema base.
-- Cambios limitados a proyectos; revisar con el responsable de base de datos antes del despliegue.
BEGIN;

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS invoice_number text;
-- Un participante puede ser externo y no tiene por qué disponer de una cuenta de acceso.
ALTER TABLE public.project_members ALTER COLUMN profile_id DROP NOT NULL;
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS hours_assigned integer NOT NULL DEFAULT 0;
UPDATE public.project_members m SET full_name = concat_ws(' ', p.first_name, p.last_name), email = p.email
FROM public.profiles p WHERE m.profile_id = p.profile_id AND m.full_name IS NULL;

CREATE OR REPLACE FUNCTION public.project_module_enabled(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT EXISTS (SELECT 1 FROM public.institutions WHERE institution_id = target AND is_active)
    AND NOT EXISTS (SELECT 1 FROM public.module_settings
      WHERE institution_id = target AND module_name = 'projects' AND NOT is_enabled);
$$;

CREATE OR REPLACE FUNCTION public.project_can_manage(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT auth.uid() IS NOT NULL AND public.project_module_enabled(target) AND (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.memberships m JOIN public.roles r USING (role_id)
      WHERE m.profile_id = auth.uid() AND m.institution_id = target
        AND r.name IN ('institution_admin', 'project_manager')));
$$;

CREATE OR REPLACE FUNCTION public.project_can_publish(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT public.project_can_manage(target) AND (public.is_super_admin() OR EXISTS (
    SELECT 1 FROM public.memberships m JOIN public.roles r USING (role_id)
    WHERE m.profile_id = auth.uid() AND m.institution_id = target AND r.name = 'institution_admin'));
$$;

CREATE OR REPLACE FUNCTION public.project_institutions()
RETURNS TABLE(institution_id uuid, name varchar, slug varchar, is_active boolean, role text, projects_enabled boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT i.institution_id, i.name, i.slug, i.is_active,
    CASE WHEN public.is_super_admin() THEN 'super_admin' ELSE r.name::text END,
    public.project_module_enabled(i.institution_id)
  FROM public.institutions i
  LEFT JOIN public.memberships m ON m.institution_id = i.institution_id AND m.profile_id = auth.uid()
  LEFT JOIN public.roles r ON r.role_id = m.role_id
  WHERE auth.uid() IS NOT NULL AND i.is_active AND (public.is_super_admin() OR m.profile_id = auth.uid())
  ORDER BY i.name;
$$;

-- Acceso privado: el resumen público se entrega mediante una función de columnas explícitas.
DROP POLICY IF EXISTS projects_tenant_policy ON public.projects;
CREATE POLICY projects_tenant_policy ON public.projects FOR SELECT TO authenticated
  USING (public.project_can_manage(institution_id));
DROP POLICY IF EXISTS budget_items_tenant_policy ON public.budget_items;
CREATE POLICY budget_items_tenant_policy ON public.budget_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.project_id = budget_items.project_id
    AND public.project_can_manage(p.institution_id)));
DROP POLICY IF EXISTS expenses_tenant_policy ON public.expenses;
CREATE POLICY expenses_tenant_policy ON public.expenses FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.budget_items b JOIN public.projects p USING (project_id)
    WHERE b.budget_item_id = expenses.budget_item_id AND public.project_can_manage(p.institution_id)));
DROP POLICY IF EXISTS project_members_tenant_policy ON public.project_members;
CREATE POLICY project_members_tenant_policy ON public.project_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.project_id = project_members.project_id
    AND public.project_can_manage(p.institution_id)));

-- Toda escritura usa la operación atómica siguiente, incluso peticiones directas a la API.
REVOKE ALL ON public.projects, public.budget_items, public.expenses, public.project_members FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.projects, public.budget_items, public.expenses, public.project_members FROM authenticated;
GRANT SELECT ON public.projects, public.budget_items, public.expenses, public.project_members TO authenticated;

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
BEGIN
  IF NOT public.project_can_manage(target_institution) THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar proyectos de esta institución, o el módulo está deshabilitado.' USING ERRCODE = '42501';
  END IF;
  IF operation = 'create_project' THEN
    amount := (payload->>'budget_total')::numeric;
    IF amount IS NULL OR amount::text IN ('NaN', 'Infinity', '-Infinity') OR amount < 0 OR amount > 100000 OR amount <> round(amount, 2) THEN
      RAISE EXCEPTION 'El presupuesto debe estar entre 0 y 100000, con máximo dos decimales.';
    END IF;
    IF nullif(btrim(payload->>'name'), '') IS NULL THEN RAISE EXCEPTION 'Escribe el nombre del proyecto.'; END IF;
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
        DELETE FROM public.expenses WHERE expense_id = (payload->>'expense_id')::uuid AND budget_item_id = budget_row.budget_item_id RETURNING to_jsonb(expenses.*) INTO result;
      ELSE
        IF EXISTS (SELECT 1 FROM public.expenses WHERE budget_item_id = budget_row.budget_item_id) THEN RAISE EXCEPTION 'No se puede eliminar un rubro con gastos registrados.'; END IF;
        DELETE FROM public.budget_items WHERE budget_item_id = budget_row.budget_item_id RETURNING to_jsonb(budget_items.*) INTO result;
      END IF;
    WHEN 'add_member' THEN
      hours := (payload->>'hours_assigned')::numeric;
      IF hours IS NULL OR hours::text IN ('NaN', 'Infinity', '-Infinity') OR hours <= 0 OR hours > 10000 OR hours <> trunc(hours) THEN RAISE EXCEPTION 'Las horas deben ser un entero entre 1 y 10000.'; END IF;
      IF nullif(btrim(payload->>'full_name'), '') IS NULL OR coalesce(payload->>'email', '') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN RAISE EXCEPTION 'Completa el nombre y un correo válido.'; END IF;
      IF coalesce(payload->>'role', '') NOT IN ('Coordinador', 'Docente Tutor', 'Estudiante Lider', 'Estudiante Participante') THEN RAISE EXCEPTION 'Rol de participante no válido.'; END IF;
      INSERT INTO public.project_members(project_id, full_name, email, role, hours_assigned)
        VALUES(project_row.project_id, btrim(payload->>'full_name'), lower(btrim(payload->>'email')), payload->>'role', hours::integer)
        RETURNING to_jsonb(project_members.*) INTO result;
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

CREATE OR REPLACE FUNCTION public.project_public_institutions()
RETURNS TABLE(name varchar, slug varchar) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT i.name, i.slug FROM public.institutions i WHERE i.is_active AND public.project_module_enabled(i.institution_id) ORDER BY i.name;
$$;

CREATE OR REPLACE FUNCTION public.project_public_summary(institution_slug text)
RETURNS TABLE(project_id uuid, title varchar, description text, is_active boolean, total_budget numeric, spent numeric, balance numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT p.project_id, p.title, p.description, p.is_active, p.total_budget,
    coalesce(s.total, 0), p.total_budget - coalesce(s.total, 0)
  FROM public.projects p JOIN public.institutions i USING (institution_id)
  LEFT JOIN LATERAL (SELECT sum(e.amount) AS total FROM public.budget_items b
    JOIN public.expenses e USING (budget_item_id) WHERE b.project_id = p.project_id) s ON true
  WHERE i.slug = institution_slug AND public.project_module_enabled(i.institution_id) AND p.is_public
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.project_module_enabled(uuid), public.project_can_manage(uuid), public.project_can_publish(uuid),
  public.project_institutions(), public.project_operation(uuid, text, jsonb), public.project_public_institutions(), public.project_public_summary(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_can_manage(uuid), public.project_can_publish(uuid), public.project_institutions(), public.project_operation(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_public_institutions(), public.project_public_summary(text) TO anon, authenticated;
COMMIT;
