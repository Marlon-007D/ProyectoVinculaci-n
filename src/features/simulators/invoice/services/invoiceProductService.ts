import { AppError } from '../../../../core/errors/AppError'
import { sampleInvoiceProducts } from '../mocks/invoiceMock'
import type { InvoiceProduct } from '../types/invoice.types'

export interface InvoiceProductCatalog {
  products: InvoiceProduct[]
  source: 'local'
}

export interface InvoiceCatalogRepository {
  list(): Promise<InvoiceProduct[]>
}

/** Uses the checked-in seed catalog for the standalone educational simulator. */
export class LocalInvoiceCatalogRepository implements InvoiceCatalogRepository {
  async list(): Promise<InvoiceProduct[]> {
    return sampleInvoiceProducts.map(product => ({ ...product }))
  }
}

const localCatalogRepository = new LocalInvoiceCatalogRepository()

export async function getInvoiceProductCatalog(
  repository: InvoiceCatalogRepository = localCatalogRepository,
): Promise<InvoiceProductCatalog> {
  const products = await repository.list()
  if (products.length === 0) throw new AppError('No hay productos disponibles para la simulación.')
  return { products, source: 'local' }
}
