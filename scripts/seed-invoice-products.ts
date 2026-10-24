import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { invoiceProducts } from '../db/schema/invoiceProducts.ts'

interface ProductSeed {
  id: string
  description: string
  unitPrice: number
  stock: number
  sourceName: string
  sourceUrl: string
  imageUrl: string
}

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required to seed the invoice catalog.')

const raw = await readFile(new URL('../db/seeds/data/invoice-products.json', import.meta.url), 'utf8')
const products = JSON.parse(raw) as ProductSeed[]
const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10, prepare: false })
const db = drizzle(sql)

try {
  for (const product of products) {
    await db.insert(invoiceProducts).values({
      id: product.id,
      description: product.description,
      unitPrice: product.unitPrice,
      stock: product.stock,
      sourceName: product.sourceName,
      sourceUrl: product.sourceUrl,
      imageUrl: product.imageUrl,
      isActive: true,
      isPublic: true,
    }).onConflictDoNothing({ target: invoiceProducts.id })
  }
  console.log(`Ensured ${products.length} invoice catalog products without overwriting existing records.`)
} finally {
  await sql.end({ timeout: 5 })
}
