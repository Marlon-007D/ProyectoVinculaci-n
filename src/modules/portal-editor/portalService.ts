import { menuIdentity, validateMenuHierarchy } from './portalMenus';
import { institutionalMenuEntries } from '../site/utils/institutionalNavigation';
import { supabase } from '../../core/supabaseClient';
import { getUserInstitutions } from '../projects/integration/accessService';
import { MAX_SECTION_RECORDS, newSnapshot, normalizeSnapshot, safeUrl, sectionTypes, withCurrentIdentity, type PortalSnapshot } from './contract';
import { parseSnapshot } from '../site/utils/snapshot';
import type { Json } from '../site/types/common';

export interface PortalDraft { page_id:string;revision:number;status:string;snapshot:PortalSnapshot;published_slug?:string }
interface PageRow {page_id:string;institution_id:string;title:string;slug:string;status:string;is_homepage:boolean}
interface VersionRow {publication_version_id:string;page_id:string;version_number:number;content_snapshot:PortalSnapshot & {publication_state?:string};published_by:string|null}
async function actor(institutionId:string,publish=false){
  const {data,error}=await supabase.auth.getUser();if(error)throw error;if(!data.user)throw new Error('Inicia sesión para editar.');
  const institutions=await getUserInstitutions(data.user.id);const institution=institutions.find(i=>i.institution_id===institutionId);
  const roles=publish?['super_admin','institution_admin']:['super_admin','institution_admin','editor','content_editor'];
  if(!institution||!roles.includes(institution.role)||!institution.enabled_modules?.includes('portal'))throw new Error('Tu cuenta no tiene permiso para esta operación del portal.');
  return data.user;
}
/** Latest published version only; older snapshots are history and are not needed to edit. */
async function latestVersion(pageId:string):Promise<VersionRow|null>{
  const {data,error}=await supabase.from('publication_versions').select('publication_version_id,page_id,version_number,content_snapshot,published_by').eq('page_id',pageId).order('version_number',{ascending:false}).limit(1).maybeSingle();
  if(error)throw error;return data as unknown as VersionRow|null;
}
export interface PortalSectionOption { type:string; default_properties:Record<string,unknown> }
/** Public records the portal can show; undefined when the count could not be read. */
export type PublicRecordCounts = { news?: number; events?: number; honors?: number };
export async function loadPublicRecordCounts(institutionId:string):Promise<PublicRecordCounts>{
  // Same filters as the public readers in site/services/content.ts, counted without loading rows.
  const [news,events,honors]=await Promise.all([
    supabase.from('news').select('news_id',{count:'exact',head:true}).eq('institution_id',institutionId).eq('is_published',true),
    supabase.from('events').select('event_id',{count:'exact',head:true}).eq('institution_id',institutionId).gte('event_date',new Date().toISOString()),
    supabase.from('public_honors').select('honor_id',{count:'exact',head:true}).eq('institution_id',institutionId),
  ]);
  const value=(result:{error:unknown;count:number|null})=>result.error||typeof result.count!=='number'?undefined:result.count;
  return {news:value(news),events:value(events),honors:value(honors)};
}
export async function loadSectionCatalog():Promise<PortalSectionOption[]>{
  const {data,error}=await supabase.from('section_type_schemas').select('type,default_properties').eq('is_active',true).order('type');
  if(error)throw error;
  return (data??[]).filter(row=>Object.hasOwn(sectionTypes,row.type)).map(row=>({type:row.type,default_properties:row.default_properties&&typeof row.default_properties==='object'&&!Array.isArray(row.default_properties)?row.default_properties:{}}));
}
export async function loadPortalConfiguration(institutionId:string,institutionName:string):Promise<PortalSnapshot>{
  const base=newSnapshot(institutionName);
  const [settings,menus]=await Promise.all([
    supabase.from('site_settings').select('site_title,logo_url,footer_text,contact_email,contact_phone,social_links,theme_id').eq('institution_id',institutionId).maybeSingle(),
    supabase.from('menus').select('menu_id,parent_id,is_visible,label,url').eq('institution_id',institutionId).order('position'),
  ]);
  for(const result of [settings,menus])if(result.error)throw result.error;
  if(settings.data){base.settings={site_title:settings.data.site_title,logo_url:settings.data.logo_url??'',footer_text:settings.data.footer_text??'',contact_email:settings.data.contact_email??'',contact_phone:settings.data.contact_phone??'',social_links:settings.data.social_links??{}};
    if(settings.data.theme_id){const theme=await supabase.from('themes').select('primary_color,secondary_color,font_family,appearance_config').eq('institution_id',institutionId).eq('theme_id',settings.data.theme_id).single();if(theme.error)throw theme.error;base.theme={primary_color:theme.data.primary_color,secondary_color:theme.data.secondary_color,font_family:theme.data.font_family};const template=theme.data.appearance_config?.template;if(['classic','cards','editorial'].includes(template))base.template=template;}
  }
  base.menus=menuIdentity((menus.data??[]).map(menu=>({...menu,id:menu.menu_id})));return base;
}
async function existingSnapshot(page:PageRow,config?:PortalSnapshot):Promise<PortalSnapshot>{
  let base:PortalSnapshot;
  if(config)base=structuredClone(config);
  else{
    const institution=await supabase.from('institutions').select('name').eq('institution_id',page.institution_id).single();if(institution.error)throw institution.error;
    base=await loadPortalConfiguration(page.institution_id,institution.data.name);
  }
  base.title=page.title;base.slug=page.slug;base.is_homepage=page.is_homepage;
  const sections=await supabase.from('page_sections').select('page_section_id,type,position,is_visible,properties').eq('page_id',page.page_id).order('position');if(sections.error)throw sections.error;
  base.sections=parseSnapshot({sections:sections.data??[]} as Json).sections;return base;
}
/**
 * Pages published by the public portal (not by this editor) store only `sections`/`template`.
 * Read them with the same parser the portal uses, so the editor opens exactly what visitors see.
 */
export function legacyPublishedSnapshot(page:Pick<PageRow,'title'|'slug'|'is_homepage'>,content:unknown,config:PortalSnapshot):PortalSnapshot{
  const parsed=parseSnapshot(content as Json);
  return {...structuredClone(config),publication_state:'published',title:page.title,slug:page.slug,is_homepage:page.is_homepage,
    template:parsed.template??config.template,
    // The portal renders "hero" exactly like "banner"; the editor and the server only know "banner".
    sections:parsed.sections.map(section=>section.type==='hero'?{...section,type:'banner'}:section)};
}
export async function listPortalPages(institutionId:string):Promise<PortalDraft[]>{
  await actor(institutionId);
  const {data,error}=await supabase.from('pages').select('page_id,institution_id,title,slug,status,is_homepage').eq('institution_id',institutionId).order('title');
  if(error)throw error;
  // One identity read for the whole list, not one per page.
  const config=await loadPortalConfiguration(institutionId,'');
  const complete=(value:PortalSnapshot):PortalSnapshot=>{
    const current=withCurrentIdentity(value,config);
    return {...current,menus:menuIdentity(current.menus)};
  };
  return Promise.all((data??[]).map(async page=>{
    const [latest,draft]=await Promise.all([latestVersion(page.page_id),supabase.from('portal_editor_drafts').select('revision,snapshot').eq('page_id',page.page_id).maybeSingle()]);
    if(draft.error)throw draft.error;
    const published_slug=page.status==='published'?page.slug:undefined;
    if(draft.data)return {page_id:page.page_id,status:page.status,revision:draft.data.revision,snapshot:complete(draft.data.snapshot as PortalSnapshot),published_slug};
    if(latest)return {page_id:page.page_id,status:page.status,revision:latest.version_number,
      snapshot:complete(latest.content_snapshot?.schema_version===1?latest.content_snapshot:legacyPublishedSnapshot(page,latest.content_snapshot,config)),published_slug};
    return {page_id:page.page_id,status:page.status,revision:0,snapshot:complete(await existingSnapshot(page,config)),published_slug};
  }));
}
function validate(snapshot:PortalSnapshot){
  validateMenuHierarchy(snapshot.menus);
  for(const url of Object.values(snapshot.settings.social_links??{}))if(!/^https:\/\//.test(url)||!safeUrl(url))throw new Error('Las redes sociales deben usar direcciones HTTPS.');
  if(!snapshot.title.trim()||snapshot.title.length>255||!snapshot.settings.site_title.trim()||snapshot.settings.site_title.length>255)throw new Error('Completa el título y el nombre institucional, con hasta 255 caracteres.');
  if(!snapshot.theme.font_family.trim()||snapshot.theme.font_family.length>100)throw new Error('Introduce una tipografía de hasta 100 caracteres.');
  if(!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(snapshot.slug)||snapshot.slug.length>100)throw new Error('Usa una ruta en minúsculas, con números o guiones.');
  if(!/^#[0-9a-f]{6}$/i.test(snapshot.theme.primary_color)||!/^#[0-9a-f]{6}$/i.test(snapshot.theme.secondary_color))throw new Error('Selecciona colores válidos.');
  if(snapshot.settings.logo_url&&(!safeUrl(snapshot.settings.logo_url)||!snapshot.settings.logo_url.startsWith('https://')))throw new Error('El logotipo debe usar HTTPS.');
  if(snapshot.sections.length>40||snapshot.menus.length>30)throw new Error('Usa como máximo 40 secciones y 30 enlaces.');
  for(const menu of snapshot.menus)if(!menu.label.trim()||menu.label.length>100||menu.url.length>255||!safeUrl(menu.url))throw new Error('Revisa el texto y destino de los enlaces.');
  if(!['classic','cards','editorial'].includes(snapshot.template))throw new Error('Selecciona una plantilla válida.');
  for(const section of snapshot.sections){if(!Object.hasOwn(sectionTypes,section.type))throw new Error('Tipo de sección no compatible.');const p=section.properties;
    if(p.limit!==undefined&&(!Number.isInteger(p.limit)||Number(p.limit)<1||Number(p.limit)>MAX_SECTION_RECORDS))throw new Error(`La cantidad de registros de una sección debe estar entre 1 y ${MAX_SECTION_RECORDS}.`);
    if(Array.isArray(p.buttons)){if(p.buttons.length>4)throw new Error('La portada admite hasta 4 botones.');for(const b of p.buttons){const button=(b&&typeof b==='object'?b:{}) as Record<string,unknown>;if(typeof button.label!=='string'||!button.label.trim()||button.label.length>40||!safeUrl(button.url))throw new Error('Cada botón de la portada necesita un texto de hasta 40 caracteres y un destino válido.');}}if(p.url&&!safeUrl(p.url))throw new Error('Hay un enlace de sección no válido.');if(p.image_url&&(!safeUrl(p.image_url)||!String(p.image_url).startsWith('https://')||!String(p.alt??'').trim()))throw new Error('Cada imagen necesita una URL HTTPS y texto alternativo.');}
}
/** The server saves a private draft or publishes the entire configuration atomically. */
export async function savePortal(institutionId:string,pageId:string|null,expectedRevision:number,snapshot:PortalSnapshot,publish:boolean):Promise<PortalDraft>{
  snapshot=normalizeSnapshot({...snapshot,menus:menuIdentity(snapshot.menus)});
  validate(snapshot);await actor(institutionId,publish);
  snapshot={...snapshot,menus:institutionalMenuEntries()};
  const capability=await supabase.rpc('portal_editor_content_version');
  if(capability.error||capability.data!==2)throw new Error('Falta aplicar ACTUALIZAR_EDITOR_PORTAL.sql para guardar contacto y submenús sin perder información.');
  if(publish){
    const retention=await supabase.rpc('portal_editor_retention_version');
    if(retention.error||retention.data!==1)throw new Error('La conservación del historial todavía no está habilitada. No se ha publicado ningún cambio.');
  }
  const {data,error}=await supabase.rpc('portal_editor_save',{
    target_institution:institutionId,target_page:pageId,expected_revision:expectedRevision,snapshot,publish,
  });
  if(error)throw error;
  return data as PortalDraft;
}
export async function loadPublishedPortal(institutionSlug:string,pageSlug:string|null){
  const institution=await supabase.from('institutions').select('institution_id,slug').eq('slug',institutionSlug).eq('is_active',true).maybeSingle();if(institution.error)throw institution.error;if(!institution.data)return null;
  const module=await supabase.from('module_settings').select('is_enabled').eq('institution_id',institution.data.institution_id).eq('module_name','portal').maybeSingle();if(module.error)throw module.error;if(module.data?.is_enabled!==true)return null;
  const pages=await supabase.from('pages').select('page_id,institution_id,title,slug,status,is_homepage').eq('institution_id',institution.data.institution_id).eq('status','published');if(pages.error)throw pages.error;if(!pages.data?.length)return null;
  const versions=await supabase.from('publication_versions').select('page_id,version_number,content_snapshot').in('page_id',pages.data.map(p=>p.page_id)).or('content_snapshot->>publication_state.is.null,content_snapshot->>publication_state.eq.published').order('version_number',{ascending:false});if(versions.error)throw versions.error;
  const latest=new Map<string,PortalSnapshot>();for(const version of versions.data??[])if(!latest.has(version.page_id))latest.set(version.page_id,version.content_snapshot as PortalSnapshot);
  const page=pages.data.find(p=>{const s=latest.get(p.page_id);return pageSlug?(s?.slug??p.slug)===pageSlug:p.is_homepage;});if(!page)return null;
  const saved=latest.get(page.page_id);
  if(!saved){
    // A failed first publication can leave a page with only a draft version.
    const history=await supabase.from('publication_versions').select('publication_version_id').eq('page_id',page.page_id).limit(1);
    if(history.error)throw history.error;
    if(history.data?.length)return null;
  }
  let snapshot:PortalSnapshot;
  if(saved?.schema_version===1)snapshot=saved;
  else{
    snapshot=await existingSnapshot(page);
    if(saved){const legacy=parseSnapshot(saved as unknown as Json);snapshot={...snapshot,sections:legacy.sections,title:legacy.title??snapshot.title};}
  }
  const news=snapshot.sections.some(s=>s.is_visible&&s.type==='news')?await supabase.from('news').select('title,summary,cover_image_url').eq('institution_id',institution.data.institution_id).eq('is_published',true).order('published_at',{ascending:false}).limit(12):{data:[],error:null};
  const staff=snapshot.sections.some(s=>s.is_visible&&s.type==='staff')?await supabase.from('staff').select('full_name,position,photo_url').eq('institution_id',institution.data.institution_id).eq('is_public',true).order('position_order').limit(30):{data:[],error:null};
  const events=snapshot.sections.some(s=>s.is_visible&&s.type==='events')?await supabase.from('events').select('title,description,event_date,location').eq('institution_id',institution.data.institution_id).order('event_date',{ascending:false}).limit(12):{data:[],error:null};
  const honors=snapshot.sections.some(s=>s.is_visible&&s.type==='honors')?await supabase.from('public_honors').select('student_name,achievement,photo_url').eq('institution_id',institution.data.institution_id).limit(12):{data:[],error:null};
  for(const result of [news,staff,events,honors])if(result.error)throw result.error;
  return {snapshot,slug:institutionSlug,news:(news.data??[]).map(n=>({title:n.title,body:n.summary,image_url:n.cover_image_url})),staff:(staff.data??[]).map(s=>({title:s.full_name,body:s.position,image_url:s.photo_url})),events:(events.data??[]).map(e=>({title:e.title,body:[e.description,e.event_date,e.location].filter(Boolean).join(' · ')})),honors:(honors.data??[]).map(h=>({title:h.student_name,body:h.achievement,image_url:h.photo_url}))};
}
