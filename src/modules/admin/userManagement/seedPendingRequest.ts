/** Ejecutar solo con Node. No importar desde componentes ni desde el bundle web. */
import process from 'node:process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnv } from 'vite';
import { createClient } from '@supabase/supabase-js';

const projectRoot = fileURLToPath(new URL('../../../../', import.meta.url));
const env = { ...loadEnv('development', projectRoot, ''), ...process.env };
const fixture = {
  institutionId: 'f96873d4-9deb-4b8d-9677-348861cbd277',
  slug: 'ue-el-esfuerzo',
  email: 'invitado.prueba@test.com',
  firstName: 'Usuario',
  lastName: 'Prueba',
  phone: '0991234567',
};

async function seed() {
  if (process.env.NODE_ENV === 'production') throw new Error('Este seed se ejecuta únicamente en desarrollo.');
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Configura SUPABASE_SERVICE_ROLE_KEY y SUPABASE_URL (o VITE_SUPABASE_URL) en el entorno privado del proceso. La clave pública no permite crear cuentas de prueba.');
  }
  const client = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const { data: institution, error: institutionError } = await client.from('institutions')
    .select('institution_id').eq('institution_id', fixture.institutionId).eq('slug', fixture.slug).eq('is_active', true).maybeSingle();
  if (institutionError) throw new Error('No se pudo verificar la institución: ' + institutionError.message);
  if (!institution) throw new Error('El Esfuerzo no existe o su ID, slug o estado activo no coinciden.');

  // Buscar antes de crear para no duplicar ni restablecer una cuenta existente.
  let profileId: string | undefined;
  for (let page = 1; ; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw new Error('No se pudieron consultar las cuentas: ' + error.message);
    const account = data.users.find(user => user.email?.toLowerCase() === fixture.email);
    if (account) {
      if (!account.email_confirmed_at) throw new Error('La cuenta de prueba ya existe sin confirmar. El seed no modifica su autenticación.');
      profileId = account.id;
      break;
    }
    if (data.users.length < 100) break;
  }
  if (!profileId) {
    const { data, error } = await client.auth.admin.createUser({
      email: fixture.email,
      email_confirm: true,
      password: randomBytes(32).toString('base64url'),
      user_metadata: { first_name: fixture.firstName, last_name: fixture.lastName },
    });
    if (error) throw new Error('No se pudo crear la cuenta de prueba: ' + error.message);
    profileId = data.user.id;
  }
  const { data: memberships, error: membershipError } = await client.from('memberships').select('profile_id').eq('profile_id', profileId).limit(1);
  if (membershipError) throw new Error('No se pudieron comprobar las membresías: ' + membershipError.message);
  if (memberships?.length) throw new Error('La cuenta de prueba ya tiene una membresía. No se modifica ni se restablece a pendiente.');

  const { data: existing, error: existingError } = await client.from('admin_membership_requests')
    .select('request_id, status').eq('institution_id', fixture.institutionId).eq('profile_id', profileId).maybeSingle();
  if (existingError) throw new Error('No se pudo consultar la solicitud. Comprueba la migración 0009: ' + existingError.message);
  if (existing && existing.status !== 'pending') throw new Error('La solicitud ya fue revisada. No se reinicia.');
  if (!existing) {
    // La restricción UNIQUE protege también frente a dos ejecuciones simultáneas.
    const { error } = await client.from('admin_membership_requests').upsert({
      institution_id: fixture.institutionId, profile_id: profileId,
      first_name: fixture.firstName, last_name: fixture.lastName, phone: fixture.phone, status: 'pending',
    }, { onConflict: 'institution_id,profile_id', ignoreDuplicates: true });
    if (error) throw new Error('No se pudo insertar la solicitud: ' + error.message);
  }
  const { data: saved, error: savedError } = await client.from('admin_membership_requests')
    .select('request_id, status, institution_id').eq('institution_id', fixture.institutionId).eq('profile_id', profileId).single();
  if (savedError || saved.status !== 'pending') throw new Error('La verificación no encontró la solicitud en estado pendiente.');
  process.stdout.write(JSON.stringify({ ...saved, email: fixture.email }, null, 2) + '\n');
  process.stdout.write('Abre http://localhost:5173/panel/admin?institution=' + fixture.institutionId + '&slug=' + fixture.slug + ' y selecciona Usuarios Registrados.\n');
}

void seed().catch((error: unknown) => {
  process.stderr.write((error instanceof Error ? error.message : 'No se pudo completar el seed.') + '\n');
  process.exitCode = 1;
});
