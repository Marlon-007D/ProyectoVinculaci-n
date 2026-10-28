import { ArrowDown, ArrowUp, MousePointerClick, Plus, Trash2 } from 'lucide-react';
import { textValue } from './contract';
import { LinkDestination, type PortalDestination } from './LinkDestination';
import styles from './ButtonList.module.css';

export interface PortalButton { id: string; label: string; url: string }
export const MAX_BANNER_BUTTONS = 4;

/** Banner buttons; pages saved before the list existed keep their two fixed buttons. */
export function bannerButtons(p: Record<string, unknown>): PortalButton[] {
  if (Array.isArray(p.buttons)) return p.buttons.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item, index) => ({ id: textValue(item.id) || `button-${index}`, label: textValue(item.label), url: textValue(item.url) }));
  return [
    { id: 'legacy-0', label: textValue(p.link_label ?? p.button_label), url: textValue(p.url ?? p.button_url) },
    { id: 'legacy-1', label: textValue(p.secondary_label), url: textValue(p.secondary_url) },
  ].filter(button => button.label || button.url);
}

interface Props { buttons: PortalButton[]; onChange: (buttons: PortalButton[]) => void; destinations: PortalDestination[] }

export function ButtonList({ buttons, onChange, destinations }: Props) {
  const update = (id: string, change: Partial<PortalButton>) => onChange(buttons.map(button => button.id === id ? { ...button, ...change } : button));
  function move(index: number, direction: number) {
    const next = [...buttons];
    [next[index], next[index + direction]] = [next[index + direction], next[index]];
    onChange(next);
  }
  return <fieldset className={styles.list}>
    <legend>Botones de la portada</legend>
    <p className={styles.hint}>Puedes no poner ninguno o añadir hasta {MAX_BANNER_BUTTONS}. El primero se destaca con el color principal.</p>
    {!buttons.length && <div className={styles.empty}><MousePointerClick size={22} aria-hidden="true" /><span>Esta portada no tiene botones.</span></div>}
    {buttons.map((button, index) => <section className={styles.item} key={button.id} aria-label={`Botón ${index + 1}`}>
      <div className={styles.heading}>
        <strong>Botón {index + 1}{index === 0 && <span className={styles.badge}>Principal</span>}</strong>
        <div className={styles.actions}>
          <button type="button" aria-label={`Subir botón ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp size={15} /></button>
          <button type="button" aria-label={`Bajar botón ${index + 1}`} disabled={index === buttons.length - 1} onClick={() => move(index, 1)}><ArrowDown size={15} /></button>
          <button type="button" className={styles.remove} onClick={() => onChange(buttons.filter(item => item.id !== button.id))}><Trash2 size={15} aria-hidden="true" />Quitar</button>
        </div>
      </div>
      <label>Texto del botón<input required maxLength={40} placeholder={index === 0 ? 'Por ejemplo: Conoce nuestra oferta' : 'Por ejemplo: Contáctanos'} value={button.label} onChange={event => update(button.id, { label: event.target.value })} /></label>
      <LinkDestination label="¿A dónde lleva este botón?" allowNone={false} value={button.url} onChange={url => update(button.id, { url })} destinations={destinations} />
    </section>)}
    <button type="button" className={styles.add} disabled={buttons.length >= MAX_BANNER_BUTTONS}
      onClick={() => onChange([...buttons, { id: crypto.randomUUID(), label: '', url: destinations[0]?.url ?? '/' }])}>
      <Plus size={16} aria-hidden="true" />{buttons.length >= MAX_BANNER_BUTTONS ? `Máximo ${MAX_BANNER_BUTTONS} botones` : 'Añadir botón'}
    </button>
  </fieldset>;
}
