-- Editor institucional: borradores privados y publicación atómica sobre el modelo compartido.
-- Revisar con Dylan; no modifica autenticación ni módulos académicos/DECE.
BEGIN;
-- Catálogo compartido: conserva las definiciones que ya existan en cada despliegue.
INSERT INTO public.section_type_schemas(type,properties_schema,default_properties)
SELECT kind::public.section_type,
 '{"type":"object","properties":{"title":{"type":"string"},"body":{"type":"string"},"image_url":{"type":"string"},"alt":{"type":"string"},"url":{"type":"string"},"link_label":{"type":"string"}}}'::jsonb,
 '{}'::jsonb FROM unnest(ARRAY['banner','text','news','events','staff','honors','gallery','links','simulators','transparency','social_links']) kind
ON CONFLICT(type) DO NOTHING;
GRANT SELECT ON public.section_type_schemas TO authenticated;
CREATE OR REPLACE FUNCTION public.portal_editor_allowed(target uuid, publishing boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT public.projects_session_verified() AND EXISTS(SELECT 1 FROM public.institutions i
 JOIN public.module_settings m USING(institution_id) WHERE i.institution_id=target AND i.is_active
 AND m.module_name='portal' AND m.is_enabled) AND (public.is_super_admin() OR EXISTS(
 SELECT 1 FROM public.memberships m JOIN public.roles r USING(role_id) WHERE m.profile_id=auth.uid()
 AND m.institution_id=target AND (r.name IN ('institution_admin') OR (NOT publishing AND r.name='editor'))));
$$;
REVOKE ALL ON FUNCTION public.portal_editor_allowed(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_editor_allowed(uuid,boolean) TO authenticated;

CREATE TABLE IF NOT EXISTS public.portal_editor_drafts (
 page_id uuid PRIMARY KEY REFERENCES public.pages(page_id) ON DELETE CASCADE,
 revision integer NOT NULL CHECK(revision>0), snapshot jsonb NOT NULL,
 updated_by uuid REFERENCES public.profiles(profile_id), updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.portal_editor_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.portal_editor_drafts FROM anon,authenticated;
GRANT SELECT ON public.portal_editor_drafts TO authenticated;
DROP POLICY IF EXISTS portal_draft_read ON public.portal_editor_drafts;
CREATE POLICY portal_draft_read ON public.portal_editor_drafts FOR SELECT TO authenticated
USING(EXISTS(SELECT 1 FROM public.pages p WHERE p.page_id=portal_editor_drafts.page_id AND public.portal_editor_allowed(p.institution_id)));
-- Preserva el último borrador anterior y evita que el lector público lo trate como una versión.
INSERT INTO public.portal_editor_drafts(page_id,revision,snapshot)
SELECT DISTINCT ON(v.page_id) v.page_id,v.version_number,v.content_snapshot FROM public.publication_versions v
WHERE v.content_snapshot->>'publication_state'='draft' AND NOT EXISTS(
 SELECT 1 FROM public.publication_versions newer WHERE newer.page_id=v.page_id AND newer.version_number>v.version_number
 AND coalesce(newer.content_snapshot->>'publication_state','published')='published')
ORDER BY v.page_id,v.version_number DESC
ON CONFLICT(page_id) DO NOTHING;
-- Los borradores históricos se conservan; la política restrictiva de lectura impide publicarlos.
DROP POLICY IF EXISTS publication_versions_published_only ON public.publication_versions;
CREATE POLICY publication_versions_published_only ON public.publication_versions AS RESTRICTIVE FOR SELECT TO anon,authenticated USING(coalesce(content_snapshot->>'publication_state','published')='published');

CREATE OR REPLACE FUNCTION public.portal_editor_save(target_institution uuid,target_page uuid,expected_revision integer,snapshot jsonb,publish boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE
 page_row public.pages%ROWTYPE; current_revision integer; next_revision integer; theme_key uuid;
 section jsonb; menu jsonb; n integer; saved jsonb;
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
 FOR menu IN SELECT value FROM jsonb_array_elements(snapshot->'menus') LOOP
   IF nullif(btrim(menu->>'label'),'') IS NULL OR length(menu->>'label')>100 OR length(menu->>'url')>255
   OR coalesce(menu->>'url','') !~ '^(https://[^[:space:]\\]+|/([^/[:space:]\\][^[:space:]\\]*)?)$' THEN RAISE EXCEPTION 'Enlace de menú inválido.'; END IF;
 END LOOP;
 FOR section IN SELECT value FROM jsonb_array_elements(snapshot->'sections') LOOP
   IF NOT EXISTS(SELECT 1 FROM public.section_type_schemas WHERE type::text=section->>'type' AND is_active)
   OR jsonb_typeof(section->'properties') IS DISTINCT FROM 'object'
   OR jsonb_typeof(section->'is_visible') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Tipo o propiedades de sección inválidos.'; END IF;
   IF coalesce(section#>>'{properties,url}','')<>'' AND section#>>'{properties,url}' !~ '^(https://[^[:space:]\\]+|/([^/[:space:]\\][^[:space:]\\]*)?)$' THEN RAISE EXCEPTION 'Enlace de sección inválido.'; END IF;
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
   DELETE FROM public.page_sections WHERE page_id=page_row.page_id;
   n:=0;
   FOR section IN SELECT value FROM jsonb_array_elements(snapshot->'sections') LOOP
     INSERT INTO public.page_sections(page_id,type,position,is_visible,properties)
     VALUES(page_row.page_id,(section->>'type')::public.section_type,n,(section->>'is_visible')::boolean,section->'properties'); n:=n+1;
   END LOOP;
   DELETE FROM public.menus WHERE institution_id=target_institution;
   n:=0;
   FOR menu IN SELECT value FROM jsonb_array_elements(snapshot->'menus') LOOP
     INSERT INTO public.menus(institution_id,label,url,position,is_external)
     VALUES(target_institution,menu->>'label',menu->>'url',n,(menu->>'url') LIKE 'https://%'); n:=n+1;
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
REVOKE ALL ON FUNCTION public.portal_editor_save(uuid,uuid,integer,jsonb,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_editor_save(uuid,uuid,integer,jsonb,boolean) TO authenticated;
-- Impide saltarse la aprobación y la transacción desde REST.
REVOKE INSERT,UPDATE,DELETE ON public.pages,public.page_sections,public.themes,public.site_settings,public.menus,public.publication_versions FROM authenticated,anon;
GRANT SELECT ON public.pages,public.page_sections,public.themes,public.site_settings,public.menus,public.publication_versions TO authenticated;
DROP POLICY IF EXISTS portal_editor_pages_read ON public.pages;
CREATE POLICY portal_editor_pages_read ON public.pages FOR SELECT TO authenticated USING(public.portal_editor_allowed(institution_id));
COMMIT;
