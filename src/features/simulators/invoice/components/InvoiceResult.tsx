import { useId, useState } from 'react'
import { ChevronDown, Landmark } from 'lucide-react'
import type { InvoiceLine, InvoiceTotals } from '../types/invoice.types'
import './InvoiceResult.css'

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

export function InvoiceResult({ totals, lines }: { totals: InvoiceTotals; lines: InvoiceLine[] }) {
  const [productsOpen, setProductsOpen] = useState(false)
  const productsListId = useId()
  const purchasedLines = lines.filter(line => line.quantity > 0)

  return <aside className="summary-card invoice-summary-card" onClick={event => {
    if (event.target instanceof Element && event.target.closest('button')) return
    setProductsOpen(open => !open)
  }}>
    <div className="summary-heading"><div className="summary-icon"><Landmark size={22} aria-hidden="true" /></div><div><p className="step-label">RESUMEN</p><h2>Total de la factura</h2></div></div>
    <section className="invoice-summary-products" aria-labelledby="invoice-summary-products-title">
      <button className="invoice-summary-products-toggle" id="invoice-summary-products-title" type="button" aria-expanded={productsOpen} aria-controls={productsListId} onClick={() => setProductsOpen(open => !open)}>
        <span>Productos <span className="invoice-summary-products-count">({purchasedLines.length})</span></span>
        <ChevronDown className={productsOpen ? 'is-open' : ''} size={18} aria-hidden="true" />
      </button>
      {productsOpen && <ul id={productsListId}>{purchasedLines.map(line => <li key={line.id}>
          <div><strong>{line.description}</strong><span>{line.quantity} × {usd.format(line.unitPrice)}</span></div>
          <strong>{usd.format(line.quantity * line.unitPrice)}</strong>
        </li>)}</ul>}
    </section>
    <dl><div><dt>Subtotal</dt><dd>{usd.format(totals.subtotal)}</dd></div><div><dt>IVA (15 %)</dt><dd>{usd.format(totals.tax)}</dd></div><div className="grand-total"><dt>Total a pagar</dt><dd>{usd.format(totals.total)}</dd></div></dl>
  </aside>
}
