import { Plus, Trash2 } from 'lucide-react';
import type { PageSection } from '../site/types/page';
import { MAX_SECTION_RECORDS, textValue } from './contract';
import { LinkDestination, type PortalDestination } from './LinkDestination';
import { ButtonList, bannerButtons } from './ButtonList';
import { PortalImageInput } from './PortalImageInput';
import type { PublicRecordCounts } from './portalService';
import styles from './SectionDetails.module.css';

// Singular/plural nouns of the public records each connected section shows.
const recordNames: Record<keyof PublicRecordCounts, [string, string, string]> = {
  news: ['noticia', 'noticias', 'publicadas'],
  events: ['evento', 'eventos', 'próximos'],
  honors: ['reconocimiento', 'reconocimientos', 'públicos'],
};

interface Props { section: PageSection; onChange: (properties: Record<string, unknown>) => void; destinations: PortalDestination[]; recordCounts: PublicRecordCounts | null; institutionId: string; onBusyChange: (busy: boolean) => void }

function RecordLimit({ type, value, available, onChange }: { type: keyof PublicRecordCounts; value: unknown; available: number | undefined; onChange: (limit: number) => void }) {
  const [one, many, state] = recordNames[type];
  const max = Math.max(1, Math.min(MAX_SECTION_RECORDS, available ?? MAX_SECTION_RECORDS));
  const current = Math.min(max, typeof value === 'number' && value > 0 ? Math.floor(value) : Math.min(6, max));
  const hint = available === undefined ? `No se pudo consultar cuántos hay; puedes mostrar hasta ${MAX_SECTION_RECORDS}.`
    : available === 0 ? `Todavía no hay ${many} ${state}. La sección aparecerá cuando exista al menos uno.`
      : `Hay ${available} ${available === 1 ? one : many} ${state}${available > MAX_SECTION_RECORDS ? `; se pueden mostrar hasta ${MAX_SECTION_RECORDS}` : ''}.`;
  return <label>Cantidad de {many} que se muestran
    <select disabled={available === 0} value={current} onChange={event => onChange(Number(event.target.value))}>
      {Array.from({ length: max }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count} {count === 1 ? one : many}</option>)}
    </select>
    <span className={styles.hint}>{hint}</span>
  </label>;
}

export function SectionDetails({ section, onChange, destinations, recordCounts, institutionId, onBusyChange }: Props) {
  const p = section.properties;
  const set = (key: string, value: unknown) => onChange({ ...p, [key]: value });
  const banner = section.type === 'banner';
  const connected = ['news', 'events', 'staff', 'honors'].includes(section.type);
  const counted = section.type in recordNames ? section.type as keyof PublicRecordCounts : null;
  const list = Array.isArray(p.items) ? p.items.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object') : section.type === 'links' && p.url ? [{title:p.link_label || p.title,description:p.body,url:p.url}] : [];
  const field = (key: string, label: string, maxLength: number, placeholder?: string) => <label key={key}>{label}<input maxLength={maxLength} placeholder={placeholder} value={textValue(p[key])} onChange={event => set(key, event.target.value)} /></label>;
  // Items with a picture (gallery, levels of a text section, manual staff) upload it with a mandatory description.
  const withImage = ['text', 'gallery', 'staff'].includes(section.type);
  const itemFields: Array<[string, string, number]> = section.type === 'gallery'
    ? [['alt', 'Descripción de la imagen (obligatoria)', 200], ['caption', 'Pie de imagen', 200]]
    : [['title', 'Título', 120], ['description', 'Descripción', 500]];
  const updateItem = (index: number, key: string, value: string) => set('items', list.map((row, i) => i === index ? { ...row, [key]: value } : row));
  return <div className={styles.fields}>
    {!connected && field('eyebrow', 'Texto pequeño sobre el título (opcional)', 80, 'Por ejemplo: Bienvenidos')}
    {banner && <>
      <label>Altura de la portada<select value={textValue(p.size) || 'full'} onChange={event => set('size', event.target.value)}><option value="full">Amplia</option><option value="compact">Compacta</option></select></label>
      <ButtonList buttons={bannerButtons(p)} destinations={destinations} onChange={buttons => set('buttons', buttons)} />
    </>}
    {section.type === 'text' && <>
      <label>Fondo de la sección<select value={textValue(p.tone)} onChange={event => set('tone', event.target.value)}><option value="">Blanco</option><option value="tint">Color suave</option><option value="dark">Oscuro</option></select></label>
      <label>Presentación de la lista<select value={textValue(p.layout)} onChange={event => set('layout', event.target.value)}><option value="">Tarjetas</option><option value="stats">Cifras destacadas</option></select></label>
    </>}
    {counted && <RecordLimit type={counted} value={p.limit} available={recordCounts?.[counted]} onChange={limit => set('limit', limit)} />}
    {section.type === 'staff' && <label>Contenido del personal<select value={textValue(p.source) || 'institution'} onChange={event=>set('source',event.target.value)}><option value="institution">Directorio institucional</option><option value="manual">Lista editable de esta página</option></select></label>}
    {(['text', 'links', 'gallery'].includes(section.type) || (section.type === 'staff' && p.source === 'manual')) && <fieldset className={styles.list}>
      <legend>{section.type === 'gallery' ? 'Imágenes de la galería' : 'Elementos de la sección'}</legend>
      {list.map((item, index) => <div className={styles.item} key={index}>
        {withImage && <PortalImageInput institutionId={institutionId} value={textValue(item.image_url)} onChange={url => updateItem(index, 'image_url', url)} onBusyChange={onBusyChange} label={`Imagen del elemento ${index + 1}`} />}
        {itemFields.map(([key, label, maxLength]) => <label key={key}>{label}<input maxLength={maxLength} required={key === 'alt' && Boolean(item.image_url)} value={textValue(item[key])} onChange={event => updateItem(index, key, event.target.value)} /></label>)}
        {withImage && section.type !== 'gallery' && Boolean(item.image_url) && <label>Descripción de la imagen (obligatoria)<input required maxLength={200} placeholder="Describe la imagen para quien no pueda verla" value={textValue(item.image_alt)} onChange={event => updateItem(index, 'image_alt', event.target.value)} /></label>}
        {section.type === 'links' && <LinkDestination label="¿A dónde lleva este elemento?" value={textValue(item.url)} onChange={url => set('items', list.map((row, i) => i === index ? { ...row, url } : row))} destinations={destinations} />}
        <button type="button" onClick={() => set('items', list.filter((_, i) => i !== index))}><Trash2 size={16} />Quitar elemento {index + 1}</button>
      </div>)}
      <button type="button" disabled={list.length >= 24} onClick={() => set('items', [...list, {}])}><Plus size={16} />Añadir elemento</button>
    </fieldset>}
  </div>;
}
