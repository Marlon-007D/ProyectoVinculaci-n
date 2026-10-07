import { AppError } from '../../../../core/errors/AppError'
import type { SavedInvoice } from '../types/invoice.types'
import { sampleSavedInvoices } from '../mocks/invoiceMock'

const storageKey = 'simulaedu.saved-invoices.v1'

function isSavedInvoice(value: unknown): value is SavedInvoice {
  if (typeof value !== 'object' || value === null) return false
  const invoice = value as Partial<SavedInvoice>
  return typeof invoice.id === 'string'
    && typeof invoice.customer === 'string'
    && typeof invoice.identification === 'string'
    && typeof invoice.date === 'string'
    && typeof invoice.paymentMethod === 'string'
    && typeof invoice.createdAt === 'string'
    && Array.isArray(invoice.lines)
    && typeof invoice.totals?.total === 'number'
}

export function getSavedInvoices(): SavedInvoice[] {
  try {
    const value = localStorage.getItem(storageKey)
    if (!value) return sampleSavedInvoices.map(invoice => ({ ...invoice, lines: invoice.lines.map(line => ({ ...line })), totals: { ...invoice.totals } }))
    const records: unknown = JSON.parse(value)
    return Array.isArray(records) ? records.filter(isSavedInvoice) : []
  } catch {
    return []
  }
}

export function saveInvoice(record: SavedInvoice): SavedInvoice[] {
  const invoices = [record, ...getSavedInvoices()]
  try {
    localStorage.setItem(storageKey, JSON.stringify(invoices))
    return invoices
  } catch (error) {
    throw new AppError('No se pudo guardar la factura en este navegador.', { cause: error })
  }
}

export function deleteInvoice(id: string): SavedInvoice[] {
  const invoices = getSavedInvoices().filter(invoice => invoice.id !== id)
  try {
    localStorage.setItem(storageKey, JSON.stringify(invoices))
    return invoices
  } catch (error) {
    throw new AppError('No se pudo eliminar la factura guardada.', { cause: error })
  }
}
