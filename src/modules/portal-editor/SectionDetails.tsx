import { Plus, Trash2 } from 'lucide-react';
import type { PageSection } from '../site/types/page';
import { textValue } from './contract';
import styles from './SectionDetails.module.css';

interface Props { section: PageSection; onChange: (properties: Record<string, unknown>) => void }
export function SectionDetails({ section, onChange }: Props) {
  const p = section.properties;
  const set = (key: string, value: unknown) => onChange({ ...p, [key]: value });
  const banner = section.type === 'banner';
  const connected = ['news', 'events', 'staff', 'honors'].includes(section.type);
  const list = Array.isArray(p.items) ? p.items.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : section.type === 'links' && p.url ? [{title:p.link_label || p.title,description:p.body,url:p.url}] : [];
  const field = (key: string, label: string) => <label key={key}>{label}<input value={textValue(p[key])} onChange={event => set(key, event.target.value)} /></label>;
  return <div className={styles.fields}>
    {!connected && field('eyebrow', 'Texto sobre el título')}
    {banner && <>
      <label>Altura de la portada<select value={textValue(p.size) || 'full'} onChange={event => set('size', event.target.value)}><option value="full">Amplia</option><option value="compact">Compacta</option></select></label>
      {field('secondary_label', 'Texto del segundo botón')}{field('secondary_url', 'Destino del segundo botón')}
    </>}
    {section.type === 'text' && <>
      <label>Fondo de la sección<select value={textValue(p.tone)} onChange={event => set('tone', event.target.value)}><option value="">Blanco</option><option value="tint">Color suave</option><option value="dark">Oscuro</option></select></label>
      <label>Presentación de la lista<select value={textValue(p.layout)} onChange={event => set('layout', event.target.value)}><option value="">Tarjetas</option><option value="stats">Cifras destacadas</option></select></label>
    </>}
    {connected && <label>Cantidad máxima de registros<input type="number" min={1} max={24} value={typeof p.limit === 'number' ? p.limit : 12} onChange={event => set('limit', Number(event.target.value))} /></label>}
    {section.type === 'staff' && <label>Contenido del personal<select value={textValue(p.source) || 'institution'} onChange={event=>set('source',event.target.value)}><option value="institution">Directorio institucional</option><option value="manual">Lista editable de esta página</option></select></label>}
    {(['text', 'links', 'gallery'].includes(section.type) || (section.type === 'staff' && p.source === 'manual')) && <fieldset className={styles.list}>
      <legend>{section.type === 'gallery' ? 'Imágenes de la galería' : 'Elementos de la sección'}</legend>
      {list.map((item, index) => <div className={styles.item} key={index}>
        {(section.type === 'gallery' ? [['image_url', 'Dirección HTTPS de la imagen'], ['alt', 'Descripción de la imagen'], ['caption', 'Pie de imagen']] : [['title', 'Título'], ['description', 'Descripción'], ...(section.type === 'links' ? [['url', 'Destino']] : [])]).map(([key, label]) => <label key={key}>{label}<input value={textValue(item[key])} onChange={event => set('items', list.map((row, i) => i === index ? { ...row, [key]: event.target.value } : row))} /></label>)}
        <button type="button" onClick={() => set('items', list.filter((_, i) => i !== index))}><Trash2 size={16} />Quitar elemento {index + 1}</button>
      </div>)}
      <button type="button" disabled={list.length >= 24} onClick={() => set('items', [...list, {}])}><Plus size={16} />Añadir elemento</button>
    </fieldset>}
  </div>;
}
