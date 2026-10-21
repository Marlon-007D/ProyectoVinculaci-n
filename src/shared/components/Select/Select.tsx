import type { SelectHTMLAttributes } from 'react'
import './Select.css'

interface Option { value: string; label: string }
interface Props extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> { label: string; options: Option[] }

export function Select({ label, id, options, ...props }: Props) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return <label className="shared-select" htmlFor={selectId}>{label}<select id={selectId} {...props}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
}
