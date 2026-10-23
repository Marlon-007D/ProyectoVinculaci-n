import {readFileSync,writeFileSync} from 'node:fs';
const folder='supabase/proposals/projects/';
const migrations=['202610220000_projects_dependencies.sql','202610220001_shared_roles.sql','202610220002_projects_crud_logical.sql','202610220003_portal_logical.sql','202610200004_portal_assets.sql'];
const guard=`-- PROPUESTA PARA REVISIÓN. No modifica autenticación, simuladores, cursos ni DECE.
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
`;
const content=guard+migrations.map(name=>'\n-- Fuente: '+name+'\n'+readFileSync(folder+name,'utf8').replace(/^(BEGIN;|COMMIT;)\s*$/gm,'')).join('\n')+"\nNOTIFY pgrst, 'reload schema';\nCOMMIT;\n";
writeFileSync(folder+'APLICAR_CRUD_LOGICO.sql',content);
console.log('Preparado '+folder+'APLICAR_CRUD_LOGICO.sql; no se ejecutó SQL.');
const portal=readFileSync(folder+'202610220003_portal_logical.sql','utf8');
const save=portal.slice(portal.indexOf('CREATE OR REPLACE FUNCTION public.portal_editor_save('),portal.indexOf('-- Las escrituras del editor'));
const capability=portal.slice(portal.indexOf('CREATE OR REPLACE FUNCTION public.portal_editor_content_version()')).replace(/COMMIT;/g,'');
writeFileSync(folder+'ACTUALIZAR_EDITOR_PORTAL.sql','-- Actualiza contacto y submenús conservando datos e historial.\n-- Requiere APLICAR_CRUD_LOGICO.sql instalado. Generado por prepare-projects-crud-upgrade.mjs.\nBEGIN;\n'+save+capability+"\nNOTIFY pgrst, 'reload schema';\nCOMMIT;\n");
