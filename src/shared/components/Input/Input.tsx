import type { InputHTMLAttributes } from 'react'
import './Input.css'

interface Props extends InputHTMLAttributes<HTMLInputElement> { label: string }

export function Input({ label, id, ...props }: Props) {
  const inputId = id ?? `field-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
  return <label className="shared-input" htmlFor={inputId}>{label}<input id={inputId} {...props} /></label>
}
