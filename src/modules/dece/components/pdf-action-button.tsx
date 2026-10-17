import { useState } from 'react'

export default function PdfActionButton({ label, generate, className = 'btn btn-outline-secondary' }: { label: string; generate: () => Promise<void>; className?: string }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function run() {
    if (busy) return
    setBusy(true); setMessage('Generando PDF…')
    try { await generate(); setMessage('PDF descargado correctamente.') }
    catch (cause) { setMessage(cause instanceof Error ? cause.message : 'No se pudo generar el PDF.') }
    finally { setBusy(false) }
  }
  return <span className="d-inline-flex flex-column align-items-start"><button type="button" className={className} onClick={() => void run()} disabled={busy} aria-label={busy ? `Generando ${label}` : label}>{busy ? 'Generando…' : label}</button><span className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">{message}</span>{message && !busy && message !== 'PDF descargado correctamente.' && <span role="alert" className="small text-danger">{message}</span>}</span>
}
