export interface InvoiceLine {
  id: string
  productId?: string
  description: string
  quantity: number
  unitPrice: number
  stock: number
  isAvailable: boolean
}

export interface InvoiceProduct {
  id: string
  description: string
  unitPrice: number
  sourceName: string
  sourceUrl: string
  imageUrl?: string
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
