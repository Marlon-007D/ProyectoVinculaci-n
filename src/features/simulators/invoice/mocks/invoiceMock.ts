import type { InvoiceDraft, InvoiceLine, InvoiceProduct, SavedInvoice } from '../types/invoice.types'

export const invoiceTaxRate = 0.15

export const sampleInvoiceProducts: InvoiceProduct[] = [
  { id: 'notebook', description: 'Cuaderno universitario 1 línea, 100 hojas', unitPrice: 1.2, stock: 24, isAvailable: true, sourceName: 'Donald Papelería', sourceUrl: 'https://donald.ec/products/escribe-cuaderno-universitario-1-linea-100h', imageUrl: '/products/notebook.jpg' },
  { id: 'marker', description: 'Marcador permanente punta biselada', unitPrice: 0.63, stock: 18, isAvailable: true, sourceName: 'Materiales de Arte PRECISE', sourceUrl: 'https://arteprecise.com/tienda/categoria-producto/marcadores/', imageUrl: '/products/marker.jpg' },
  { id: 'bond-paper', description: 'Resma papel bond blanco A4, 75 g', unitPrice: 4.65, stock: 12, isAvailable: true, sourceName: 'Super Paco en Rappi', sourceUrl: 'https://www.rappi.com.ec/p/resma-de-papel-bond-blanco-075grs-a-142702', imageUrl: '/products/bond-paper.jpg' },
  { id: 'loose-sheets', description: 'Paquete de hojas A4, 50 hojas', unitPrice: 0.59, stock: 30, isAvailable: true, sourceName: 'Donald Papelería', sourceUrl: 'https://donald.ec/collections/escribe', imageUrl: '/products/loose-sheets.jpg' },
  { id: 'folder-pack', description: 'Folder de cartulina manila, paquete x5', unitPrice: 1.29, stock: 16, isAvailable: true, sourceName: 'Papelería local', sourceUrl: 'https://donald.ec/collections/escribe', imageUrl: '/products/folder-pack.jpg' },
  { id: 'colored-pencils', description: 'Lápices de colores, caja x12', unitPrice: 1.85, stock: 9, isAvailable: true, sourceName: 'Papelería local', sourceUrl: 'https://donald.ec/collections/escribe', imageUrl: '/products/colored-pencils.jpg' },
]

export const sampleInvoiceQuantities = Array.from({ length: 10 }, (_, index) => index + 1)

export const sampleInvoiceDraft: InvoiceDraft = {
  customer: 'Alejandra Rodriguez Pallo',
  identification: '2300510241',
  date: '2026-10-03',
  paymentMethod: 'Efectivo',
  lines: [
    { id: 'line-notebook', productId: 'notebook', description: 'Cuaderno universitario 1 línea, 100 hojas', quantity: 2, unitPrice: 1.2 },
    { id: 'line-marker', productId: 'marker', description: 'Marcador permanente punta biselada', quantity: 1, unitPrice: 0.63 },
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
