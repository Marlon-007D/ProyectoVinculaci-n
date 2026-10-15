import { AppError } from '../../../../core/errors/AppError'
import { supabaseClient } from '../../../../core/supabase/supabaseClient'
import { sampleInvoiceProducts } from '../mocks/invoiceMock'
import type { InvoiceProduct } from '../types/invoice.types'

interface DatabaseInvoiceProduct {
  id: string
  description: string
  unit_price: number | string
  source_name: string
  source_url: string
}

export interface InvoiceProductCatalog {
  products: InvoiceProduct[]
  source: 'database' | 'mock'
}

export async function getInvoiceProductCatalog(): Promise<InvoiceProductCatalog> {
  if (!supabaseClient.isConfigured) return { products: sampleInvoiceProducts.map(product => ({ ...product })), source: 'mock' }

  const rows = await supabaseClient.request<DatabaseInvoiceProduct[]>(
    'invoice_products?select=id,description,unit_price,source_name,source_url&is_active=eq.true&order=description.asc',
  )
  const products = rows.map(row => ({
    id: row.id,
    description: row.description,
    unitPrice: Number(row.unit_price),
    sourceName: row.source_name,
    sourceUrl: row.source_url,
  })).filter(product => product.id && product.description && Number.isFinite(product.unitPrice) && product.unitPrice > 0)

  if (products.length === 0) throw new AppError('La base de datos no tiene productos activos con precios válidos.')
  return { products, source: 'database' }
}
