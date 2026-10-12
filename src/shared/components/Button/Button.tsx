import type { ButtonHTMLAttributes } from 'react'
import './Button.css'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: 'primary' | 'secondary' }

export function Button({ variant = 'secondary', className = '', ...props }: Props) {
  return <button className={`shared-button shared-button--${variant} ${className}`} {...props} />
}
