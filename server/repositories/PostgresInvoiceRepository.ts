import { and, desc, eq, inArray } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import type { Sql } from 'postgres'
import { invoiceItems, invoices } from '../../db/schema/invoices.ts'
import type { InvoicePersistenceInput, SavedInvoice } from '../../src/features/simulators/invoice/types/invoice.types.ts'

/** Values supplied only by the Auth-owned, server-side session adapter. */
export interface TrustedInvoiceContext {
  institutionId: string
  userId: string
}

type Database = ReturnType<typeof drizzle>

export class PostgresInvoiceRepository {
  private readonly db: Database
  private readonly context: TrustedInvoiceContext

  constructor(db: Database, context: TrustedInvoiceContext) {
    this.db = db
    this.context = context
  }

  async list(): Promise<SavedInvoice[]> {
    const records = await this.db.select().from(invoices).where(and(
      eq(invoices.institutionId, this.context.institutionId),
      eq(invoices.ownerUserId, this.context.userId),
    )).orderBy(desc(invoices.createdAt))
    if (records.length === 0) return []

    const items = await this.db.select().from(invoiceItems).where(inArray(invoiceItems.invoiceId, records.map(record => record.id)))
    return records.map(record => ({
      id: record.id,
      customer: record.customerName,
      identification: record.customerIdentification,
      date: record.issuedOn,
      paymentMethod: record.paymentMethod,
      createdAt: record.createdAt.toISOString(),
      totals: { subtotal: record.subtotal, tax: record.tax, total: record.total },
      lines: items.filter(item => item.invoiceId === record.id).sort((left, right) => left.position - right.position).map(item => ({
        id: item.id,
        productId: item.productId ?? undefined,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    }))
  }

  async save(input: InvoicePersistenceInput): Promise<SavedInvoice> {
    const [created] = await this.db.insert(invoices).values({
      institutionId: this.context.institutionId,
      ownerUserId: this.context.userId,
      customerName: input.customer,
      customerIdentification: input.identification,
      issuedOn: input.date,
      paymentMethod: input.paymentMethod,
      subtotal: input.totals.subtotal,
      tax: input.totals.tax,
      total: input.totals.total,
    }).returning()
    await this.replaceItems(created.id, input)
    return (await this.list()).find(record => record.id === created.id)!
  }

  async update(id: string, input: InvoicePersistenceInput): Promise<SavedInvoice> {
    const [updated] = await this.db.update(invoices).set({
      customerName: input.customer,
      customerIdentification: input.identification,
      issuedOn: input.date,
      paymentMethod: input.paymentMethod,
      subtotal: input.totals.subtotal,
      tax: input.totals.tax,
      total: input.totals.total,
      updatedAt: new Date(),
    }).where(and(
      eq(invoices.id, id),
      eq(invoices.institutionId, this.context.institutionId),
      eq(invoices.ownerUserId, this.context.userId),
    )).returning()
    if (!updated) throw new Error('Factura no encontrada para la institución y usuario actuales.')
    await this.db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, id))
    await this.replaceItems(id, input)
    return (await this.list()).find(record => record.id === id)!
  }

  async remove(id: string): Promise<void> {
    const deleted = await this.db.delete(invoices).where(and(
      eq(invoices.id, id),
      eq(invoices.institutionId, this.context.institutionId),
      eq(invoices.ownerUserId, this.context.userId),
    )).returning({ id: invoices.id })
    if (deleted.length === 0) throw new Error('Factura no encontrada para la institución y usuario actuales.')
  }

  private async replaceItems(invoiceId: string, input: InvoicePersistenceInput): Promise<void> {
    if (input.lines.length === 0) return
    await this.db.insert(invoiceItems).values(input.lines.map((line, position) => ({
      invoiceId,
      productId: line.productId ?? null,
      position: position + 1,
      description: line.description,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      lineTotal: line.quantity * line.unitPrice,
    })))
  }
}

export function createPostgresInvoiceRepository(sql: Sql, context: TrustedInvoiceContext): PostgresInvoiceRepository {
  return new PostgresInvoiceRepository(drizzle(sql), context)
}
