import { AppError } from '../../../../core/errors/AppError'
import { supabaseClient } from '../../../../core/supabase/supabaseClient'
import type { InvoicePersistenceInput, SavedInvoice } from '../types/invoice.types'

export interface InvoiceRepository {
  save(input: InvoicePersistenceInput): Promise<SavedInvoice>
  list(): Promise<SavedInvoice[]>
  update(id: string, input: InvoicePersistenceInput): Promise<SavedInvoice>
  remove(id: string): Promise<void>
}

const SESSION_KEY = 'simulaedu.invoice-session.v1'

function getSessionCapability(): string {
  try {
    const current = window.sessionStorage.getItem(SESSION_KEY)
    if (current) return current
    const capability = crypto.randomUUID()
    window.sessionStorage.setItem(SESSION_KEY, capability)
    return capability
  } catch {
    throw new AppError('No se pudo iniciar una sesión segura para las facturas.')
  }
}

function requestOptions(method = 'GET', body?: unknown): RequestInit & { headers: HeadersInit } {
  return {
    method,
    headers: {
      'x-invoice-session': getSessionCapability(),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  }
}

interface InvoiceRow {
  id: string
  customer_name: string
  customer_identification: string
  issued_on: string
  payment_method: string
  subtotal: number
  tax: number
  total: number
  created_at: string
  invoice_items: Array<{
    id: string
    product_id: string | null
    description: string
    quantity: number
    unit_price: number
  }>
}

function toSavedInvoice(row: InvoiceRow): SavedInvoice {
  return {
    id: row.id,
    customer: row.customer_name,
    identification: row.customer_identification,
    date: row.issued_on,
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
    totals: { subtotal: Number(row.subtotal), tax: Number(row.tax), total: Number(row.total) },
    lines: (row.invoice_items ?? []).map(item => ({
      id: item.id,
      productId: item.product_id ?? undefined,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
    })),
  }
}

/** Persists demo invoices through Supabase's session-capability RLS contract. */
export class SupabaseInvoiceRepository implements InvoiceRepository {
  async list(): Promise<SavedInvoice[]> {
    const rows = await supabaseClient.request<InvoiceRow[]>(
      'invoices?select=id,customer_name,customer_identification,issued_on,payment_method,subtotal,tax,total,created_at,invoice_items(id,product_id,description,quantity,unit_price)&order=created_at.desc',
      requestOptions(),
    )
    return rows.map(toSavedInvoice)
  }

  async save(input: InvoicePersistenceInput): Promise<SavedInvoice> {
    return this.persist(null, input)
  }

  async update(id: string, input: InvoicePersistenceInput): Promise<SavedInvoice> {
    return this.persist(id, input)
  }

  async remove(id: string): Promise<void> {
    await supabaseClient.request<unknown>(
      `invoices?id=eq.${encodeURIComponent(id)}`,
      requestOptions('DELETE', undefined),
    )
  }

  private async persist(id: string | null, input: InvoicePersistenceInput): Promise<SavedInvoice> {
    const savedId = await supabaseClient.request<string>('rpc/save_simulated_invoice', requestOptions('POST', {
      p_invoice_id: id,
      p_payload: input,
    }))
    const record = (await this.list()).find(invoice => invoice.id === savedId)
    if (!record) throw new AppError('La factura se guardó, pero no se pudo volver a cargar desde Supabase.')
    return record
  }
}

export const invoiceRepository = new SupabaseInvoiceRepository()
