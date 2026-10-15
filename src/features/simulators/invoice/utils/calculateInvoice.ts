import type { InvoiceLine, InvoiceTotals } from '../types/invoice.types'

export function calculateInvoice(lines: InvoiceLine[], taxRate = 0.15): InvoiceTotals {
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0)
  const tax = subtotal * taxRate
  return { subtotal, tax, total: subtotal + tax }
}
