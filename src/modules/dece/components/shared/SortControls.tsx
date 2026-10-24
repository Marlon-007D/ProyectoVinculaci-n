import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import styles from './SortControls.module.css'

export type CaseSortKey = 'case_number' | 'student' | 'category' | 'risk_level' | 'status' | 'updated_at'
export type SortOption = { key: CaseSortKey; label: string }
export const CASE_SORT_OPTIONS: SortOption[] = [
  { key: 'case_number', label: 'Número de caso' }, { key: 'student', label: 'Estudiante' }, { key: 'category', label: 'Categoría' },
  { key: 'risk_level', label: 'Riesgo' }, { key: 'status', label: 'Estado' }, { key: 'updated_at', label: 'Última actualización' },
]
export function SortButton({ option, active, direction, onClick, pressed }: { option: SortOption; active: boolean; direction: 'asc' | 'desc'; onClick: () => void; pressed?: boolean }) {
  const Icon = !active ? ArrowUpDown : direction === 'asc' ? ArrowUp : ArrowDown
  const spoken = `${option.label}, orden ${direction === 'asc' ? 'ascendente' : 'descendente'}`
  return <button type="button" className={styles.sortButton} aria-label={active ? spoken : `Ordenar por ${option.label}`} aria-pressed={pressed === undefined ? undefined : active} onClick={onClick}><span>{option.label}</span><Icon aria-hidden="true" size={15} /></button>
}
export function SortBar({ order, direction, onSort }: { order: CaseSortKey; direction: 'asc' | 'desc'; onSort: (key: CaseSortKey) => void }) {
  return <div className={styles.sortBar} role="group" aria-label="Ordenar por"><span>Ordenar por</span>{CASE_SORT_OPTIONS.map(option => <SortButton key={option.key} option={option} active={order === option.key} direction={direction} pressed onClick={() => onSort(option.key)} />)}</div>
}
