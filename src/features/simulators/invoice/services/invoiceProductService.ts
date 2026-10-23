import { AppError } from '../../../../core/errors/AppError'
import { supabaseClient } from '../../../../core/supabase/supabaseClient'
import type { InvoiceProduct } from '../types/invoice.types'

export interface InvoiceCatalogRepository {
  list(): Promise<InvoiceProduct[]>
}

interface InvoiceProductRow {
  id: string
  description: string
  unit_price: number
  source_name: string
  source_url: string
  image_url: string | null
  stock: number
  is_active: boolean
}

export class SupabaseInvoiceCatalogRepository implements InvoiceCatalogRepository {
  async list(): Promise<InvoiceProduct[]> {
    const rows = await supabaseClient.request<InvoiceProductRow[]>(
      'invoice_products?select=id,description,unit_price,source_name,source_url,image_url,stock,is_active&is_public=eq.true&is_active=eq.true&institution_id=is.null&order=id.asc',
    )
    return rows.map(product => ({
      id: product.id,
      description: product.description,
      unitPrice: Number(product.unit_price),
      sourceName: product.source_name,
      sourceUrl: product.source_url,
      imageUrl: product.image_url ?? undefined,
      stock: product.stock,
      isAvailable: product.is_active && product.stock > 0,
    }))
  }
}

const catalogRepository = new SupabaseInvoiceCatalogRepository()

export async function getInvoiceProductCatalog(
  repository: InvoiceCatalogRepository = catalogRepository,
): Promise<{ products: InvoiceProduct[]; source: 'supabase' }> {
  const products = await repository.list()
  if (products.length === 0) throw new AppError('No hay productos disponibles en el catálogo de Supabase.')
  return { products, source: 'supabase' }
}
