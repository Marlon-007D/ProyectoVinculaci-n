import { ChevronLeft, ChevronRight, FolderOpen, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatCurrency } from '../../../../shared/utils/formatCurrency'
import { formatDate } from '../../../../shared/utils/formatDate'
import type { SavedInvoice } from '../types/invoice.types'
import './InvoiceHistory.css'

interface Props { invoices: SavedInvoice[]; notice: string; onLoad: (invoice: SavedInvoice) => void; onDelete: (id: string) => void }

export function InvoiceHistory({ invoices, notice, onLoad, onDelete }: Props) {
  const [page, setPage] = useState(1)
  const pageSize = 5
  const pageCount = Math.max(1, Math.ceil(invoices.length / pageSize))
  const visibleInvoices = invoices.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => setPage(current => Math.min(current, pageCount)), [pageCount])

  return <section className="invoice-history" aria-labelledby="invoice-history-title">
    <div className="invoice-history-heading"><div><h2 id="invoice-history-title">Facturas simuladas</h2></div><span>{invoices.length}</span></div>
    {invoices.length === 0 ? <p className="invoice-history-empty">Al guardar una factura, aparecerá aquí para que puedas volver a cargarla.</p> :
      <ul>{visibleInvoices.map(invoice => <li key={invoice.id}>
        <div className="invoice-history-icon"><FolderOpen size={19} /></div>
        <div className="invoice-history-info"><strong>{invoice.customer}</strong><small>{formatDate(invoice.createdAt)} · {invoice.lines.length} {invoice.lines.length === 1 ? 'ítem' : 'ítems'}</small></div>
        <strong className="invoice-history-total">{formatCurrency(invoice.totals.total)}</strong>
        <button className="history-action" onClick={() => onLoad(invoice)}>Editar</button>
        <button className="icon-button history-delete" onClick={() => onDelete(invoice.id)} aria-label={`Eliminar factura de ${invoice.customer}`}><Trash2 size={17} /></button>
      </li>)}</ul>}
    {invoices.length > pageSize && <nav className="invoice-history-pagination" aria-label="Paginación de facturas">
      <button className="history-page-button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} aria-label="Página anterior"><ChevronLeft size={18} /></button>
      <span>Página {page} de {pageCount}</span>
      <button className="history-page-button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Página siguiente"><ChevronRight size={18} /></button>
    </nav>}
    {notice && <p className="invoice-history-notice" role="status">{notice}</p>}
  </section>
}
