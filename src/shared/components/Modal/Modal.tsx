import type { ReactNode } from 'react'
import { X } from 'lucide-react'
import './Modal.css'

interface Props { open: boolean; title: string; onClose: () => void; children: ReactNode }

export function Modal({ open, title, onClose, children }: Props) {
  if (!open) return null
  return <div className="modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal-panel" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button className="modal-close" onClick={onClose} aria-label="Cerrar"><X size={20} /></button></header>{children}</section>
  </div>
}
