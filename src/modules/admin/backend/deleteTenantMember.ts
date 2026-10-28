import { canDeleteTenantMember } from '../auth/accessPolicy.ts';

export interface DeleteMemberEnvironment {
  supabaseUrl: string; publicKey: string; serviceRoleKey: string; allowedOrigins: string[];
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }

/** Server-only delete action dispatched by admin-tenant-invite. Never bundle secrets in Vite. */
export async function handleTenantMemberDeletion(request: Request, env: DeleteMemberEnvironment, fetcher: typeof fetch = fetch): Promise<Response> {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Vary: 'Origin' };
  if (origin && env.allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const respond = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !env.allowedOrigins.includes(origin)) return respond({ error: 'Origen no autorizado.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  if (request.method !== 'POST') return respond({ error: 'Método no permitido.' }, 405);
  const token = request.headers.get('authorization');
  if (!token?.startsWith('Bearer ')) return respond({ error: 'Inicia sesión.' }, 401);
  try {
    if (!env.supabaseUrl || !env.publicKey || !env.serviceRoleKey) throw new Error('Configuración incompleta.');
    const input: unknown = await request.json();
    if (!record(input) || typeof input.institution_id !== 'string' || !input.institution_id
      || typeof input.profile_id !== 'string' || !input.profile_id) return respond({ error: 'Selecciona institución y miembro.' }, 400);
    const callerHeaders = { apikey: env.publicKey, Authorization: token, 'Content-Type': 'application/json' };
    const identityResponse = await fetcher(`${env.supabaseUrl}/auth/v1/user`, { headers: callerHeaders });
    const identity: unknown = identityResponse.ok ? await identityResponse.json() : null;
    if (!record(identity) || typeof identity.id !== 'string') return respond({ error: 'Sesión inválida.' }, 401);
    const snapshotResponse = await fetcher(`${env.supabaseUrl}/rest/v1/rpc/admin_tenant_snapshot`, {
      method: 'POST', headers: callerHeaders, body: JSON.stringify({ target_institution_id: input.institution_id }),
    });
    const snapshot: unknown = snapshotResponse.ok ? await snapshotResponse.json() : null;
    if (!record(snapshot) || snapshot.institution_id !== input.institution_id || typeof snapshot.actor_role !== 'string'
      || !Array.isArray(snapshot.members)) return respond({ error: 'No tienes permisos en esta institución.' }, 403);
    const member: unknown = snapshot.members.find((item: unknown) => record(item) && item.profile_id === input.profile_id && item.institution_id === input.institution_id);
    if (!record(member) || typeof member.role_name !== 'string' || !canDeleteTenantMember(
      { profileId: identity.id, institutionId: input.institution_id, role: snapshot.actor_role },
      { profileId: input.profile_id, institutionId: input.institution_id, role: member.role_name },
    )) return respond({ error: 'No puedes eliminar tu propia cuenta ni al Super Admin.' }, 403);
    // Privileged headers are used only after validation with the caller's JWT.
    const params = new URLSearchParams({ institution_id: `eq.${input.institution_id}`, profile_id: `eq.${input.profile_id}`, select: 'institution_id,profile_id' });
    const deletion = await fetcher(`${env.supabaseUrl}/rest/v1/memberships?${params}`, {
      method: 'DELETE', headers: { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}`, Prefer: 'return=representation' },
    });
    const removed: unknown = deletion.ok ? await deletion.json() : null;
    if (!Array.isArray(removed) || removed.length !== 1 || !record(removed[0])
      || removed[0].institution_id !== input.institution_id || removed[0].profile_id !== input.profile_id) {
      return respond({ error: 'No se confirmó el borrado. La membresía pudo cambiar o estar referenciada por otros registros.' }, 409);
    }
    return respond({ deleted: true, institution_id: input.institution_id, profile_id: input.profile_id });
  } catch {
    return respond({ error: 'No se pudo completar la eliminación institucional.' }, 500);
  }
}
