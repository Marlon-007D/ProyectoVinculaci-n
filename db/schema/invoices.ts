import { sql } from 'drizzle-orm'
import { check, date, index, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { invoiceProducts } from './invoiceProducts.ts'

export const invoices = pgTable('invoices', {
  id: uuid('id').defaultRandom().primaryKey(),
  // Auth-owned tenant/user IDs remain nullable until their canonical tables
  // are confirmed. Unauthenticated simulator sessions use a separate RLS key.
  institutionId: uuid('institution_id'),
  ownerUserId: uuid('owner_user_id'),
  sessionId: uuid('session_id'),
  customerName: text('customer_name').notNull(),
  customerIdentification: text('customer_identification').notNull(),
  issuedOn: date('issued_on', { mode: 'string' }).notNull(),
  paymentMethod: text('payment_method').notNull(),
  subtotal: numeric('subtotal', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  tax: numeric('tax', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  total: numeric('total', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
}, table => [
  index('invoices_institution_created_at_idx').on(table.institutionId, table.createdAt),
  index('invoices_owner_created_at_idx').on(table.ownerUserId, table.createdAt),
  index('invoices_session_created_at_idx').on(table.sessionId, table.createdAt),
  check('invoices_owner_context_check', sql`(
    ${table.institutionId} is not null and ${table.ownerUserId} is not null and ${table.sessionId} is null
  ) or (
    ${table.institutionId} is null and ${table.ownerUserId} is null and ${table.sessionId} is not null
  )`),
  check('invoices_totals_nonnegative_check', sql`${table.subtotal} >= 0 and ${table.tax} >= 0 and ${table.total} >= 0`),
  check('invoices_total_matches_components_check', sql`${table.total} = ${table.subtotal} + ${table.tax}`),
]).enableRLS()

export const invoiceItems = pgTable('invoice_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  productId: text('product_id').references(() => invoiceProducts.id, { onDelete: 'restrict' }),
  position: integer('position').notNull(),
  description: text('description').notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: numeric('unit_price', { precision: 12, scale: 2, mode: 'number' }).notNull(),
  lineTotal: numeric('line_total', { precision: 12, scale: 2, mode: 'number' }).notNull(),
}, table => [
  index('invoice_items_invoice_id_idx').on(table.invoiceId),
  index('invoice_items_product_id_idx').on(table.productId),
  check('invoice_items_position_positive_check', sql`${table.position} > 0`),
  check('invoice_items_quantity_positive_check', sql`${table.quantity} > 0`),
  check('invoice_items_unit_price_positive_check', sql`${table.unitPrice} > 0`),
  check('invoice_items_line_total_positive_check', sql`${table.lineTotal} > 0`),
]).enableRLS()
