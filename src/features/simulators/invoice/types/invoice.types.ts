export interface InvoiceLine {
  id: string
  description: string
  quantity: number
  unitPrice: number
}

export interface InvoiceTotals {
  subtotal: number
  tax: number
  total: number
}

export interface InvoiceDraft {
  customer: string
  identification: string
  date: string
  paymentMethod: string
  lines: InvoiceLine[]
}

export interface SavedInvoice extends InvoiceDraft {
  id: string
  createdAt: string
  totals: InvoiceTotals
}
