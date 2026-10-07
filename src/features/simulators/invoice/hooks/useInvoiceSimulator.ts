import { useMemo, useState } from 'react'
import type { InvoiceDraft, InvoiceLine, SavedInvoice } from '../types/invoice.types'
import { calculateInvoice } from '../utils/calculateInvoice'
import { copySampleInvoice, invoiceTaxRate } from '../mocks/invoiceMock'
import { deleteInvoice, getSavedInvoices, saveInvoice } from '../services/invoiceStorageService'

export function useInvoiceSimulator() {
  const [draft, setDraft] = useState<InvoiceDraft>(copySampleInvoice)
  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>(getSavedInvoices)
  const [notice, setNotice] = useState('')
  const [historyNotice, setHistoryNotice] = useState('')
  const totals = useMemo(() => calculateInvoice(draft.lines, invoiceTaxRate), [draft.lines])

  const updateField = (field: keyof Omit<InvoiceDraft, 'lines'>, value: string) => {
    setDraft(current => ({ ...current, [field]: value }))
  }
  const updateLine = (id: string, field: 'description' | 'quantity' | 'unitPrice', value: string | number) => {
    setDraft(current => ({ ...current, lines: current.lines.map(line => {
      if (line.id !== id) return line
      if (field === 'description') return { ...line, description: String(value) }
      const numericValue = Math.max(0, Number(value) || 0)
      return field === 'quantity' ? { ...line, quantity: numericValue } : { ...line, unitPrice: numericValue }
    }) }))
  }
  const addLine = () => setDraft(current => ({ ...current, lines: [...current.lines, { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 }] }))
  const removeLine = (id: string) => setDraft(current => ({ ...current, lines: current.lines.length > 1 ? current.lines.filter(line => line.id !== id) : current.lines }))
  const reset = () => {
    setDraft({
      customer: '',
      identification: '',
      date: '',
      paymentMethod: '',
      lines: [{ id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 }],
    })
    setNotice('')
  }

  const persist = () => {
    if (!draft.customer.trim()) {
      setNotice('Escribe el nombre del cliente antes de guardar.')
      return
    }
    const record: SavedInvoice = {
      ...draft,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lines: draft.lines.map((line: InvoiceLine) => ({ ...line })),
      totals,
    }
    try {
      setSavedInvoices(saveInvoice(record))
      setNotice('Factura guardada en este navegador.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo guardar la factura.')
    }
  }
  const load = (record: SavedInvoice) => {
    setDraft({ customer: record.customer, identification: record.identification, date: record.date, paymentMethod: record.paymentMethod, lines: record.lines.map(line => ({ ...line })) })
    setNotice('')
  }
  const removeSaved = (id: string) => {
    try {
      setSavedInvoices(deleteInvoice(id))
      setNotice('')
      setHistoryNotice('Factura eliminada del historial.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'No se pudo eliminar la factura.')
    }
  }

  return { draft, totals, notice, historyNotice, savedInvoices, updateField, updateLine, addLine, removeLine, reset, persist, load, removeSaved }
}
