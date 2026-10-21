import { useEffect, useMemo, useState } from 'react'
import type { InvoiceDraft, InvoiceLine, InvoiceProduct, SavedInvoice } from '../types/invoice.types'
import { calculateInvoice } from '../utils/calculateInvoice'
import { copySampleInvoice, invoiceTaxRate, sampleInvoiceProducts } from '../mocks/invoiceMock'
import { getInvoiceProductCatalog } from '../services/invoiceProductService'
import { deleteInvoice, getSavedInvoices, saveInvoice } from '../services/invoiceStorageService'

function findCatalogProduct(line: InvoiceLine, products: InvoiceProduct[]) {
  const key = `${line.productId ?? ''} ${line.id} ${line.description}`.toLocaleLowerCase()
  return products.find(product => product.id === line.productId)
    ?? products.find(product => key.includes('notebook') && product.id === 'notebook')
    ?? products.find(product => key.includes('cuaderno') && product.id === 'notebook')
    ?? products.find(product => key.includes('marker') && product.id === 'marker')
    ?? products.find(product => key.includes('marcador') && product.id === 'marker')
    ?? products.find(product => (key.includes('bond') || key.includes('resma')) && product.id === 'bond-paper')
    ?? products.find(product => key.includes('hojas') && product.id === 'loose-sheets')
    ?? products.find(product => key.includes('folder') && product.id === 'folder-pack')
}

export function useInvoiceSimulator() {
  const [draft, setDraft] = useState<InvoiceDraft>(copySampleInvoice)
  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>(getSavedInvoices)
  const [products, setProducts] = useState<InvoiceProduct[]>(sampleInvoiceProducts)
  const [catalogNotice, setCatalogNotice] = useState('')
  const [notice, setNotice] = useState('')
  const [historyNotice, setHistoryNotice] = useState('')
  const totals = useMemo(() => calculateInvoice(draft.lines, invoiceTaxRate), [draft.lines])

  useEffect(() => {
    let mounted = true
    getInvoiceProductCatalog().then(catalog => {
      if (!mounted) return
      setProducts(catalog.products)
      setCatalogNotice(catalog.source === 'mock' ? 'Catálogo de demostración: conecta Supabase para cargar los precios desde la base de datos.' : '')
      setDraft(current => ({ ...current, lines: current.lines.map(line => {
        const product = findCatalogProduct(line, catalog.products)
        return product ? { ...line, description: product.description, unitPrice: product.unitPrice } : line
      }) }))
    }).catch(() => {
      if (!mounted) return
      setProducts(sampleInvoiceProducts.map(product => ({ ...product })))
      setCatalogNotice('No se pudo consultar Supabase; se usa el catálogo de demostración.')
    })
    return () => { mounted = false }
  }, [])

  const updateField = (field: keyof Omit<InvoiceDraft, 'lines'>, value: string) => {
    setDraft(current => ({ ...current, [field]: value }))
  }
  const updateLine = (id: string, field: 'productId' | 'quantity', value: string | number) => {
    setDraft(current => {
      if (field === 'productId') {
        const productId = String(value)
        if (current.lines.some(line => line.id !== id && line.productId === productId)) return current
        const product = products.find(candidate => candidate.id === productId)
        if (!product) return current
        return { ...current, lines: current.lines.map(line => line.id === id ? { ...line, productId, description: product.description, unitPrice: product.unitPrice } : line) }
      }
      const numericValue = Math.max(0, Number(value) || 0)
      return { ...current, lines: current.lines.map(line => line.id === id ? { ...line, quantity: numericValue } : line) }
    })
  }
  const addLine = () => setDraft(current => {
    const usedProducts = new Set(current.lines.map(line => line.productId).filter(Boolean))
    const product = products.find(candidate => !usedProducts.has(candidate.id))
    if (!product) return current
    return { ...current, lines: [...current.lines, { id: crypto.randomUUID(), productId: product.id, description: product.description, quantity: 1, unitPrice: product.unitPrice }] }
  })
  const removeLine = (id: string) => setDraft(current => ({ ...current, lines: current.lines.length > 1 ? current.lines.filter(line => line.id !== id) : current.lines }))
  const reset = () => {
    setDraft({
      customer: '',
      identification: '',
      date: '',
      paymentMethod: '',
      lines: [{ id: crypto.randomUUID(), productId: '', description: '', quantity: 1, unitPrice: 0 }],
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
    setDraft({ customer: record.customer, identification: record.identification, date: record.date, paymentMethod: record.paymentMethod, lines: record.lines.map(line => {
      const product = findCatalogProduct(line, products)
      return product
        ? { ...line, productId: product.id, description: product.description, unitPrice: product.unitPrice }
        : { ...line, productId: '', description: '', unitPrice: 0 }
    }) })
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

  return { draft, totals, notice, historyNotice, savedInvoices, products, catalogNotice, updateField, updateLine, addLine, removeLine, reset, persist, load, removeSaved }
}
