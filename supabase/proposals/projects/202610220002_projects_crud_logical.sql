-- Ejecutar después de 202610220001_shared_roles.sql. Sin eliminación física.
BEGIN;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS revision integer NOT NULL DEFAULT 1;
ALTER TABLE public.budget_items ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.budget_items ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS deleted_by uuid;
ALTER TABLE public.expense_files ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.expense_files ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Conserva incluso los registros retirados. Las tablas privadas siguen usando el RLS institucional.
CREATE OR REPLACE FUNCTION public.projects_prevent_physical_delete()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Solo se permite eliminación lógica en proyectos y sus registros.'; END;
$$;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['projects','budget_items','expenses','project_members','expense_files'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS projects_retain_records ON public.%I',tab);
    EXECUTE format('CREATE TRIGGER projects_retain_records BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.projects_prevent_physical_delete()',tab);
    EXECUTE format('REVOKE DELETE,TRUNCATE ON public.%I FROM anon,authenticated',tab);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.project_operation(target_institution uuid, operation text, payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
  pr public.projects%ROWTYPE;
  br public.budget_items%ROWTYPE;
  er public.expenses%ROWTYPE;
  person public.profiles%ROWTYPE;
  result jsonb;
  before_record jsonb;
  amount numeric;
  used numeric;
  first_day date;
  last_day date;
  today_ec date := (current_timestamp AT TIME ZONE 'America/Guayaquil')::date;
  period public.academic_periods%ROWTYPE;
BEGIN
  IF NOT public.project_can_manage(target_institution) THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar proyectos de esta institución.' USING ERRCODE='42501';
  END IF;
  IF operation <> 'create_project' THEN
    SELECT * INTO pr FROM public.projects WHERE project_id=(payload->>'project_id')::uuid AND institution_id=target_institution FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Proyecto inexistente o no autorizado.' USING ERRCODE='42501'; END IF;
    IF operation IN ('update_project','update_budget','update_expense','update_member') AND NOT (payload ? 'expected_revision') THEN
      RAISE EXCEPTION 'Actualiza el proyecto antes de editarlo.' USING ERRCODE='40001';
    END IF;
    IF payload ? 'expected_revision' AND (payload->>'expected_revision')::integer IS DISTINCT FROM pr.revision THEN
      RAISE EXCEPTION 'El proyecto cambió desde que lo abriste. Actualiza antes de guardar.' USING ERRCODE='40001';
    END IF;
    IF pr.deleted_at IS NOT NULL AND operation <> 'restore_project' THEN RAISE EXCEPTION 'El proyecto está archivado. Restáuralo antes de modificarlo.'; END IF;
    IF NOT pr.is_active AND operation NOT IN ('set_status','toggle_status','publish','archive_project','restore_project') THEN
      RAISE EXCEPTION 'El proyecto está cerrado. Reábrelo antes de modificar sus registros.';
    END IF;
    before_record := to_jsonb(pr);
  END IF;
  IF operation IN ('create_project','update_project') THEN
    amount := (payload->>'budget_total')::numeric;
    first_day := (payload->>'start_date')::date;
    last_day := (payload->>'end_date')::date;
    IF amount IS NULL OR amount::text IN ('NaN','Infinity','-Infinity') OR amount<0 OR amount>9999999999.99 OR amount<>round(amount,2) THEN RAISE EXCEPTION 'Presupuesto inválido: utiliza un importe no negativo con hasta dos decimales.'; END IF;
    IF nullif(btrim(payload->>'name'),'') IS NULL OR length(btrim(payload->>'name'))>255 THEN RAISE EXCEPTION 'Introduce un nombre de hasta 255 caracteres.'; END IF;
    IF first_day IS NULL OR last_day IS NULL OR last_day<first_day OR last_day>(first_day+interval '1 year')::date THEN RAISE EXCEPTION 'Introduce un período de ejecución válido de hasta un año.'; END IF;
    IF operation='create_project' THEN
      IF first_day<today_ec OR last_day>(today_ec+interval '1 year')::date THEN RAISE EXCEPTION 'El proyecto debe comenzar hoy o después y finalizar como máximo a un año desde hoy.'; END IF;
      IF (SELECT count(*) FROM public.academic_periods WHERE institution_id=target_institution AND is_active)>1 THEN RAISE EXCEPTION 'Hay más de un período lectivo activo.'; END IF;
      SELECT * INTO period FROM public.academic_periods WHERE institution_id=target_institution AND is_active;
      IF FOUND AND (first_day<period.start_date OR last_day>period.end_date) THEN RAISE EXCEPTION 'Las fechas deben quedar dentro del período lectivo activo.'; END IF;
      INSERT INTO public.projects(institution_id,title,description,total_budget,start_date,end_date,is_active,is_public)
      VALUES(target_institution,btrim(payload->>'name'),btrim(payload->>'description'),amount,first_day,last_day,true,false) RETURNING * INTO pr;
      result:=to_jsonb(pr);
    ELSE
      SELECT coalesce(sum(allocated_amount),0) INTO used FROM public.budget_items WHERE project_id=pr.project_id AND deleted_at IS NULL;
      IF amount<used THEN RAISE EXCEPTION 'El presupuesto no puede ser menor a la suma de los rubros vigentes.'; END IF;
      IF EXISTS(SELECT 1 FROM public.expenses e JOIN public.budget_items b USING(budget_item_id) WHERE b.project_id=pr.project_id AND b.deleted_at IS NULL AND e.deleted_at IS NULL AND (e.expense_date<first_day OR e.expense_date>last_day)) THEN RAISE EXCEPTION 'Las fechas deben incluir los gastos vigentes del proyecto.'; END IF;
      UPDATE public.projects SET title=btrim(payload->>'name'),description=btrim(payload->>'description'),total_budget=amount,start_date=first_day,end_date=last_day,is_public=false WHERE project_id=pr.project_id RETURNING to_jsonb(projects.*) INTO result;
    END IF;
  ELSE
    CASE operation
    WHEN 'archive_project' THEN
      UPDATE public.projects SET deleted_at=clock_timestamp(),deleted_by=auth.uid(),is_public=false WHERE project_id=pr.project_id RETURNING to_jsonb(projects.*) INTO result;
    WHEN 'restore_project' THEN
      IF pr.deleted_at IS NULL THEN RAISE EXCEPTION 'El proyecto no está archivado.'; END IF;
      UPDATE public.projects SET deleted_at=NULL,deleted_by=NULL,is_public=false WHERE project_id=pr.project_id RETURNING to_jsonb(projects.*) INTO result;
    WHEN 'set_status','toggle_status' THEN
      IF operation='set_status' AND jsonb_typeof(payload->'active') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Indica el estado del proyecto.'; END IF;
      UPDATE public.projects SET is_active=CASE WHEN operation='toggle_status' THEN NOT is_active ELSE (payload->>'active')::boolean END WHERE project_id=pr.project_id RETURNING to_jsonb(projects.*) INTO result;
    WHEN 'publish' THEN
      IF NOT public.project_can_publish(target_institution) THEN RAISE EXCEPTION 'Solo un administrador puede aprobar la publicación.' USING ERRCODE='42501'; END IF;
      IF jsonb_typeof(payload->'published') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Indica el estado de publicación.'; END IF;
      UPDATE public.projects SET is_public=(payload->>'published')::boolean WHERE project_id=pr.project_id RETURNING to_jsonb(projects.*) INTO result;
    WHEN 'add_budget','update_budget' THEN
      amount:=(payload->>'amount')::numeric;
      IF amount IS NULL OR amount::text IN ('NaN','Infinity','-Infinity') OR amount<=0 OR amount>9999999999.99 OR amount<>round(amount,2) OR nullif(btrim(payload->>'name'),'') IS NULL OR length(btrim(payload->>'name'))>255 THEN RAISE EXCEPTION 'Rubro inválido.'; END IF;
      IF operation='update_budget' THEN
        SELECT * INTO br FROM public.budget_items WHERE project_id=pr.project_id AND budget_item_id=(payload->>'budget_item_id')::uuid AND deleted_at IS NULL;
        IF NOT FOUND THEN RAISE EXCEPTION 'Rubro no disponible.' USING ERRCODE='42501'; END IF;
        before_record:=to_jsonb(br);
        SELECT coalesce(sum(e.amount),0) INTO used FROM public.expenses e WHERE budget_item_id=br.budget_item_id AND deleted_at IS NULL;
        IF amount<used THEN RAISE EXCEPTION 'La asignación no puede ser menor al gasto ejecutado.'; END IF;
      END IF;
      SELECT coalesce(sum(allocated_amount),0) INTO used FROM public.budget_items WHERE project_id=pr.project_id AND deleted_at IS NULL AND budget_item_id IS DISTINCT FROM br.budget_item_id;
      IF used+amount>pr.total_budget THEN RAISE EXCEPTION 'Los rubros superan el presupuesto del proyecto.'; END IF;
      IF operation='add_budget' THEN
        INSERT INTO public.budget_items(project_id,name,allocated_amount) VALUES(pr.project_id,btrim(payload->>'name'),amount) RETURNING to_jsonb(budget_items.*) INTO result;
      ELSE
        UPDATE public.budget_items SET name=btrim(payload->>'name'),allocated_amount=amount WHERE budget_item_id=br.budget_item_id RETURNING to_jsonb(budget_items.*) INTO result;
      END IF;
    WHEN 'add_expense','update_expense','delete_expense','delete_budget' THEN
      SELECT * INTO br FROM public.budget_items WHERE project_id=pr.project_id AND budget_item_id=(payload->>'budget_item_id')::uuid AND deleted_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Rubro no disponible.' USING ERRCODE='42501'; END IF;
      IF operation IN ('update_expense','delete_expense') THEN
        SELECT * INTO er FROM public.expenses WHERE budget_item_id=br.budget_item_id AND expense_id=(payload->>'expense_id')::uuid AND deleted_at IS NULL;
        IF NOT FOUND THEN RAISE EXCEPTION 'Gasto no disponible.' USING ERRCODE='42501'; END IF;
        before_record:=to_jsonb(er);
      ELSE before_record:=to_jsonb(br);
      END IF;
      IF operation IN ('add_expense','update_expense') THEN
        amount:=(payload->>'amount')::numeric;
        first_day:=(payload->>'date')::date;
        IF amount IS NULL OR amount::text IN ('NaN','Infinity','-Infinity') OR amount<=0 OR amount>9999999999.99 OR amount<>round(amount,2) THEN RAISE EXCEPTION 'Introduce un gasto positivo con hasta dos decimales.'; END IF;
        IF nullif(btrim(payload->>'description'),'') IS NULL OR first_day IS NULL THEN RAISE EXCEPTION 'Completa el concepto y la fecha del gasto.'; END IF;
        IF first_day<pr.start_date OR first_day>pr.end_date OR first_day>today_ec THEN RAISE EXCEPTION 'La fecha del gasto debe estar dentro del proyecto y no puede ser futura.'; END IF;
        SELECT coalesce(sum(e.amount),0) INTO used FROM public.expenses e WHERE budget_item_id=br.budget_item_id AND deleted_at IS NULL AND expense_id IS DISTINCT FROM er.expense_id;
        IF used+amount>br.allocated_amount THEN RAISE EXCEPTION 'El gasto supera el saldo disponible del rubro.'; END IF;
        IF operation='add_expense' THEN
          INSERT INTO public.expenses(budget_item_id,description,amount,expense_date,created_by) VALUES(br.budget_item_id,btrim(payload->>'description'),amount,first_day,auth.uid()) RETURNING to_jsonb(expenses.*) INTO result;
        ELSE
          UPDATE public.expenses SET description=btrim(payload->>'description'),amount=(payload->>'amount')::numeric,expense_date=first_day WHERE expense_id=er.expense_id RETURNING to_jsonb(expenses.*) INTO result;
        END IF;
      ELSIF operation='delete_expense' THEN
        UPDATE public.expenses SET deleted_at=clock_timestamp(),deleted_by=auth.uid() WHERE expense_id=er.expense_id RETURNING to_jsonb(expenses.*) INTO result;
        UPDATE public.expense_files SET deleted_at=clock_timestamp(),deleted_by=auth.uid() WHERE expense_id=er.expense_id AND deleted_at IS NULL;
      ELSE
        IF EXISTS(SELECT 1 FROM public.expenses WHERE budget_item_id=br.budget_item_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'No se puede retirar un rubro con gastos vigentes.'; END IF;
        UPDATE public.budget_items SET deleted_at=clock_timestamp(),deleted_by=auth.uid() WHERE budget_item_id=br.budget_item_id RETURNING to_jsonb(budget_items.*) INTO result;
      END IF;
    WHEN 'add_member' THEN
      IF nullif(btrim(payload->>'role'),'') IS NULL OR length(btrim(payload->>'role'))>100 THEN RAISE EXCEPTION 'Introduce una responsabilidad de hasta 100 caracteres.'; END IF;
      SELECT p.* INTO person FROM public.profiles p JOIN public.memberships m USING(profile_id) WHERE p.profile_id=(payload->>'profile_id')::uuid AND m.institution_id=target_institution AND m.is_active;
      IF NOT FOUND THEN RAISE EXCEPTION 'Selecciona un perfil activo de esta institución.' USING ERRCODE='42501'; END IF;
      IF EXISTS(SELECT 1 FROM public.project_members WHERE project_id=pr.project_id AND profile_id=person.profile_id AND deleted_at IS NULL) THEN RAISE EXCEPTION 'La persona ya pertenece al proyecto.' USING ERRCODE='23505'; END IF;
      -- Reutiliza el registro histórico si la persona se reincorpora; mantiene la restricción única del esquema común.
      UPDATE public.project_members SET role=btrim(payload->>'role'),full_name=concat_ws(' ',person.first_name,person.last_name),email=person.email,deleted_at=NULL,deleted_by=NULL WHERE project_id=pr.project_id AND profile_id=person.profile_id RETURNING to_jsonb(project_members.*) INTO result;
      IF NOT FOUND THEN
        INSERT INTO public.project_members(project_id,profile_id,full_name,email,role) VALUES(pr.project_id,person.profile_id,concat_ws(' ',person.first_name,person.last_name),person.email,btrim(payload->>'role')) RETURNING to_jsonb(project_members.*) INTO result;
      END IF;
    WHEN 'update_member','delete_member' THEN
      SELECT to_jsonb(m) INTO before_record FROM public.project_members m WHERE project_id=pr.project_id AND project_member_id=(payload->>'project_member_id')::uuid AND deleted_at IS NULL;
      IF NOT FOUND THEN RAISE EXCEPTION 'Participante no disponible.' USING ERRCODE='42501'; END IF;
      IF operation='update_member' THEN
        IF nullif(btrim(payload->>'role'),'') IS NULL OR length(btrim(payload->>'role'))>100 THEN RAISE EXCEPTION 'Introduce una responsabilidad de hasta 100 caracteres.'; END IF;
        UPDATE public.project_members SET role=btrim(payload->>'role') WHERE project_member_id=(payload->>'project_member_id')::uuid RETURNING to_jsonb(project_members.*) INTO result;
      ELSE
        UPDATE public.project_members SET deleted_at=clock_timestamp(),deleted_by=auth.uid() WHERE project_member_id=(payload->>'project_member_id')::uuid RETURNING to_jsonb(project_members.*) INTO result;
      END IF;
    ELSE RAISE EXCEPTION 'Operación no reconocida.';
    END CASE;
  END IF;
  IF result IS NULL THEN RAISE EXCEPTION 'No se pudo modificar el registro.'; END IF;
  IF operation<>'create_project' THEN
    UPDATE public.projects SET revision=revision+1 WHERE project_id=pr.project_id RETURNING revision INTO pr.revision;
    IF operation IN ('update_project','archive_project','restore_project','set_status','toggle_status','publish') THEN result:=result||jsonb_build_object('revision',pr.revision); END IF;
  END IF;
  INSERT INTO public.audit_events(institution_id,profile_id,action,entity_type,entity_id,payload)
  VALUES(target_institution,auth.uid(),'PROJECT_'||upper(operation),'projects',coalesce(result->>'expense_id',result->>'budget_item_id',result->>'project_member_id',result->>'project_id'),jsonb_build_object('project_id',pr.project_id,'before',before_record,'record',result));
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.project_public_summary(institution_slug text)
RETURNS TABLE(project_id uuid,title varchar,description text,is_active boolean,total_budget numeric,spent numeric,balance numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p.project_id,p.title,p.description,p.is_active,p.total_budget,coalesce(s.total,0),p.total_budget-coalesce(s.total,0)
 FROM public.projects p JOIN public.institutions i USING(institution_id)
 LEFT JOIN LATERAL (SELECT sum(e.amount) AS total FROM public.budget_items b JOIN public.expenses e USING(budget_item_id)
 WHERE b.project_id=p.project_id AND b.deleted_at IS NULL AND e.deleted_at IS NULL) s ON true
 WHERE i.slug=institution_slug AND public.project_module_enabled(i.institution_id) AND p.is_public AND p.deleted_at IS NULL ORDER BY p.created_at DESC;
$$;

-- Una lectura consistente incluye todos los movimientos, sin truncar relaciones anidadas
-- por el límite de filas de PostgREST. Solo devuelve una institución autorizada.
CREATE OR REPLACE FUNCTION public.project_read(target_institution uuid,target_project uuid DEFAULT NULL,page_offset integer DEFAULT 0,page_size integer DEFAULT 200)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF NOT public.project_can_manage(target_institution) THEN RAISE EXCEPTION 'Acceso no autorizado.' USING ERRCODE='42501'; END IF;
 IF page_offset<0 OR page_offset IS NULL OR page_size IS NULL OR page_size<1 OR page_size>200 THEN RAISE EXCEPTION 'Paginación inválida.'; END IF;
 SELECT coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object(
   'budget_items',coalesce((SELECT jsonb_agg(to_jsonb(b)||jsonb_build_object('expenses',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.expense_date,e.expense_id) FROM public.expenses e WHERE e.budget_item_id=b.budget_item_id AND e.deleted_at IS NULL),'[]'::jsonb)) ORDER BY b.created_at,b.budget_item_id) FROM public.budget_items b WHERE b.project_id=p.project_id AND b.deleted_at IS NULL),'[]'::jsonb),
   'project_members',coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.created_at,m.project_member_id) FROM public.project_members m WHERE m.project_id=p.project_id AND m.deleted_at IS NULL),'[]'::jsonb)
 ) ORDER BY p.created_at DESC,p.project_id),'[]'::jsonb) INTO result
 FROM (SELECT * FROM public.projects WHERE institution_id=target_institution AND (target_project IS NULL OR project_id=target_project) ORDER BY created_at DESC,project_id OFFSET page_offset LIMIT page_size) p;
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.project_read(uuid,uuid,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_read(uuid,uuid,integer,integer) TO authenticated;

-- Retirar un comprobante conserva tanto sus metadatos como el objeto privado.
CREATE OR REPLACE FUNCTION public.project_retire_receipt(target_institution uuid,target_expense uuid,target_file uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE result jsonb; pr public.projects%ROWTYPE;
BEGIN
 IF NOT public.project_can_manage(target_institution) THEN RAISE EXCEPTION 'Acceso no autorizado.' USING ERRCODE='42501'; END IF;
 SELECT p.* INTO pr FROM public.projects p JOIN public.budget_items b USING(project_id) JOIN public.expenses e USING(budget_item_id)
 WHERE p.institution_id=target_institution AND e.expense_id=target_expense AND p.deleted_at IS NULL AND b.deleted_at IS NULL AND e.deleted_at IS NULL FOR UPDATE OF p;
 IF NOT FOUND OR NOT pr.is_active THEN RAISE EXCEPTION 'El gasto no está disponible para cambios.' USING ERRCODE='42501'; END IF;
 UPDATE public.expense_files SET deleted_at=clock_timestamp(),deleted_by=auth.uid() WHERE expense_id=target_expense AND expense_file_id=target_file AND deleted_at IS NULL RETURNING to_jsonb(expense_files.*) INTO result;
 IF result IS NULL THEN RAISE EXCEPTION 'Comprobante no disponible.'; END IF;
 INSERT INTO public.audit_events(institution_id,profile_id,action,entity_type,entity_id,payload) VALUES(target_institution,auth.uid(),'PROJECT_RETIRE_RECEIPT','expense_files',target_file::text,result);
 RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.project_retire_receipt(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_retire_receipt(uuid,uuid,uuid) TO authenticated;
DROP POLICY IF EXISTS project_receipts_delete ON storage.objects;
DROP POLICY IF EXISTS project_receipts_retain ON storage.objects;
CREATE POLICY project_receipts_retain ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated,anon USING(bucket_id<>'project-receipts');
DROP POLICY IF EXISTS project_receipts_no_overwrite ON storage.objects;
CREATE POLICY project_receipts_no_overwrite ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated,anon USING(bucket_id<>'project-receipts') WITH CHECK(bucket_id<>'project-receipts');
CREATE OR REPLACE FUNCTION public.project_receipt_write_access(object_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.project_receipt_access(object_path) AND EXISTS(
 SELECT 1 FROM public.expenses e JOIN public.budget_items b USING(budget_item_id) JOIN public.projects p USING(project_id)
 WHERE e.expense_id::text=split_part(object_path,'/',2) AND p.is_active AND p.deleted_at IS NULL AND b.deleted_at IS NULL AND e.deleted_at IS NULL);
$$;
REVOKE ALL ON FUNCTION public.project_receipt_write_access(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_receipt_write_access(text) TO authenticated;
DROP POLICY IF EXISTS project_receipts_live_insert ON storage.objects;
CREATE POLICY project_receipts_live_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(bucket_id<>'project-receipts' OR public.project_receipt_write_access(name));
DROP POLICY IF EXISTS project_receipt_live_metadata ON public.expense_files;
CREATE POLICY project_receipt_live_metadata ON public.expense_files AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(deleted_at IS NULL AND deleted_by IS NULL AND public.project_receipt_write_access(file_path));
REVOKE DELETE ON public.expense_files FROM authenticated;
REVOKE ALL ON FUNCTION public.project_operation(uuid,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_operation(uuid,text,jsonb) TO authenticated;
COMMIT;
