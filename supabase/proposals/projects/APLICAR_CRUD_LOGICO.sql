-- PROPUESTA PARA REVISIÓN. No modifica autenticación, simuladores, cursos ni DECE.
-- Se aplica sobre la base institucional existente; nunca importa el esquema antiguo.
-- Generado por scripts/prepare-projects-crud-upgrade.mjs.
BEGIN;
DO $$ DECLARE dependency text; missing text[] := ARRAY[]::text[]; BEGIN
 FOREACH dependency IN ARRAY ARRAY['institutions','profiles','memberships','roles','module_settings','projects','budget_items','expenses','project_members','expense_files','audit_events','academic_periods','pages','page_sections','section_type_schemas','publication_versions','themes','site_settings','menus'] LOOP
  IF to_regclass('public.'||dependency) IS NULL THEN missing:=array_append(missing,'tabla public.'||dependency); END IF;
 END LOOP;
 FOREACH dependency IN ARRAY ARRAY['public.is_super_admin()','public.project_can_manage(uuid)','auth.uid()','auth.jwt()'] LOOP
  IF to_regprocedure(dependency) IS NULL THEN missing:=array_append(missing,'función '||dependency); END IF;
 END LOOP;
 FOREACH dependency IN ARRAY ARRAY['memberships.is_active','profiles.mfa_required','profiles.mfa_enabled','projects.is_active','project_members.full_name','project_members.email','expense_files.file_path'] LOOP
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=split_part(dependency,'.',1) AND column_name=split_part(dependency,'.',2)) THEN missing:=array_append(missing,'columna public.'||dependency); END IF;
 END LOOP;
 FOREACH dependency IN ARRAY ARRAY['storage.objects','storage.buckets'] LOOP
  IF to_regclass(dependency) IS NULL THEN missing:=array_append(missing,'tabla '||dependency); END IF;
 END LOOP;
 IF cardinality(missing)>0 THEN RAISE EXCEPTION 'Faltan dependencias: %. No se ha aplicado ningún cambio.',array_to_string(missing,', '); END IF;
END $$;

-- Fuente: 202610220000_projects_dependencies.sql
-- Dependencias del CRUD sobre las tablas institucionales ya existentes.
-- No altera cuentas, configuración MFA ni la función compartida is_super_admin.

CREATE OR REPLACE FUNCTION public.projects_session_verified()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.profile_id=auth.uid()
 AND (p.mfa_required OR p.mfa_enabled) AND coalesce(auth.jwt()->>'aal','aal1')<>'aal2');
$$;
REVOKE ALL ON FUNCTION public.projects_session_verified() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.projects_session_verified() TO authenticated;
CREATE OR REPLACE FUNCTION public.project_module_enabled(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.institutions i JOIN public.module_settings m USING(institution_id)
 WHERE i.institution_id=target AND i.is_active AND m.module_name='projects' AND m.is_enabled);
$$;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('project-receipts','project-receipts',false,10485760,ARRAY['application/pdf','image/png','image/jpeg'])
ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=10485760,allowed_mime_types=EXCLUDED.allowed_mime_types;
CREATE OR REPLACE FUNCTION public.project_receipt_access(object_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM public.expenses e JOIN public.budget_items b USING(budget_item_id)
 JOIN public.projects p USING(project_id) WHERE e.expense_id::text=split_part(object_path,'/',2)
 AND p.institution_id::text=split_part(object_path,'/',1)
 AND array_length(string_to_array(object_path,'/'),1)=3 AND split_part(object_path,'/',3)<>''
 AND public.project_can_manage(p.institution_id));
$$;
REVOKE ALL ON FUNCTION public.project_receipt_access(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.project_receipt_access(text) TO authenticated;
DROP POLICY IF EXISTS project_receipts_private ON storage.objects;
CREATE POLICY project_receipts_private ON storage.objects AS RESTRICTIVE TO authenticated
USING(bucket_id<>'project-receipts' OR public.project_receipt_access(name))
WITH CHECK(bucket_id<>'project-receipts' OR public.project_receipt_access(name));
DROP POLICY IF EXISTS project_receipts_no_anon ON storage.objects;
CREATE POLICY project_receipts_no_anon ON storage.objects AS RESTRICTIVE TO anon
USING(bucket_id<>'project-receipts') WITH CHECK(bucket_id<>'project-receipts');
DROP POLICY IF EXISTS project_receipts_read ON storage.objects;
CREATE POLICY project_receipts_read ON storage.objects FOR SELECT TO authenticated
USING(bucket_id='project-receipts' AND public.project_receipt_access(name));
DROP POLICY IF EXISTS project_receipts_insert ON storage.objects;
CREATE POLICY project_receipts_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='project-receipts' AND public.project_receipt_access(name));
DROP POLICY IF EXISTS project_receipts_delete ON storage.objects;

ALTER TABLE public.expense_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.expense_files FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON public.expense_files TO authenticated;
DROP POLICY IF EXISTS project_receipt_metadata_scope ON public.expense_files;
CREATE POLICY project_receipt_metadata_scope ON public.expense_files AS RESTRICTIVE TO authenticated
USING(split_part(file_path,'/',2)=expense_id::text AND public.project_receipt_access(file_path))
WITH CHECK(split_part(file_path,'/',2)=expense_id::text AND public.project_receipt_access(file_path));
DROP POLICY IF EXISTS project_receipt_metadata_read ON public.expense_files;
CREATE POLICY project_receipt_metadata_read ON public.expense_files FOR SELECT TO authenticated USING(public.project_receipt_access(file_path));
DROP POLICY IF EXISTS project_receipt_metadata_insert ON public.expense_files;
CREATE POLICY project_receipt_metadata_insert ON public.expense_files FOR INSERT TO authenticated
WITH CHECK(public.project_receipt_access(file_path) AND EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='project-receipts' AND o.name=file_path));
DROP POLICY IF EXISTS project_receipt_metadata_delete ON public.expense_files;


-- Fuente: 202610220001_shared_roles.sql
-- Compatibilidad con los roles y membresías de arquitectura-admin.
-- Propuesta para integración: ejecutar primero en una base local de pruebas.
-- Requiere memberships.is_active del esquema compartido; no cambia Auth ni MFA.

CREATE OR REPLACE FUNCTION public.project_can_manage(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.projects_session_verified() AND public.project_module_enabled(target) AND
 (public.is_super_admin() OR EXISTS(SELECT 1 FROM public.memberships m JOIN public.roles r USING(role_id)
 WHERE m.profile_id=auth.uid() AND m.institution_id=target AND m.is_active
 AND r.name::text IN ('institution_admin','project_manager','projects_manager')));
$$;
CREATE OR REPLACE FUNCTION public.project_can_publish(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.project_can_manage(target) AND (public.is_super_admin() OR EXISTS(
 SELECT 1 FROM public.memberships m JOIN public.roles r USING(role_id)
 WHERE m.profile_id=auth.uid() AND m.institution_id=target AND m.is_active AND r.name='institution_admin'));
$$;
CREATE OR REPLACE FUNCTION public.portal_editor_allowed(target uuid, publishing boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.projects_session_verified() AND EXISTS(SELECT 1 FROM public.institutions i
 JOIN public.module_settings m USING(institution_id) WHERE i.institution_id=target AND i.is_active
 AND m.module_name='portal' AND m.is_enabled) AND (public.is_super_admin() OR EXISTS(
 SELECT 1 FROM public.memberships m JOIN public.roles r USING(role_id) WHERE m.profile_id=auth.uid()
 AND m.institution_id=target AND m.is_active
 AND (r.name='institution_admin' OR (NOT publishing AND r.name::text IN ('editor','content_editor')))));
$$;
CREATE OR REPLACE FUNCTION public.project_member_options(target_institution uuid)
RETURNS TABLE(profile_id uuid,full_name text,email varchar)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT p.profile_id,concat_ws(' ',p.first_name,p.last_name),p.email FROM public.profiles p
 JOIN public.memberships m USING(profile_id) WHERE m.institution_id=target_institution AND m.is_active
 AND public.project_can_manage(target_institution) ORDER BY p.first_name,p.last_name;
$$;
REVOKE ALL ON FUNCTION public.project_can_manage(uuid), public.project_can_publish(uuid),
 public.portal_editor_allowed(uuid,boolean), public.project_member_options(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_can_manage(uuid), public.project_can_publish(uuid),
 public.portal_editor_allowed(uuid,boolean), public.project_member_options(uuid) TO authenticated;


-- Fuente: 202610220002_projects_crud_logical.sql
-- Ejecutar después de 202610220001_shared_roles.sql. Sin eliminación física.

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


-- Fuente: 202610220003_portal_logical.sql
-- Conserva las versiones anteriores de secciones, navegación y publicaciones.

-- También instala el editor cuando la base institucional aún no tiene borradores.
-- No requiere ejecutar la versión antigua que publicaba con borrado físico.
CREATE TABLE IF NOT EXISTS public.portal_editor_drafts (
 page_id uuid PRIMARY KEY REFERENCES public.pages(page_id) ON DELETE RESTRICT,
 revision integer NOT NULL CHECK(revision>0), snapshot jsonb NOT NULL,
 updated_by uuid REFERENCES public.profiles(profile_id), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_editor_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_editor_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.portal_editor_drafts TO authenticated;
DROP POLICY IF EXISTS portal_draft_read ON public.portal_editor_drafts;
CREATE POLICY portal_draft_read ON public.portal_editor_drafts FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.pages p WHERE p.page_id=portal_editor_drafts.page_id AND public.portal_editor_allowed(p.institution_id)));
INSERT INTO public.portal_editor_drafts(page_id,revision,snapshot)
SELECT DISTINCT ON(v.page_id) v.page_id,v.version_number,v.content_snapshot FROM public.publication_versions v
WHERE v.content_snapshot->>'publication_state'='draft' AND NOT EXISTS(
 SELECT 1 FROM public.publication_versions newer WHERE newer.page_id=v.page_id AND newer.version_number>v.version_number
 AND coalesce(newer.content_snapshot->>'publication_state','published')='published')
ORDER BY v.page_id,v.version_number DESC
ON CONFLICT(page_id) DO NOTHING;
INSERT INTO public.section_type_schemas(type,properties_schema,default_properties)
SELECT kind::public.section_type,
 '{"type":"object","properties":{"title":{"type":"string"},"body":{"type":"string"},"image_url":{"type":"string"},"alt":{"type":"string"},"url":{"type":"string"},"link_label":{"type":"string"}}}'::jsonb,
 '{}'::jsonb FROM unnest(ARRAY['banner','text','news','events','staff','honors','gallery','links','simulators','transparency','social_links']) kind
ON CONFLICT(type) DO NOTHING;
GRANT SELECT ON public.section_type_schemas TO authenticated;
DROP POLICY IF EXISTS portal_editor_pages_read ON public.pages;
CREATE POLICY portal_editor_pages_read ON public.pages FOR SELECT TO authenticated USING(public.portal_editor_allowed(institution_id));
CREATE OR REPLACE FUNCTION public.portal_editor_retention_version() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 1 $$;
REVOKE ALL ON FUNCTION public.portal_editor_retention_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_editor_retention_version() TO authenticated;
ALTER TABLE public.page_sections ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.menus ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;
ALTER TABLE public.page_sections DROP CONSTRAINT IF EXISTS unique_page_section_position;
CREATE UNIQUE INDEX IF NOT EXISTS page_sections_live_position ON public.page_sections(page_id,position) WHERE deleted_at IS NULL;
DROP POLICY IF EXISTS page_sections_live_only ON public.page_sections;
CREATE POLICY page_sections_live_only ON public.page_sections AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(deleted_at IS NULL);
DROP POLICY IF EXISTS menus_live_only ON public.menus;
CREATE POLICY menus_live_only ON public.menus AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(deleted_at IS NULL);
DROP POLICY IF EXISTS portal_editor_sections_read ON public.page_sections;
CREATE POLICY portal_editor_sections_read ON public.page_sections FOR SELECT TO authenticated USING(EXISTS(SELECT 1 FROM public.pages p WHERE p.page_id=page_sections.page_id AND public.portal_editor_allowed(p.institution_id)));
DROP POLICY IF EXISTS portal_editor_menus_read ON public.menus;
CREATE POLICY portal_editor_menus_read ON public.menus FOR SELECT TO authenticated USING(public.portal_editor_allowed(institution_id));
DROP POLICY IF EXISTS publication_versions_published_only ON public.publication_versions;
CREATE POLICY publication_versions_published_only ON public.publication_versions AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(coalesce(content_snapshot->>'publication_state','published')='published');
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['page_sections','menus','publication_versions'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS portal_retain_records ON public.%I',tab);
  EXECUTE format('CREATE TRIGGER portal_retain_records BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.projects_prevent_physical_delete()',tab);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION public.portal_editor_save(target_institution uuid,target_page uuid,expected_revision integer,snapshot jsonb,publish boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 page_row public.pages%ROWTYPE; current_revision integer; next_revision integer; theme_key uuid;
 section jsonb; menu jsonb; n integer; saved jsonb; menu_ids jsonb := '{}'::jsonb; menu_key text; parent_key text; new_menu uuid; trail text[]; social record; link_value text;
BEGIN
 IF NOT public.portal_editor_allowed(target_institution,publish) THEN RAISE EXCEPTION 'No tienes permiso para editar o publicar este portal.' USING ERRCODE='42501'; END IF;
 -- Un solo escritor por institución protege portada, tema, menús y revisiones.
 PERFORM 1 FROM public.institutions WHERE institution_id=target_institution FOR UPDATE;
 IF expected_revision IS NULL OR expected_revision<0 OR publish IS NULL THEN RAISE EXCEPTION 'Revisión o acción inválida.'; END IF;
 IF snapshot->>'schema_version' IS DISTINCT FROM '1' OR nullif(btrim(snapshot->>'title'),'') IS NULL
 OR length(snapshot->>'title')>255 OR coalesce(snapshot->>'slug','') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
 OR length(snapshot->>'slug')>100 OR nullif(btrim(snapshot#>>'{settings,site_title}'),'') IS NULL
 OR length(snapshot#>>'{settings,site_title}')>255 OR coalesce(snapshot->>'template','') NOT IN ('classic','cards','editorial')
 OR coalesce(snapshot#>>'{theme,primary_color}','') !~ '^#[0-9a-fA-F]{6}$'
 OR coalesce(snapshot#>>'{theme,secondary_color}','') !~ '^#[0-9a-fA-F]{6}$'
 OR nullif(btrim(snapshot#>>'{theme,font_family}'),'') IS NULL OR length(snapshot#>>'{theme,font_family}')>100
 OR jsonb_typeof(snapshot->'is_homepage') IS DISTINCT FROM 'boolean'
 OR jsonb_typeof(snapshot->'sections') IS DISTINCT FROM 'array' OR jsonb_typeof(snapshot->'menus') IS DISTINCT FROM 'array'
 THEN RAISE EXCEPTION 'Configuración de página inválida.'; END IF;
 IF jsonb_array_length(snapshot->'sections')>40 OR jsonb_array_length(snapshot->'menus')>30 THEN RAISE EXCEPTION 'Demasiadas secciones o enlaces.'; END IF;
 IF coalesce(snapshot#>>'{settings,logo_url}','')<>'' AND (snapshot#>>'{settings,logo_url}' !~ '^https://[^[:space:]\\]+$') THEN RAISE EXCEPTION 'Logotipo inválido.'; END IF;
 IF length(snapshot#>>'{settings,contact_email}')>255 OR length(snapshot#>>'{settings,contact_phone}')>50 THEN RAISE EXCEPTION 'Contacto demasiado largo.'; END IF;
 IF snapshot#>'{settings,social_links}' IS NOT NULL THEN
   IF jsonb_typeof(snapshot#>'{settings,social_links}') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Redes sociales inválidas.'; END IF;
   FOR social IN SELECT * FROM jsonb_each_text(snapshot#>'{settings,social_links}') LOOP
     IF social.value IS NULL OR social.value !~ '^https://[^[:space:]\\]+$' THEN RAISE EXCEPTION 'Red social inválida.'; END IF;
   END LOOP;
 END IF;
 n:=0;
 FOR menu IN SELECT value FROM jsonb_array_elements(snapshot->'menus') LOOP
   menu_key:=coalesce(nullif(menu->>'id',''),'menu-'||n);
   IF menu_ids ? menu_key THEN RAISE EXCEPTION 'Identificador de menú duplicado.'; END IF;
   menu_ids:=menu_ids||jsonb_build_object(menu_key,gen_random_uuid()::text);
   n:=n+1;
 END LOOP;
 n:=0;
 FOR menu IN SELECT value FROM jsonb_array_elements(snapshot->'menus') LOOP
   IF nullif(btrim(menu->>'label'),'') IS NULL OR length(menu->>'label')>100 OR length(menu->>'url')>255
   OR coalesce(menu->>'url','') !~ '^(https://[^[:space:]\\]+|/([^/[:space:]\\][^[:space:]\\]*)?)$' THEN RAISE EXCEPTION 'Enlace de menú inválido.'; END IF;
   IF menu ? 'is_visible' AND jsonb_typeof(menu->'is_visible') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Visibilidad de menú inválida.'; END IF;
   menu_key:=coalesce(nullif(menu->>'id',''),'menu-'||n);
   trail:=ARRAY[menu_key]; parent_key:=nullif(menu->>'parent_id','');
   WHILE parent_key IS NOT NULL LOOP
     IF NOT (menu_ids ? parent_key) OR parent_key=ANY(trail) THEN RAISE EXCEPTION 'Grupo de menú inválido o circular.'; END IF;
     trail:=array_append(trail,parent_key);
     SELECT nullif(value->>'parent_id','') INTO parent_key FROM jsonb_array_elements(snapshot->'menus') WITH ORDINALITY entry(value,ord)
     WHERE coalesce(nullif(value->>'id',''),'menu-'||(ord-1))=parent_key;
   END LOOP;
   n:=n+1;
 END LOOP;
 FOR section IN SELECT value FROM jsonb_array_elements(snapshot->'sections') LOOP
   IF NOT EXISTS(SELECT 1 FROM public.section_type_schemas WHERE type::text=section->>'type' AND is_active)
   OR jsonb_typeof(section->'properties') IS DISTINCT FROM 'object'
   OR jsonb_typeof(section->'is_visible') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Tipo o propiedades de sección inválidos.'; END IF;
   IF coalesce(section#>>'{properties,url}','')<>'' AND section#>>'{properties,url}' !~ '^(https://[^[:space:]\\]+|/([^/[:space:]\\][^[:space:]\\]*)?)$' THEN RAISE EXCEPTION 'Enlace de sección inválido.'; END IF;
   FOREACH link_value IN ARRAY ARRAY[section#>>'{properties,button_url}',section#>>'{properties,secondary_url}'] LOOP
     IF coalesce(link_value,'')<>'' AND link_value !~ '^(https://[^[:space:]\\]+|/([^/[:space:]\\][^[:space:]\\]*)?)$' THEN RAISE EXCEPTION 'Destino de botón inválido.'; END IF;
   END LOOP;
   IF coalesce(section#>>'{properties,image_url}','')<>'' AND
   (section#>>'{properties,image_url}' !~ '^https://[^[:space:]\\]+$' OR nullif(btrim(section#>>'{properties,alt}'),'') IS NULL) THEN RAISE EXCEPTION 'Imagen o texto alternativo inválidos.'; END IF;
 END LOOP;
 IF target_page IS NULL THEN
   IF expected_revision<>0 THEN RAISE EXCEPTION 'Revisión inicial inválida.'; END IF;
   INSERT INTO public.pages(institution_id,title,slug,status,is_homepage)
   VALUES(target_institution,snapshot->>'title',snapshot->>'slug','draft',false) RETURNING * INTO page_row;
 ELSE
   SELECT * INTO page_row FROM public.pages WHERE page_id=target_page AND institution_id=target_institution;
   IF NOT FOUND THEN RAISE EXCEPTION 'Página no autorizada.' USING ERRCODE='42501'; END IF;
 END IF;
 SELECT greatest(coalesce((SELECT revision FROM public.portal_editor_drafts WHERE page_id=page_row.page_id),0),
 coalesce((SELECT max(version_number) FROM public.publication_versions WHERE page_id=page_row.page_id),0)) INTO current_revision;
 IF current_revision<>expected_revision THEN RAISE EXCEPTION 'La página tiene una versión más reciente. Recarga antes de guardar.' USING ERRCODE='40001'; END IF;
 next_revision:=current_revision+1;
 saved:=snapshot || jsonb_build_object('publication_state',CASE WHEN publish THEN 'published' ELSE 'draft' END);
 INSERT INTO public.portal_editor_drafts(page_id,revision,snapshot,updated_by)
 VALUES(page_row.page_id,next_revision,saved,auth.uid()) ON CONFLICT(page_id) DO UPDATE
 SET revision=EXCLUDED.revision,snapshot=EXCLUDED.snapshot,updated_by=EXCLUDED.updated_by,updated_at=now();
 IF publish THEN
   SELECT theme_id INTO theme_key FROM public.site_settings WHERE institution_id=target_institution;
   IF theme_key IS NULL THEN
     INSERT INTO public.themes(institution_id,name,primary_color,secondary_color,font_family,appearance_config)
     VALUES(target_institution,'Portal '||page_row.page_id::text,snapshot#>>'{theme,primary_color}',snapshot#>>'{theme,secondary_color}',snapshot#>>'{theme,font_family}',jsonb_build_object('template',snapshot->>'template')) RETURNING theme_id INTO theme_key;
   ELSE
     UPDATE public.themes SET primary_color=snapshot#>>'{theme,primary_color}',secondary_color=snapshot#>>'{theme,secondary_color}',font_family=snapshot#>>'{theme,font_family}',
     appearance_config=appearance_config||jsonb_build_object('template',snapshot->>'template') WHERE institution_id=target_institution AND theme_id=theme_key;
   END IF;
   INSERT INTO public.site_settings(institution_id,site_title,logo_url,footer_text,theme_id)
   VALUES(target_institution,snapshot#>>'{settings,site_title}',nullif(snapshot#>>'{settings,logo_url}',''),snapshot#>>'{settings,footer_text}',theme_key)
   ON CONFLICT(institution_id) DO UPDATE SET site_title=EXCLUDED.site_title,logo_url=EXCLUDED.logo_url,footer_text=EXCLUDED.footer_text,theme_id=EXCLUDED.theme_id;
   UPDATE public.site_settings SET
     contact_email=CASE WHEN snapshot->'settings' ? 'contact_email' THEN nullif(snapshot#>>'{settings,contact_email}','') ELSE contact_email END,
     contact_phone=CASE WHEN snapshot->'settings' ? 'contact_phone' THEN nullif(snapshot#>>'{settings,contact_phone}','') ELSE contact_phone END,
     social_links=coalesce(snapshot#>'{settings,social_links}',social_links)
   WHERE institution_id=target_institution;
   UPDATE public.page_sections SET deleted_at=clock_timestamp(),is_visible=false WHERE page_id=page_row.page_id AND deleted_at IS NULL;
   n:=0;
   FOR section IN SELECT value FROM jsonb_array_elements(snapshot->'sections') LOOP
     INSERT INTO public.page_sections(page_id,type,position,is_visible,properties)
     VALUES(page_row.page_id,(section->>'type')::public.section_type,n,(section->>'is_visible')::boolean,section->'properties'); n:=n+1;
   END LOOP;
   UPDATE public.menus SET deleted_at=clock_timestamp(),is_visible=false WHERE institution_id=target_institution AND deleted_at IS NULL;
   n:=0;
   FOR menu IN SELECT value FROM jsonb_array_elements(snapshot->'menus') LOOP
     menu_key:=coalesce(nullif(menu->>'id',''),'menu-'||n);
     INSERT INTO public.menus(menu_id,institution_id,label,url,position,is_external,is_visible)
     VALUES((menu_ids->>menu_key)::uuid,target_institution,menu->>'label',menu->>'url',n,(menu->>'url') LIKE 'https://%',coalesce((menu->>'is_visible')::boolean,true)); n:=n+1;
   END LOOP;
   n:=0;
   FOR menu IN SELECT value FROM jsonb_array_elements(snapshot->'menus') LOOP
     menu_key:=coalesce(nullif(menu->>'id',''),'menu-'||n);
     UPDATE public.menus SET parent_id=(menu_ids->>nullif(menu->>'parent_id',''))::uuid WHERE menu_id=(menu_ids->>menu_key)::uuid;
     n:=n+1;
   END LOOP;
   IF (snapshot->>'is_homepage')::boolean THEN UPDATE public.pages SET is_homepage=false WHERE institution_id=target_institution AND page_id<>page_row.page_id; END IF;
   UPDATE public.pages SET title=snapshot->>'title',slug=snapshot->>'slug',is_homepage=(snapshot->>'is_homepage')::boolean,status='published' WHERE page_id=page_row.page_id;
   INSERT INTO public.publication_versions(page_id,version_number,content_snapshot,published_by) VALUES(page_row.page_id,next_revision,saved,auth.uid());
 END IF;
 INSERT INTO public.audit_events(institution_id,profile_id,action,entity_type,entity_id,payload)
 VALUES(target_institution,auth.uid(),CASE WHEN publish THEN 'PORTAL_PUBLISH' ELSE 'PORTAL_DRAFT' END,'pages',page_row.page_id::text,jsonb_build_object('revision',next_revision));
 RETURN jsonb_build_object('page_id',page_row.page_id,'revision',next_revision,'status',CASE WHEN publish THEN 'published' ELSE page_row.status::text END,'snapshot',saved);
END;
$$;

REVOKE ALL ON FUNCTION public.portal_editor_save(uuid,uuid,integer,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.portal_editor_save(uuid,uuid,integer,jsonb,boolean) TO authenticated;
-- Las escrituras del editor pasan por la transacción y sus permisos institucionales.
REVOKE INSERT,UPDATE,DELETE ON public.pages,public.page_sections,public.themes,public.site_settings,public.menus,public.publication_versions FROM authenticated,anon;
GRANT SELECT ON public.pages,public.page_sections,public.themes,public.site_settings,public.menus,public.publication_versions TO authenticated;
CREATE OR REPLACE FUNCTION public.portal_editor_content_version() RETURNS integer LANGUAGE sql IMMUTABLE AS $$ SELECT 2 $$;
REVOKE ALL ON FUNCTION public.portal_editor_content_version() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_editor_content_version() TO authenticated;
-- Repara únicamente la jerarquía que el editor anterior aplanó en El Esfuerzo.
-- Las otras instituciones y los enlaces personalizados permanecen intactos.
DO $$
DECLARE tenant uuid; parent_menu uuid;
BEGIN
 SELECT institution_id INTO tenant FROM public.institutions WHERE slug='ue-el-esfuerzo';
 IF tenant IS NOT NULL AND (SELECT count(*) FROM public.menus WHERE institution_id=tenant AND label='Institución' AND parent_id IS NULL AND deleted_at IS NULL)=1 THEN
   SELECT menu_id INTO parent_menu FROM public.menus WHERE institution_id=tenant AND label='Institución' AND parent_id IS NULL AND deleted_at IS NULL;
   UPDATE public.menus m SET parent_id=parent_menu
   WHERE m.institution_id=tenant AND m.deleted_at IS NULL AND m.parent_id IS NULL
     AND m.label IN ('Nosotros','Oferta educativa')
     AND NOT EXISTS(SELECT 1 FROM public.menus sibling WHERE sibling.parent_id=parent_menu AND sibling.position=m.position AND sibling.deleted_at IS NULL);
 END IF;
END $$;


-- Fuente: 202610200004_portal_assets.sql
-- Imágenes públicas de identidad institucional; requiere portal_editor_atomic.

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('portal-assets','portal-assets',true,5242880,ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=true,file_size_limit=5242880,allowed_mime_types=EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.portal_asset_can_upload(object_path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE tenant uuid;
BEGIN
 IF object_path !~ '^[0-9a-fA-F-]{36}/[0-9a-fA-F-]{36}\.(png|jpg|webp)$' THEN RETURN false; END IF;
 BEGIN tenant:=split_part(object_path,'/',1)::uuid; EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
 RETURN public.portal_editor_allowed(tenant,false);
END;
$$;
REVOKE ALL ON FUNCTION public.portal_asset_can_upload(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_asset_can_upload(text) TO authenticated;

DROP POLICY IF EXISTS portal_assets_insert ON storage.objects;
CREATE POLICY portal_assets_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK(bucket_id='portal-assets' AND public.portal_asset_can_upload(name));
DROP POLICY IF EXISTS portal_assets_insert_scope ON storage.objects;
CREATE POLICY portal_assets_insert_scope ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK(bucket_id<>'portal-assets' OR public.portal_asset_can_upload(name));
DROP POLICY IF EXISTS portal_assets_no_anon_writes ON storage.objects;
CREATE POLICY portal_assets_no_anon_writes ON storage.objects AS RESTRICTIVE FOR INSERT TO anon
WITH CHECK(bucket_id<>'portal-assets');
-- Versioned URLs are immutable. Deletion/retention is an administrative operation,
-- so replacing a logo cannot break another page that still references the image.
DROP POLICY IF EXISTS portal_assets_no_updates ON storage.objects;
CREATE POLICY portal_assets_no_updates ON storage.objects AS RESTRICTIVE FOR UPDATE TO anon,authenticated
USING(bucket_id<>'portal-assets') WITH CHECK(bucket_id<>'portal-assets');
DROP POLICY IF EXISTS portal_assets_no_deletes ON storage.objects;
CREATE POLICY portal_assets_no_deletes ON storage.objects AS RESTRICTIVE FOR DELETE TO anon,authenticated USING(bucket_id<>'portal-assets');

NOTIFY pgrst, 'reload schema';
COMMIT;
