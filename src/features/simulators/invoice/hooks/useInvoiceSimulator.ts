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
    ?? products.find(product => key.includes('lápices de colores') && product.id === 'colored-pencils')
}

export function useInvoiceSimulator() {
  const [draft, setDraft] = useState<InvoiceDraft>(copySampleInvoice)
  const [savedInvoices, setSavedInvoices] = useState<SavedInvoice[]>(getSavedInvoices)
  const [products, setProducts] = useState<InvoiceProduct[]>(sampleInvoiceProducts)
  const [historyNotice, setHistoryNotice] = useState('')
  const totals = useMemo(() => calculateInvoice(draft.lines, invoiceTaxRate), [draft.lines])

  useEffect(() => {
    let mounted = true
    getInvoiceProductCatalog().then(catalog => {
      if (!mounted) return
      setProducts(catalog.products)
      setDraft(current => ({ ...current, lines: current.lines.map(line => {
        const product = findCatalogProduct(line, catalog.products)
        return product ? { ...line, description: product.description, unitPrice: product.unitPrice } : line
      }) }))
    }).catch(() => {
      if (!mounted) return
      setProducts(sampleInvoiceProducts.map(product => ({ ...product })))
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
      const line = current.lines.find(candidate => candidate.id === id)
      const stock = products.find(candidate => candidate.id === line?.productId)?.stock ?? 0
      const numericValue = Math.min(stock, Math.max(0, Number(value) || 0))
      return { ...current, lines: current.lines.map(line => line.id === id ? { ...line, quantity: numericValue } : line) }
    })
  }
  const addLine = (productId?: string) => setDraft(current => {
    const usedProducts = new Set(current.lines.map(line => line.productId).filter(Boolean))
    const product = products.find(candidate => candidate.id === productId && !usedProducts.has(candidate.id))
      ?? (productId ? undefined : products.find(candidate => !usedProducts.has(candidate.id)))
    if (!product || !product.isAvailable || product.stock < 1) return current
    return { ...current, lines: [...current.lines, { id: crypto.randomUUID(), productId: product.id, description: product.description, quantity: 1, unitPrice: product.unitPrice }] }
  })
  const setProductQuantity = (productId: string, value: number) => setDraft(current => {
    const product = products.find(candidate => candidate.id === productId)
    if (!product || !product.isAvailable) return current
    const quantity = Math.min(product.stock, Math.max(0, Math.floor(Number(value) || 0)))
    const line = current.lines.find(candidate => candidate.productId === productId)
    if (quantity === 0) return line ? { ...current, lines: current.lines.filter(candidate => candidate.id !== line.id) } : current
    if (line) return { ...current, lines: current.lines.map(candidate => candidate.id === line.id ? { ...candidate, quantity } : candidate) }
    return { ...current, lines: [...current.lines, { id: crypto.randomUUID(), productId: product.id, description: product.description, quantity, unitPrice: product.unitPrice }] }
  })
  const removeLine = (id: string) => setDraft(current => ({ ...current, lines: current.lines.filter(line => line.id !== id) }))
  const persist = () => {
    if (!draft.customer.trim()) return false
    const record: SavedInvoice = {
      ...draft,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      lines: draft.lines.map((line: InvoiceLine) => ({ ...line })),
      totals,
    }
    try {
      setSavedInvoices(saveInvoice(record))
      setHistoryNotice('')
      return true
    } catch (error) {
      setHistoryNotice(error instanceof Error ? error.message : 'No se pudo guardar la factura.')
      return false
    }
  }
  const load = (record: SavedInvoice) => {
    setDraft({ customer: record.customer, identification: record.identification, date: record.date, paymentMethod: record.paymentMethod, lines: record.lines.map(line => {
      const product = findCatalogProduct(line, products)
      return product
        ? { ...line, productId: product.id, description: product.description, unitPrice: product.unitPrice }
        : { ...line, productId: '', description: '', unitPrice: 0 }
    }) })
    setHistoryNotice('')
  }
  const removeSaved = (id: string) => {
    try {
      setSavedInvoices(deleteInvoice(id))
      setHistoryNotice('')
    } catch (error) {
      setHistoryNotice(error instanceof Error ? error.message : 'No se pudo eliminar la factura.')
    }
  }

  return { draft, totals, historyNotice, savedInvoices, products, updateField, updateLine, addLine, setProductQuantity, removeLine, persist, load, removeSaved }
}
