import { useEffect, useRef, useState } from 'react'
import type { SavedInvoice } from '../types/invoice.types'
import { useInvoiceSimulator } from '../hooks/useInvoiceSimulator'
import { InvoiceForm } from '../components/InvoiceForm'
import { InvoiceResult } from '../components/InvoiceResult'
import { InvoiceHistory } from '../components/InvoiceHistory'
import './InvoiceSimulatorPage.css'

export function InvoiceSimulatorPage() {
  const invoice = useInvoiceSimulator()
  const formColumnRef = useRef<HTMLDivElement>(null)
  const [editToast, setEditToast] = useState(false)
  useEffect(() => {
    if (!editToast) return
    const timeoutId = window.setTimeout(() => setEditToast(false), 7000)
    return () => window.clearTimeout(timeoutId)
  }, [editToast])
  const handleEdit = (record: SavedInvoice) => {
    invoice.load(record)
    setEditToast(true)
    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    formColumnRef.current?.scrollIntoView({ behavior, block: 'start' })
  }
  return <section className="page-content invoice-page">
    <div className="workspace"><div className="invoice-form-column" ref={formColumnRef}>
      <InvoiceForm draft={invoice.draft} onField={invoice.updateField} onUpdate={invoice.updateLine} onAdd={invoice.addLine} onRemove={invoice.removeLine} onReset={invoice.reset} onSubmit={invoice.persist} />
      {invoice.notice && <p className="success-message" role="status">{invoice.notice}</p>}
      {editToast && <div className="edit-toast" role="status">Factura cargada para editar.</div>}
    </div><InvoiceResult totals={invoice.totals} /></div>
    <InvoiceHistory invoices={invoice.savedInvoices} notice={invoice.historyNotice} onLoad={handleEdit} onDelete={invoice.removeSaved} />
  </section>
}
