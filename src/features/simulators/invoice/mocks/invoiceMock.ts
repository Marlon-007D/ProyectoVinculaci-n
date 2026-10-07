import type { InvoiceDraft, InvoiceLine, SavedInvoice } from '../types/invoice.types'

export const invoiceTaxRate = 0.15

export const sampleInvoiceDraft: InvoiceDraft = {
  customer: 'Alejandra Rodriguez Pallo',
  identification: '2300510241',
  date: '2026-10-03',
  paymentMethod: 'Efectivo',
  lines: [
    { id: 'notebook', description: 'Cuaderno universitario A4', quantity: 2, unitPrice: 3.5 },
    { id: 'marker', description: 'Marcador permanente', quantity: 1, unitPrice: 1.25 },
  ],
}

export function copySampleInvoice(): InvoiceDraft {
  return { ...sampleInvoiceDraft, lines: sampleInvoiceDraft.lines.map((line: InvoiceLine) => ({ ...line })) }
}

export const sampleSavedInvoices: SavedInvoice[] = [
  { id: 'mock-invoice-1', customer: 'Alejandra Rodriguez Pallo', identification: '2300510241', date: '2026-10-03', paymentMethod: 'Efectivo', createdAt: '2026-10-03T15:00:00.000Z', lines: [{ id: 'mock-line-1', description: 'Cuadernos universitarios', quantity: 2, unitPrice: 3.5 }], totals: { subtotal: 7, tax: 1.05, total: 8.05 } },
  { id: 'mock-invoice-2', customer: 'José Luis Cedeño', identification: '0923456789', date: '2026-10-02', paymentMethod: 'Transferencia', createdAt: '2026-10-02T14:00:00.000Z', lines: [{ id: 'mock-line-2', description: 'Impresiones y anillado', quantity: 1, unitPrice: 12 }], totals: { subtotal: 12, tax: 1.8, total: 13.8 } },
  { id: 'mock-invoice-3', customer: 'Andrea Vera Mena', identification: '0934567890', date: '2026-10-01', paymentMethod: 'Tarjeta', createdAt: '2026-10-01T16:30:00.000Z', lines: [{ id: 'mock-line-3', description: 'Material de oficina', quantity: 3, unitPrice: 4.25 }], totals: { subtotal: 12.75, tax: 1.91, total: 14.66 } },
  { id: 'mock-invoice-4', customer: 'Carlos Andrés Mora', identification: '0945678901', date: '2026-09-30', paymentMethod: 'Efectivo', createdAt: '2026-09-30T13:15:00.000Z', lines: [{ id: 'mock-line-4', description: 'Servicio de diseño', quantity: 1, unitPrice: 25 }], totals: { subtotal: 25, tax: 3.75, total: 28.75 } },
  { id: 'mock-invoice-5', customer: 'Daniela Paredes Solís', identification: '0956789012', date: '2026-09-29', paymentMethod: 'Transferencia', createdAt: '2026-09-29T11:45:00.000Z', lines: [{ id: 'mock-line-5', description: 'Carpeta y separadores', quantity: 2, unitPrice: 2.75 }], totals: { subtotal: 5.5, tax: 0.83, total: 6.33 } },
  { id: 'mock-invoice-6', customer: 'Miguel Ángel Ruiz', identification: '0967890123', date: '2026-09-28', paymentMethod: 'Tarjeta', createdAt: '2026-09-28T10:20:00.000Z', lines: [{ id: 'mock-line-6', description: 'Asesoría académica', quantity: 1, unitPrice: 18 }], totals: { subtotal: 18, tax: 2.7, total: 20.7 } },
]
