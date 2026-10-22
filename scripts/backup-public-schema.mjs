import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import postgres from 'postgres'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) throw new Error('DATABASE_URL is required to create a backup manifest.')

const sql = postgres(databaseUrl, { max: 1, connect_timeout: 10, prepare: false })
const tables = await sql.unsafe(`
  select c.relname as name
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where c.relkind = 'r' and n.nspname = 'public'
  order by c.relname
`)
const policies = await sql.unsafe(`
  select tablename, policyname, cmd
  from pg_policies
  where schemaname = 'public'
  order by tablename, policyname
`)
const foreignKeys = await sql.unsafe(`
  select c.relname as table_name, con.conname, pg_get_constraintdef(con.oid) as definition
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where con.contype = 'f' and n.nspname = 'public'
  order by c.relname, con.conname
`)
await sql.end({ timeout: 5 })

const backup = {
  format: 'simulaedu-public-schema-manifest/v1',
  createdAt: new Date().toISOString(),
  tables,
  policies,
  foreignKeys,
}
const directory = join(process.cwd(), 'supabase', 'backups')
await mkdir(directory, { recursive: true })
const filename = join(directory, `public-schema-${backup.createdAt.replaceAll(':', '-').replaceAll('.', '-')}.json`)
await writeFile(filename, `${JSON.stringify(backup, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
console.log(`Created backup manifest: ${filename}`)
