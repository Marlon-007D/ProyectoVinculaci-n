import type { ReactNode } from 'react'
import { PrivateContentSkeleton } from '../../../site/components/Layout/PrivateContentSkeleton';
import { Plus } from 'lucide-react'
import Swal from 'sweetalert2'
import { Button } from '../../../../shared/components/Button/Button'
import styles from './shared.module.css'

export function Breadcrumbs({ items }: { items: Array<{ label: string; onClick?: () => void }> }) {
  return <nav aria-label="Migas de pan" className={styles.breadcrumb}><ol>{items.map((item, index) => <li key={`${item.label}-${index}`} aria-current={index === items.length - 1 ? 'page' : undefined}>{item.onClick ? <button type="button" onClick={item.onClick}>{item.label}</button> : item.label}</li>)}</ol></nav>
}

export function PageHeader({ title, description, action }: { title: string; description?: string; action?: { label: string; onClick: () => void } }) {
  return <header className={styles.header}><div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <Button className={styles.primary} variant="primary" type="button" onClick={action.onClick}><Plus aria-hidden="true" size={18} />{action.label}</Button>}</header>
}

export function Pagination({ page, size, total, onPage, onSize }: { page: number; size: number; total: number; onPage: (page: number) => void; onSize: (size: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size)); const start = total ? (page - 1) * size + 1 : 0; const end = Math.min(page * size, total)
  return <div className={styles.pagination}><label>Filas por página <select value={size} onChange={event => onSize(Number(event.target.value))}>{[10, 20, 30, 40].map(value => <option key={value}>{value}</option>)}</select></label><span aria-live="polite">Mostrando {start} a {end} de {total}</span><div><button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1}>Anterior</button><span aria-current="page">{page} / {pages}</span><button type="button" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages}>Siguiente</button></div></div>
}

export function ViewToggle({ value, onChange }: { value: 'table' | 'cards'; onChange: (value: 'table' | 'cards') => void }) { return <div className={styles.toggle} role="group" aria-label="Vista de casos">{(['table', 'cards'] as const).map(item => <button key={item} type="button" aria-pressed={value === item} onClick={() => onChange(item)}>{item === 'table' ? 'Tabla' : 'Tarjetas'}</button>)}</div> }
export function StatusBadge({ children }: { children: ReactNode }) { return <span className={styles.badge}>{children}</span> }
export function RiskBadge({ children }: { children: ReactNode }) { return <span className={`${styles.badge} ${styles.risk}`}>{children}</span> }
export function EmptyState({ children }: { children: ReactNode }) { return <p className={styles.empty}>{children}</p> }
export function LoadingState() { return <PrivateContentSkeleton label="Cargando contenido" /> }
export function FormGrid({ children }: { children: ReactNode }) { return <div className={styles.formGrid}>{children}</div> }
export function FormField({ label, required, help, error, children }: { label: string; required?: boolean; help?: string; error?: string; children: ReactNode }) { return <div className={styles.field}><label>{label}{required && <> <span aria-hidden="true">*</span> <small>obligatorio</small></>}</label>{children}{help && <small>{help}</small>}{error && <small role="alert">{error}</small>}</div> }
export async function confirmDialog(title: string, text: string) { const result = await Swal.fire({ title, text, icon: 'warning', showCancelButton: true, confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar', focusCancel: true }); return result.isConfirmed }
