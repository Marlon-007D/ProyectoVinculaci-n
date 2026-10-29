export interface TenantInvitationEnvironment {
  supabaseUrl: string; publicKey: string; serviceRoleKey: string; allowedOrigins: string[];
}
interface InvitationInput {
  institutionId: string; roleId: string; email: string; firstName: string; lastName: string; phone: string; modules: string[];
}
function parseInput(value: unknown): InvitationInput {
  if (!value || typeof value !== 'object') throw new Error('Datos incompletos.');
  const input = value as Record<string, unknown>;
  for (const name of ['institutionId', 'roleId', 'email', 'firstName', 'lastName', 'phone']) {
    if (typeof input[name] !== 'string' || !input[name].trim()) throw new Error('Datos incompletos.');
  }
  if (!Array.isArray(input.modules) || !input.modules.every(item => typeof item === 'string')) throw new Error('Módulos inválidos.');
  const result = input as unknown as InvitationInput;
  if (!/^09\d{8}$/.test(result.phone)) throw new Error('Celular inválido.');
  return result;
}

/** Server-only handler. Deploy as admin-tenant-invite; never import it into the browser. */
export async function handleTenantInvitation(request: Request, env: TenantInvitationEnvironment, fetcher: typeof fetch = fetch): Promise<Response> {
  const origin = request.headers.get('origin');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Vary': 'Origin' };
  if (origin && env.allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const respond = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !env.allowedOrigins.includes(origin)) return respond({ error: 'Origen no autorizado.' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  if (request.method !== 'POST') return respond({ error: 'Método no permitido.' }, 405);
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Inicia sesión.' }, 401);
  let createdProfile: string | null = null;
  let assigned = false;
  const callerHeaders = { apikey: env.publicKey, Authorization: authorization, 'Content-Type': 'application/json' };
  const privilegedHeaders = { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}`, 'Content-Type': 'application/json' };
  try {
    if (!env.supabaseUrl || !env.publicKey || !env.serviceRoleKey) throw new Error('Configuración incompleta.');
    const input = parseInput(await request.json());
    const identity = await fetcher(`${env.supabaseUrl}/auth/v1/user`, { headers: callerHeaders });
    if (!identity.ok) return respond({ error: 'Sesión inválida.' }, 401);
    const capabilities = await fetcher(`${env.supabaseUrl}/rest/v1/rpc/admin_tenant_capabilities`, {
      method: 'POST', headers: callerHeaders, body: JSON.stringify({ target_institution_id: input.institutionId, target_role_id: input.roleId }),
    });
    const allowed: unknown = capabilities.ok ? await capabilities.json() : false;
    if (allowed !== true) return respond({ error: 'No puedes crear esa cuenta en esta institución.' }, 403);
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const password = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const creation = await fetcher(`${env.supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST', headers: privilegedHeaders,
      body: JSON.stringify({ email: input.email.trim().toLowerCase(), password, email_confirm: false,
        user_metadata: { first_name: input.firstName, last_name: input.lastName } }),
    });
    const account: unknown = await creation.json();
    if (!creation.ok || !account || typeof account !== 'object' || !('id' in account) || typeof account.id !== 'string') {
      return respond({ error: 'No se pudo crear una cuenta nueva. Si ya existe, utiliza la asignación de roles.' }, 409);
    }
    createdProfile = account.id;
    const assignment = await fetcher(`${env.supabaseUrl}/rest/v1/rpc/admin_tenant_assign_role`, {
      method: 'POST', headers: callerHeaders, body: JSON.stringify({ target_institution_id: input.institutionId,
        target_role_id: input.roleId, target_email: input.email, target_first_name: input.firstName,
        target_last_name: input.lastName, target_phone: input.phone, target_modules: input.modules }),
    });
    if (!assignment.ok) throw new Error('La asignación institucional fue rechazada.');
    assigned = true;
    // Notification failure must never revoke a successfully assigned membership.
    let notificationSent = false;
    try {
      const redirect = origin ? `?redirect_to=${encodeURIComponent(origin)}` : '';
      const recovery = await fetcher(`${env.supabaseUrl}/auth/v1/recover${redirect}`, {
        method: 'POST', headers: { apikey: env.publicKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: input.email }),
      });
      notificationSent = recovery.ok;
    } catch { notificationSent = false; }
    return respond({ assigned: true, notificationSent });
  } catch {
    let cleanupFailed = false;
    if (createdProfile && !assigned) {
      try {
        const cleanup = await fetcher(`${env.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(createdProfile)}`, { method: 'DELETE', headers: privilegedHeaders });
        cleanupFailed = !cleanup.ok;
      } catch { cleanupFailed = true; }
    }
    return respond({ error: 'No se pudo completar la creación institucional.', cleanupFailed }, 500);
  }
}
