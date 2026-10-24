import 'dotenv/config';
import { loadEnv } from 'vite';
import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

// Read-only: no application records are read and no migrations are applied.
const env = { ...loadEnv('production', process.cwd(), ''), ...process.env };
const base = env.VITE_SUPABASE_URL;
const key = env.VITE_SUPABASE_ANON_KEY;
if (!base || !key) throw new Error('Configura las dos variables públicas de Supabase.');
let incomplete = false;
async function probe(path) {
  try {
    const response = await fetch(new URL(path, base), {
      headers: { apikey: key }, signal: AbortSignal.timeout(15000),
    });
    return response;
  } catch {
    throw new Error('No se pudo conectar con Supabase; revisa red, URL y disponibilidad del proyecto.');
  }
}
try {
  const response = await probe('/auth/v1/settings');
  if (!response.ok) throw new Error(`Auth settings: HTTP ${response.status}`);
  const settings = await response.json();
  console.log(`Auth accesible; Google habilitado: ${settings.external?.google === true}`);
  if (settings.external?.google !== true) { incomplete = true; console.log('PENDIENTE: habilitar Google en Supabase Auth.'); }
  // HEAD validates table availability and anonymous visibility without downloading records.
  const table = await fetch(new URL('/rest/v1/admin_membership_requests?select=request_id&limit=0', base), {
    method: 'HEAD', headers: { apikey: key }, signal: AbortSignal.timeout(15000),
  });
  console.log(`Solicitudes, acceso anónimo: HTTP ${table.status}`);
  if (![401, 403].includes(table.status)) {
    incomplete = true;
    console.log('PENDIENTE: comprobar permisos de solicitudes; se esperaba denegación anónima.');
  }
  if (!env.DATABASE_URL) {
    incomplete = true;
    console.log('PENDIENTE: sin DATABASE_URL no se certifican migraciones, políticas RLS ni funciones SQL instaladas.');
  } else {
    const sql = postgres(env.DATABASE_URL, { max: 1, connect_timeout: 10, prepare: false });
    try {
      await sql.begin('read only', async tx => {
        const tables = await tx`select c.relname, c.relrowsecurity, c.relforcerowsecurity
          from pg_class c join pg_namespace n on n.oid=c.relnamespace
          where n.nspname='public' and c.relname in ('memberships','profiles','admin_membership_requests')`;
        console.log('RLS:', JSON.stringify(tables));
        if (tables.length !== 3 || tables.some(t => !t.relrowsecurity)
          || !tables.find(t => t.relname === 'admin_membership_requests')?.relforcerowsecurity) incomplete = true;
        const policies = await tx`select tablename, policyname, roles, cmd, qual, with_check from pg_policies
          where schemaname='public' and tablename in ('memberships','profiles','admin_membership_requests')`;
        console.log('Políticas (revisar aislamiento por institución):', JSON.stringify(policies));
        const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'));
        const applied = await tx`select hash from drizzle.__drizzle_migrations`;
        const hashes = new Set(applied.map(row => row.hash));
        for (const entry of journal.entries) {
          const contents = await readFile(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), 'utf8');
          const found = hashes.has(createHash('sha256').update(contents).digest('hex'));
          console.log(`${entry.tag}: ${found ? 'registrada' : 'PENDIENTE / hash diferente'}`);
          if (!found) incomplete = true;
        }
      });
    } finally { await sql.end({ timeout: 5 }); }
  }
  console.log('Site URL y Redirect URLs requieren revisión en Dashboard; esta API pública no los expone.');
  if (incomplete) process.exitCode = 2;
} catch (error) {
  // Do not print connection strings, credentials or raw driver errors.
  console.error(error?.message?.startsWith('Auth settings:') ? error.message : 'Verificación incompleta: fallo de conexión o consulta.');
  process.exitCode = 1;
}
