import { canManageTenantMember } from '../auth/accessPolicy.ts';
import { normalizeContactName } from '../auth/contactValidation.ts';
import { canonicalSlug } from '../auth/canonicalSlug.ts';

interface NotificationEnvironment { supabaseUrl: string; publicKey: string; serviceRoleKey: string; allowedOrigins: string[] }
const notificationRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

export async function notifyTenantAccess(request: Request, env: NotificationEnvironment, fetcher: typeof fetch = fetch) {
  const failure = (error: string, status = 403) => ({ status, body: { error, notificationSent: false } });
  try {
    const input: unknown = await request.json();
    if (!notificationRecord(input) || typeof input.institutionId !== 'string' || typeof input.profileId !== 'string'
      || typeof input.redirect_to !== 'string') return failure('Selecciona una cuenta institucional válida.', 400);
    const authorization = request.headers.get('authorization') ?? '';
    const caller = { apikey: env.publicKey, Authorization: authorization, 'Content-Type': 'application/json' };
    const identityResponse = await fetcher(`${env.supabaseUrl}/auth/v1/user`, { headers: caller });
    const identity: unknown = identityResponse.ok ? await identityResponse.json() : null;
    if (!notificationRecord(identity) || typeof identity.id !== 'string') return failure('Sesión inválida.', 401);
    const snapshotResponse = await fetcher(`${env.supabaseUrl}/rest/v1/rpc/admin_tenant_snapshot_v3`, {
      method: 'POST', headers: caller, body: JSON.stringify({ target_institution_id: input.institutionId }),
    });
    const snapshot: unknown = snapshotResponse.ok ? await snapshotResponse.json() : null;
    if (!notificationRecord(snapshot) || snapshot.institution_id !== input.institutionId || typeof snapshot.actor_role !== 'string' || !Array.isArray(snapshot.members)) return failure('No tienes permisos en esta institución.');
    const member: unknown = snapshot.members.find((row: unknown) => notificationRecord(row) && row.profile_id === input.profileId && row.institution_id === input.institutionId);
    const pending = input.pending === true;
    if (!notificationRecord(member) || (pending ? member.is_active !== false || member.invitation_pending !== true : member.is_active !== true) || typeof member.role_name !== 'string' || typeof member.email !== 'string'
      || !canManageTenantMember({ profileId: identity.id, institutionId: input.institutionId, role: snapshot.actor_role },
        { profileId: input.profileId, institutionId: input.institutionId, role: member.role_name })) return failure('No puedes notificar a esta cuenta.');
    const redirect = new URL(input.redirect_to);
    if (!env.allowedOrigins.includes(redirect.origin) || redirect.origin !== request.headers.get('origin')
      || redirect.pathname !== '/panel/admin' || redirect.hash || redirect.username || redirect.password
      || redirect.searchParams.getAll('institution').length !== 1 || redirect.searchParams.get('institution') !== input.institutionId
      || redirect.searchParams.getAll('slug').length !== 1 || [...redirect.searchParams.keys()].some(key => !['institution', 'slug'].includes(key))) return failure('La redirección institucional no es válida.', 400);
    const institutionQuery = new URLSearchParams({ institution_id: `eq.${input.institutionId}`, select: 'slug,is_active' });
    const institutionResponse = await fetcher(`${env.supabaseUrl}/rest/v1/institutions?${institutionQuery}`, { headers: caller });
    const institutions: unknown = institutionResponse.ok ? await institutionResponse.json() : null;
    if (!Array.isArray(institutions) || !notificationRecord(institutions[0]) || institutions[0].is_active !== true || typeof institutions[0].slug !== 'string'
      || canonicalSlug(institutions[0].slug) !== canonicalSlug(redirect.searchParams.get('slug') ?? '')) return failure('El enlace no corresponde al plantel.', 400);
    redirect.searchParams.set('slug', canonicalSlug(institutions[0].slug));
    const privileged = { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}`, 'Content-Type': 'application/json' };
    const accountResponse = await fetcher(`${env.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(input.profileId)}`, { headers: privileged });
    const account: unknown = accountResponse.ok ? await accountResponse.json() : null;
    if (!notificationRecord(account) || account.email !== member.email) return failure('No se pudo verificar el destinatario.', 409);
    const endpoint = account.email_confirmed_at ? 'otp' : 'invite';
    const email = await fetcher(`${env.supabaseUrl}/auth/v1/${endpoint}?redirect_to=${encodeURIComponent(redirect.href)}`, {
      method: 'POST', headers: privileged, signal: AbortSignal.timeout(15000),
      body: JSON.stringify(endpoint === 'otp' ? { email: member.email, create_user: false }
        : { email: member.email, data: { first_name: normalizeContactName(typeof member.first_name === 'string' ? member.first_name : '') || member.email.split('@')[0].slice(0, 100) || 'Invitado', last_name: normalizeContactName(typeof member.last_name === 'string' ? member.last_name : '') || 'Invitado', phone: member.phone, role: member.role_name, institution_id: input.institutionId, slug: institutions[0].slug } }),
    });
    return { status: 200, body: { notificationSent: email.ok, rateLimited: email.status === 429 } };
  } catch { return failure('No se pudo enviar el correo. El acceso guardado no se modificó.', 503); }
}
