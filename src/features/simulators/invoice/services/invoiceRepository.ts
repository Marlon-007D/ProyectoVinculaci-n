import { AppError } from '../../../../core/errors/AppError'
import { supabaseClient } from '../../../../core/supabase/supabaseClient'
import type { InvoicePersistenceInput, SavedInvoice } from '../types/invoice.types'

export interface InvoiceRepository {
  save(input: InvoicePersistenceInput): Promise<SavedInvoice>
  list(): Promise<SavedInvoice[]>
  update(id: string, input: InvoicePersistenceInput): Promise<SavedInvoice>
  remove(id: string): Promise<void>
}

export interface InvoiceSessionProvider {
  getSessionId(): string
}

/** Stores only a random session capability, never invoice data. */
export class BrowserInvoiceSessionProvider implements InvoiceSessionProvider {
  private static readonly key = 'simulaedu.invoice-session.v1'

  getSessionId(): string {
    const existing = sessionStorage.getItem(BrowserInvoiceSessionProvider.key)
    if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(existing)) return existing
    const sessionId = crypto.randomUUID()
    sessionStorage.setItem(BrowserInvoiceSessionProvider.key, sessionId)
    return sessionId
  }
}

interface DatabaseInvoiceRow {
  id: string
  customer_name: string
  customer_identification: string
  issued_on: string
  payment_method: string
  subtotal: number | string
  tax: number | string
  total: number | string
  created_at: string
  invoice_items: Array<{
    id: string
    product_id: string | null
    description: string
    quantity: number
    unit_price: number | string
  }>
}

function fromDatabase(row: DatabaseInvoiceRow): SavedInvoice {
  return {
    id: row.id,
    customer: row.customer_name,
    identification: row.customer_identification,
    date: row.issued_on,
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
    totals: { subtotal: Number(row.subtotal), tax: Number(row.tax), total: Number(row.total) },
    lines: row.invoice_items.map(item => ({
      id: item.id,
      productId: item.product_id ?? undefined,
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unit_price),
    })),
  }
}

/** Supabase persistence scoped by a random, per-tab session capability in RLS. */
export class SupabaseInvoiceRepository implements InvoiceRepository {
  constructor(private readonly sessionProvider: InvoiceSessionProvider) {}

  async save(input: InvoicePersistenceInput): Promise<SavedInvoice> {
    return this.saveOrUpdate(null, input)
  }

  async update(id: string, input: InvoicePersistenceInput): Promise<SavedInvoice> {
    return this.saveOrUpdate(id, input)
  }

  async list(): Promise<SavedInvoice[]> {
    const rows = await supabaseClient.request<DatabaseInvoiceRow[]>(
      'invoices?select=id,customer_name,customer_identification,issued_on,payment_method,subtotal,tax,total,created_at,invoice_items(id,product_id,description,quantity,unit_price)&order=created_at.desc',
      { headers: this.sessionHeaders() },
    )
    return rows.map(fromDatabase)
  }

  async remove(id: string): Promise<void> {
    const deleted = await supabaseClient.request<Array<{ id: string }>>(
      `invoices?id=eq.${encodeURIComponent(id)}&select=id`,
      { method: 'DELETE', headers: this.sessionHeaders({ Prefer: 'return=representation' }) },
    )
    if (deleted.length === 0) throw new AppError('No se encontró la factura de esta sesión.')
  }

  private async saveOrUpdate(id: string | null, input: InvoicePersistenceInput): Promise<SavedInvoice> {
    const idResult = await supabaseClient.request<string>('rpc/save_simulated_invoice', {
      method: 'POST',
      headers: this.sessionHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ p_invoice_id: id, p_payload: input }),
    })
    const saved = (await this.list()).find(invoice => invoice.id === idResult)
    if (!saved) throw new AppError('Supabase no devolvió la factura guardada.')
    return saved
  }

  private sessionHeaders(extra?: HeadersInit): Headers {
    const headers = new Headers(extra)
    headers.set('x-invoice-session', this.sessionProvider.getSessionId())
    return headers
  }
}

