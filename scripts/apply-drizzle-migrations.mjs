import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required to apply migrations.')

const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10, prepare: false })
try {
  await migrate(drizzle(sql), { migrationsFolder: 'drizzle' })
  console.log('Drizzle migrations applied.')
} finally {
  await sql.end({ timeout: 5 })
}
