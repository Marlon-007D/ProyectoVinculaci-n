import type { PageSection } from '../site/types/page';
export const sectionTypes = { banner: 'Portada', text: 'Texto institucional', news: 'Noticias publicadas', events: 'Eventos aprobados', staff: 'Personal público', honors: 'Cuadro de honor aprobado', gallery: 'Imagen / galería', links: 'Enlace', simulators: 'Simuladores', transparency: 'Transparencia', social_links: 'Red social' };
export interface PortalSnapshot {
  schema_version: 1;
  title: string; slug: string; is_homepage: boolean;
  template: 'classic' | 'cards' | 'editorial';
  settings: { site_title: string; logo_url: string; footer_text: string };
  theme: { primary_color: string; secondary_color: string; font_family: string };
  menus: Array<{ label: string; url: string }>;
  sections: PageSection[];
}
export function newSnapshot(name: string): PortalSnapshot {
  return { schema_version: 1, title: '', slug: '', is_homepage: false, template: 'classic',
    settings: { site_title: name, logo_url: '', footer_text: '' },
    theme: { primary_color: '#123955', secondary_color: '#eaf2f5', font_family: 'Arial' },
    menus: [], sections: [] };
}
export function safeUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || /[\\\s]/.test(value)) return undefined;
  return /^https:\/\//i.test(value) || /^\/[^/]/.test(value) ? value : undefined;
}
export function textValue(value: unknown): string { return typeof value === 'string' ? value : ''; }
export function contrastText(hex: string): string {
  const rgb = [1,3,5].map(i => parseInt(hex.slice(i,i+2),16)/255).map(v => v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);
  const luminance=0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
  return luminance>0.179?'#000000':'#ffffff';
}
