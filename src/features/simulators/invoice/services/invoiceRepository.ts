import { AppError } from '../../../../core/errors/AppError'
import type { InvoicePersistenceInput, SavedInvoice } from '../types/invoice.types'

export interface InvoiceRepository {
  save(input: InvoicePersistenceInput): Promise<SavedInvoice>
  list(): Promise<SavedInvoice[]>
  update(id: string, input: InvoicePersistenceInput): Promise<SavedInvoice>
  remove(id: string): Promise<void>
}

const STORAGE_KEY = 'simulaedu.invoice-history.v1'

/** Browser-only adapter for the invoice simulator; it does not call Supabase. */
export class LocalInvoiceRepository implements InvoiceRepository {
  async save(input: InvoicePersistenceInput): Promise<SavedInvoice> {
    const record: SavedInvoice = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lines: input.lines.map(line => ({ ...line })),
      totals: { ...input.totals },
    }
    this.write([record, ...this.read()])
    return record
  }

  async list(): Promise<SavedInvoice[]> {
    return this.read()
  }

  async update(id: string, input: InvoicePersistenceInput): Promise<SavedInvoice> {
    const invoices = this.read()
    const existing = invoices.find(invoice => invoice.id === id)
    if (!existing) throw new AppError('No se encontró la factura guardada en este navegador.')
    const updated: SavedInvoice = {
      ...input,
      id,
      createdAt: existing.createdAt,
      lines: input.lines.map(line => ({ ...line })),
      totals: { ...input.totals },
    }
    this.write(invoices.map(invoice => invoice.id === id ? updated : invoice))
    return updated
  }

  async remove(id: string): Promise<void> {
    const invoices = this.read()
    const remaining = invoices.filter(invoice => invoice.id !== id)
    if (remaining.length === invoices.length) throw new AppError('No se encontró la factura guardada en este navegador.')
    this.write(remaining)
  }

  private read(): SavedInvoice[] {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) throw new Error('El historial guardado no tiene un formato válido.')
      return parsed as SavedInvoice[]
    } catch (error) {
      if (error instanceof AppError) throw error
      throw new AppError('No se pudo leer el historial local de facturas.')
    }
  }

  private write(invoices: SavedInvoice[]): void {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(invoices))
    } catch {
      throw new AppError('No se pudo guardar el historial local. Revisa el espacio disponible en el navegador.')
    }
  }
}
