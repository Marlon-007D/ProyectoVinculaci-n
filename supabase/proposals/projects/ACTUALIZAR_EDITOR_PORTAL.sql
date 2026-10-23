-- Actualiza contacto y submenús conservando datos e historial.
-- Requiere APLICAR_CRUD_LOGICO.sql instalado. Generado por prepare-projects-crud-upgrade.mjs.
BEGIN;
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


NOTIFY pgrst, 'reload schema';
COMMIT;
