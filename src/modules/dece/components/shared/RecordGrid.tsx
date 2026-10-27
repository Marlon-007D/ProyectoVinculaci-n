import type { FocusEventHandler, ReactNode, Ref } from 'react'
import styles from './RecordGrid.module.css'

export function RecordGrid({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return <ul className={`${styles.grid} ${className ?? ''}`} aria-label={label}>{children}</ul>
}

export function RecordCard({ children, className, tabIndex, onFocus, ref }: { children: ReactNode; className?: string; tabIndex?: number; onFocus?: FocusEventHandler<HTMLElement>; ref?: Ref<HTMLElement> }) {
  return <article ref={ref} className={`${styles.card} ${className ?? ''}`} tabIndex={tabIndex} onFocus={onFocus}>{children}</article>
}
