import type { AccessTokenProvider } from '../../../../core/auth/authorization'
import { AppError } from '../../../../core/errors/AppError'
import { supabaseClient } from '../../../../core/supabase/supabaseClient'
import type { InvoiceProduct } from '../types/invoice.types'

interface DatabaseInvoiceProduct {
  id: string
  description: string
  unit_price: number | string
  source_name: string
  source_url: string
  stock: number | string
  image_url?: string | null
}

export interface InvoiceProductCatalog {
  products: InvoiceProduct[]
  source: 'supabase'
}

export interface InvoiceCatalogRepository {
  list(): Promise<InvoiceProduct[]>
}

export class SupabaseInvoiceCatalogRepository implements InvoiceCatalogRepository {
  constructor(private readonly accessTokenProvider?: AccessTokenProvider) {}

  async list(): Promise<InvoiceProduct[]> {
    const accessToken = await this.accessTokenProvider?.getAccessToken() ?? undefined
    const rows = await supabaseClient.request<DatabaseInvoiceProduct[]>(
      'invoice_products?select=id,description,unit_price,source_name,source_url,stock,image_url&is_active=eq.true&is_public=eq.true&order=description.asc',
      accessToken ? { accessToken } : {},
    )
    return rows.map(row => ({
      id: row.id,
      description: row.description,
      unitPrice: Number(row.unit_price),
      stock: Math.max(0, Number(row.stock) || 0),
      isAvailable: Number(row.stock) > 0,
      sourceName: row.source_name,
      sourceUrl: row.source_url,
      imageUrl: row.image_url ?? undefined,
    })).filter(product => product.id && product.description && Number.isFinite(product.unitPrice) && product.unitPrice > 0)
  }
}

const publicCatalogRepository = new SupabaseInvoiceCatalogRepository()

export async function getInvoiceProductCatalog(
  repository: InvoiceCatalogRepository = publicCatalogRepository,
): Promise<InvoiceProductCatalog> {
  const products = await repository.list()
  if (products.length === 0) throw new AppError('No hay productos activos para esta institución.')
  return { products, source: 'supabase' }
}
