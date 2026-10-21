import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(byte => byte.toString(16).padStart(2, '0')).join('');
Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return respond({ error: 'Método no permitido.' }, 405);
  try {
    const body = await request.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const firstName = String(body.firstName ?? '').trim();
    const lastName = String(body.lastName ?? '').trim();
    const institutionId = String(body.institutionId ?? '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || password.length < 12 || password.length > 128 || !firstName || !lastName || firstName.length > 100 || lastName.length > 100 || !/^[0-9a-f-]{36}$/i.test(institutionId)) return respond({ error: 'Revisa los datos de la solicitud.' }, 400);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const salt = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const { data: allowed, error: limitError } = await admin.rpc('consume_registration_attempt', { ip_hash: await digest(`${salt}:${ip}`), email_hash: await digest(`${salt}:${email}`) });
    if (limitError) return respond({ error: limitError.message }, 500);
    if (!allowed) return respond({ error: 'No se pudo procesar la solicitud. Inténtalo más tarde.' }, 429);
    const { data: institution, error: institutionError } = await admin.from('institutions').select('institution_id').eq('institution_id', institutionId).eq('is_active', true).maybeSingle();
    if (institutionError) return respond({ error: institutionError.message }, 500);
    if (!institution) return respond({ error: 'La unidad educativa no está disponible.' }, 400);
    // Admin createUser does not send confirmation or invitation emails.
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: false,
      user_metadata: { first_name: firstName, last_name: lastName, institution_id: institutionId, role: 'invitado' } });
    if (error || !data.user) return respond({ error: error?.message ?? 'No se pudo crear la cuenta institucional.' }, 400);
    const { data: membership, error: membershipError } = await admin.from('memberships').select('is_active, roles!fk_memberships_role(name)').eq('profile_id', data.user.id).eq('institution_id', institutionId).maybeSingle();
    if (membershipError || !membership || membership.is_active || !['invitado', 'guest', 'pending', 'viewer'].includes((membership.roles as any)?.name)) {
      await admin.auth.admin.deleteUser(data.user.id);
      return respond({ error: membershipError?.message ?? 'No se pudo guardar la solicitud institucional.' }, 500);
    }
    return respond({ registered: true });
  } catch (error) { return respond({ error: error instanceof Error ? error.message : 'No se pudo completar la solicitud.' }, 500); }
});
