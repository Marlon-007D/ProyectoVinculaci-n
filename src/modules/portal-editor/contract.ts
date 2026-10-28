import type { PageSection } from '../site/types/page';
export const sectionTypes = { banner: 'Portada', text: 'Texto institucional', news: 'Noticias publicadas', events: 'Eventos aprobados', staff: 'Personal público', honors: 'Cuadro de honor aprobado', gallery: 'Imagen / galería', links: 'Enlace', simulators: 'Simuladores', transparency: 'Transparencia', social_links: 'Red social' };
export interface PortalSnapshot {
  schema_version: 1;
  publication_state?: 'draft' | 'published';
  title: string; slug: string; is_homepage: boolean;
  template: 'classic' | 'cards' | 'editorial';
  settings: { site_title: string; logo_url: string; footer_text: string; contact_email?: string; contact_phone?: string; social_links?: Record<string, string> };
  theme: { primary_color: string; secondary_color: string; font_family: string };
  menus: Array<{ id?: string; parent_id?: string | null; is_visible?: boolean; label: string; url: string }>;
  sections: PageSection[];
}
export function withCurrentIdentity(snapshot: PortalSnapshot, configuration: PortalSnapshot): PortalSnapshot {
  if (snapshot.publication_state === 'draft') return { ...snapshot, settings: { ...configuration.settings, ...snapshot.settings } };
  return { ...snapshot, settings: { ...configuration.settings }, theme: { ...configuration.theme }, menus: configuration.menus.map(menu => ({ ...menu })) };
}
export function newSnapshot(name: string): PortalSnapshot {
  return { schema_version: 1, title: '', slug: '', is_homepage: false, template: 'classic',
    settings: { site_title: name, logo_url: '', footer_text: '' },
    theme: { primary_color: '#123955', secondary_color: '#eaf2f5', font_family: 'Arial' },
    menus: [], sections: [] };
}
export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || /[\\\s]/.test(value)) return undefined;
  return /^https:\/\//i.test(value) || (value==='/'||/^\/[^/]/.test(value)) ? value : undefined;
}
export function textValue(value: unknown): string { return typeof value === 'string' ? value : ''; }
/** Page address from its title: "Oferta Educativa 2026" -> "oferta-educativa-2026". */
export function slugify(title: string): string {
  return title.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100).replace(/-+$/, '');
}
/** The public renderer never shows more than this many news, events or honors per section. */
export const MAX_SECTION_RECORDS = 24;
/** Aliases understood by Axel's public PageSections, preserving existing properties. */
export function normalizeSnapshot(snapshot: PortalSnapshot): PortalSnapshot {
  return {...snapshot,sections:snapshot.sections.map((section,position)=>{
    const p={...section.properties};
    // Older pages may carry larger or textual limits; keep them inside what the portal can show.
    if(p.limit!==undefined&&p.limit!==null&&p.limit!==''&&Number.isFinite(Number(p.limit)))p.limit=Math.min(MAX_SECTION_RECORDS,Math.max(1,Math.floor(Number(p.limit))));
    if(section.type==='banner'&&Array.isArray(p.buttons)){
      // The button list replaces the two fixed buttons; mirror the first two for older readers.
      const buttons=p.buttons.filter((b):b is Record<string,unknown>=>!!b&&typeof b==='object');
      delete p.url;delete p.link_label;
      for(const [index,[label,url]] of [['button_label','button_url'],['secondary_label','secondary_url']].entries()){
        if(buttons[index]){p[label]=textValue(buttons[index].label);p[url]=textValue(buttons[index].url);}
        else{delete p[label];delete p[url];}
      }
    }
    else if(section.type==='banner'){
      if(typeof p.body==='string')p.subtitle=p.body;
      if(typeof p.url==='string')p.button_url=p.url;
      if(typeof p.link_label==='string')p.button_label=p.link_label;
    }
    if(section.type==='links'&&!Array.isArray(p.items)&&typeof p.url==='string'&&p.url)
      p.items=[{title:textValue(p.link_label)||textValue(p.title)||'Consultar',url:p.url,description:textValue(p.body)}];
    return {...section,position,properties:p};
  })};
}
export function contrastText(hex: string): string {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v => v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  const luminance=0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
  return luminance>0.179?'#000000':'#ffffff';
}
