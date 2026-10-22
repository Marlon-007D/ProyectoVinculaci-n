import { sql } from 'drizzle-orm'
import { boolean, check, integer, numeric, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * Existing catalog table from the hand-written Supabase migrations.
 * institution_id is nullable only to represent the current unassigned legacy
 * rows; default-deny RLS makes those rows inaccessible until Auth assigns them.
 */
export const invoiceProducts = pgTable('invoice_products', {
  id: text('id').primaryKey(),
  description: text('description').notNull(),
  unitPrice: numeric('unit_price', { precision: 10, scale: 2, mode: 'number' }).notNull(),
  sourceName: text('source_name').notNull(),
  sourceUrl: text('source_url').notNull(),
  imageUrl: text('image_url'),
  isActive: boolean('is_active').notNull().default(true),
  isPublic: boolean('is_public').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  stock: integer('stock').notNull().default(0),
  institutionId: uuid('institution_id'),
}, table => [
  check('invoice_products_unit_price_check', sql`${table.unitPrice} > 0`),
  check('invoice_products_stock_check', sql`${table.stock} >= 0`),
]).enableRLS()
