import { useId, useState } from 'react';
import { ExternalLink, FileText, Link2Off } from 'lucide-react';
import { institutionalMenuEntries } from '../site/utils/institutionalNavigation';
import { safeUrl } from './contract';
import styles from './LinkDestination.module.css';

export interface PortalDestination { label: string; url: string; group: 'Secciones del portal' | 'Páginas creadas' }
type Mode = 'none' | 'page' | 'external';

/** Fixed header destinations plus the institution's own pages, without duplicates. */
export function portalDestinations(pages: Array<{ title: string; slug: string }>): PortalDestination[] {
  const fixed = institutionalMenuEntries().filter(entry => !(entry.url === '/' && entry.label !== 'Inicio'))
    .map(entry => ({ label: entry.label, url: entry.url, group: 'Secciones del portal' as const }));
  const known = new Set(fixed.map(item => item.url));
  const created = pages.filter(page => page.slug && !known.has(`/?slug=${page.slug}`))
    .map(page => ({ label: page.title || page.slug, url: `/?slug=${page.slug}`, group: 'Páginas creadas' as const }));
  return [...fixed, ...created];
}

function modeOf(value: string, allowNone: boolean): Mode {
  if (!value) return allowNone ? 'none' : 'page';
  return value.startsWith('/') ? 'page' : 'external';
}

interface Props { label: string; value: string; onChange: (url: string) => void; destinations: PortalDestination[]; allowNone?: boolean }

export function LinkDestination({ label, value, onChange, destinations, allowNone = true }: Props) {
  const id = useId();
  const [mode, setMode] = useState<Mode>(() => modeOf(value, allowNone));
  const current = destinations.find(item => item.url === value);
  const invalidExternal = mode === 'external' && Boolean(value) && !safeUrl(value);
  function choose(next: Mode) {
    setMode(next);
    if (next === 'none') onChange('');
    if (next === 'page' && !value.startsWith('/')) onChange(destinations[0]?.url ?? '/');
    if (next === 'external' && value.startsWith('/')) onChange('');
  }
  const options: Array<{ mode: Mode; text: string; Icon: typeof FileText }> = [
    ...(allowNone ? [{ mode: 'none' as const, text: 'Sin enlace', Icon: Link2Off }] : []),
    { mode: 'page', text: 'Página del portal', Icon: FileText },
    { mode: 'external', text: 'Sitio externo', Icon: ExternalLink },
  ];
  return <fieldset className={styles.destination}>
    <legend>{label}</legend>
    <div className={styles.modes} role="radiogroup" aria-label={label}>
      {options.map(({ mode: option, text, Icon }) => <label key={option} className={styles.mode}>
        <input type="radio" name={id} checked={mode === option} onChange={() => choose(option)} />
        <span><Icon size={15} aria-hidden="true" />{text}</span>
      </label>)}
    </div>
    {mode === 'page' && <label className={styles.field}>Página de destino
      <select value={value} onChange={event => onChange(event.target.value)}>
        {!current && value && <option value={value}>Otra dirección ({value})</option>}
        {(['Secciones del portal', 'Páginas creadas'] as const).map(group => {
          const items = destinations.filter(item => item.group === group);
          return items.length ? <optgroup key={group} label={group}>{items.map(item => <option key={item.url} value={item.url}>{item.label}</option>)}</optgroup> : null;
        })}
      </select>
      <span className={styles.hint}>Al hacer clic, el visitante irá a «{current?.label ?? value}» dentro de este portal.</span>
    </label>}
    {mode === 'external' && <label className={styles.field}>Dirección del sitio web
      <input type="url" inputMode="url" required={!allowNone} maxLength={2048} placeholder="https://www.ejemplo.com" value={value} aria-invalid={invalidExternal} onChange={event => onChange(event.target.value.trim())} />
      <span className={invalidExternal ? styles.error : styles.hint}>{invalidExternal ? 'La dirección debe comenzar con https:// y no tener espacios.' : 'Copia la dirección completa desde la barra del navegador. Debe comenzar con https://'}</span>
    </label>}
  </fieldset>;
}
