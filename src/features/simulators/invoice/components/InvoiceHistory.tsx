import { Check, ChevronLeft, ChevronRight, FolderOpen, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '../../../../shared/components/Button/Button'
import { Modal } from '../../../../shared/components/Modal/Modal'
import { formatCurrency } from '../../../../shared/utils/formatCurrency'
import { formatDate } from '../../../../shared/utils/formatDate'
import type { SavedInvoice } from '../types/invoice.types'
import './InvoiceHistory.css'

interface Props { invoices: SavedInvoice[]; notice: string; isLoading: boolean; onLoad: (invoice: SavedInvoice) => void; onDelete: (id: string) => void }

export function InvoiceHistory({ invoices, notice, isLoading, onLoad, onDelete }: Props) {
  const [page, setPage] = useState(1)
  const [invoiceToDelete, setInvoiceToDelete] = useState<SavedInvoice | null>(null)
  const pageSize = 5
  const pageCount = Math.max(1, Math.ceil(invoices.length / pageSize))
  const visibleInvoices = invoices.slice((page - 1) * pageSize, page * pageSize)

  useEffect(() => setPage(current => Math.min(current, pageCount)), [pageCount])

  return <section className="invoice-history" aria-labelledby="invoice-history-title">
    <div className="invoice-history-heading"><div><h2 id="invoice-history-title">Facturas simuladas</h2></div>{isLoading ? <span className="invoice-history-count-skeleton" aria-hidden="true" /> : <span>{invoices.length}</span>}</div>
    {isLoading ? <ul className="invoice-history-skeleton-list" aria-label="Cargando facturas" aria-busy="true">{[0, 1].map(item => <li key={item} className="invoice-history-skeleton-row"><span className="invoice-history-skeleton-icon" /><span className="invoice-history-skeleton-copy"><span /><span /></span><span className="invoice-history-skeleton-total" /></li>)}</ul> : invoices.length === 0 ? <p className="invoice-history-empty">Al guardar una factura, aparecerá aquí para que puedas volver a cargarla.</p> :
      <ul>{visibleInvoices.map(invoice => <li key={invoice.id}>
        <div className="invoice-history-icon"><FolderOpen size={19} /></div>
        <div className="invoice-history-info"><strong>{invoice.customer}</strong><small>{formatDate(invoice.createdAt)} · {invoice.lines.length} {invoice.lines.length === 1 ? 'ítem' : 'ítems'}</small></div>
        <strong className="invoice-history-total">{formatCurrency(invoice.totals.total)}</strong>
        <button className="history-action" onClick={() => onLoad(invoice)}>Editar</button>
        <button className="icon-button history-delete" onClick={() => setInvoiceToDelete(invoice)} aria-label={`Eliminar factura de ${invoice.customer}`}><Trash2 size={17} /></button>
      </li>)}</ul>}
    {invoices.length > pageSize && <nav className="invoice-history-pagination" aria-label="Paginación de facturas">
      <button className="history-page-button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page === 1} aria-label="Página anterior"><ChevronLeft size={18} /></button>
      <span>Página {page} de {pageCount}</span>
      <button className="history-page-button" onClick={() => setPage(current => Math.min(pageCount, current + 1))} disabled={page === pageCount} aria-label="Página siguiente"><ChevronRight size={18} /></button>
    </nav>}
    {notice && <p className="invoice-history-notice" role="status">{notice}</p>}
    <Modal open={invoiceToDelete !== null} title="Eliminar factura" onClose={() => setInvoiceToDelete(null)}>
      <p className="invoice-delete-confirmation">¿Confirmas que deseas eliminar la factura de <strong>{invoiceToDelete?.customer}</strong>? Esta acción no se puede deshacer.</p>
      <div className="invoice-delete-actions">
        <Button type="button" onClick={() => setInvoiceToDelete(null)}>Cancelar</Button>
        <Button type="button" variant="primary" onClick={() => { if (invoiceToDelete) onDelete(invoiceToDelete.id); setInvoiceToDelete(null) }}><Check size={17} aria-hidden="true" /> Confirmar eliminación</Button>
      </div>
    </Modal>
  </section>
}
