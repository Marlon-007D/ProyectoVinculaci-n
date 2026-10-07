import { Landmark } from 'lucide-react'
import type { InvoiceTotals } from '../types/invoice.types'
import './InvoiceResult.css'

const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' })

export function InvoiceResult({ totals }: { totals: InvoiceTotals }) {
  return <aside className="summary-card">
    <div className="summary-icon"><Landmark size={22} /></div><p className="step-label">RESUMEN</p><h2>Total de la factura</h2>
    <dl><div><dt>Subtotal</dt><dd>{usd.format(totals.subtotal)}</dd></div><div><dt>IVA (15 %)</dt><dd>{usd.format(totals.tax)}</dd></div><div className="grand-total"><dt>Total a pagar</dt><dd>{usd.format(totals.total)}</dd></div></dl>
  </aside>
}
