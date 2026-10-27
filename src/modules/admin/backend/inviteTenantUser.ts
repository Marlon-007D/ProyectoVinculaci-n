import { handleTenantMemberDeletion } from './deleteTenantMember.ts';
import { canonicalSlug } from '../auth/canonicalSlug.ts';
import { completeInvitationPassword } from './completeInvitationPassword.ts';
import { requestInvitationEmail } from './requestInvitationEmail.ts';
import { notifyTenantAccess } from './notifyTenantAccess.ts';
import { validateAdminContact } from '../auth/contactValidation.ts';

class InvitationProcessingError extends Error {}

export interface TenantInvitationEnvironment {
  supabaseUrl: string; publicKey: string; serviceRoleKey: string; allowedOrigins: string[];
}
interface InvitationInput {
  institutionId: string; roleId: string; email: string; firstName: string; lastName: string; phone: string; modules: string[]; redirect_to: string;
}
function invitationAuthErrorCode(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  if ('error_code' in value && typeof value.error_code === 'string') return value.error_code;
  if ('code' in value && typeof value.code === 'string') return value.code;
  return null;
}
function parseInput(value: unknown): InvitationInput {
  if (!value || typeof value !== 'object') throw new Error('Datos incompletos.');
  const input = value as Record<string, unknown>;
  for (const name of ['institutionId', 'roleId', 'email', 'firstName', 'lastName', 'phone', 'redirect_to']) {
    if (typeof input[name] !== 'string' || !input[name].trim()) throw new Error('Datos incompletos.');
  }
  if (!Array.isArray(input.modules) || !input.modules.every(item => typeof item === 'string')) throw new Error('Módulos inválidos.');
  const result = input as unknown as InvitationInput;
  if (!/^09\d{8}$/.test(result.phone)) throw new Error('Celular inválido.');
  return validateAdminContact({ ...result, phone: result.phone.trim(), modules: [...new Set(result.modules)] });
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
  try {
    const payload: unknown = await request.clone().json();
    if (payload && typeof payload === 'object' && 'action' in payload) {
      if (payload.action === 'request_invitation_email') {
        if (!origin || !env.allowedOrigins.includes(origin)) return respond({ error: 'Origen no autorizado.' }, 403);
        const result = await requestInvitationEmail(request, env, origin, fetcher);
        return respond(result.body, result.status);
      }
      if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Inicia sesión.' }, 401);
      if (payload.action === 'notify_access') {
        const result = await notifyTenantAccess(request, env, fetcher);
        return respond(result.body, result.status);
      }
      if (payload.action === 'complete_invitation_password') {
        const result = await completeInvitationPassword(request, env, fetcher);
        return respond(result.body, result.status);
      }
      if (payload.action === 'capabilities') return respond({ invitationContract: 'pending-v1' });
      if (payload.action === 'delete' || payload.action === 'delete_member') return handleTenantMemberDeletion(request, env, fetcher);
      if (payload.action !== 'invite') return respond({ error: 'Acción administrativa no soportada.' }, 400);
    }
  } catch { return respond({ error: 'Datos de la solicitud no válidos.' }, 400); }
  if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Inicia sesión.' }, 401);
  let createdProfile: string | null = null;
  let assigned = false;
  const callerHeaders = { apikey: env.publicKey, Authorization: authorization, 'Content-Type': 'application/json' };
  const privilegedHeaders = { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}`, 'Content-Type': 'application/json' };
  try {
    if (!env.supabaseUrl || !env.publicKey || !env.serviceRoleKey) throw new Error('Configuración incompleta.');
    let input: InvitationInput;
    try { input = parseInput(await request.json()); }
    catch (cause: unknown) { return respond({ error: cause instanceof Error ? cause.message : 'Datos de invitación no válidos.' }, 400); }
    const identity = await fetcher(`${env.supabaseUrl}/auth/v1/user`, { headers: callerHeaders });
    if (!identity.ok) return respond({ error: 'Sesión inválida.' }, 401);
    const capabilities = await fetcher(`${env.supabaseUrl}/rest/v1/rpc/admin_tenant_capabilities`, {
      method: 'POST', headers: callerHeaders, body: JSON.stringify({ target_institution_id: input.institutionId, target_role_id: input.roleId }),
    });
    const allowed: unknown = capabilities.ok ? await capabilities.json() : false;
    if (allowed !== true) return respond({ error: 'No puedes crear esa cuenta en esta institución.' }, 403);
    const redirect = new URL(input.redirect_to);
    if (!env.allowedOrigins.includes(redirect.origin) || (origin && redirect.origin !== origin)
      || !['/login', '/panel/admin'].includes(redirect.pathname) || redirect.hash || redirect.username || redirect.password
      || redirect.searchParams.getAll('institution').length !== 1 || redirect.searchParams.getAll('slug').length !== 1
      || redirect.searchParams.get('institution') !== input.institutionId
      || [...redirect.searchParams.keys()].some(key => !['institution', 'slug'].includes(key))) {
      return respond({ error: 'La redirección institucional no es válida.' }, 400);
    }
    const institutionResponse = await fetcher(`${env.supabaseUrl}/rest/v1/institutions?institution_id=eq.${encodeURIComponent(input.institutionId)}&select=institution_id,slug,is_active`, { headers: callerHeaders });
    const institutions: unknown = institutionResponse.ok ? await institutionResponse.json() : null;
    if (!Array.isArray(institutions) || institutions.length !== 1 || institutions[0]?.institution_id !== input.institutionId
      || institutions[0]?.is_active !== true || typeof institutions[0]?.slug !== 'string'
      || !canonicalSlug(institutions[0].slug) || canonicalSlug(institutions[0].slug) !== canonicalSlug(redirect.searchParams.get('slug') ?? '')) {
      return respond({ error: 'El enlace no corresponde a la institución autorizada.' }, 400);
    }
    const rolesResponse = await fetcher(`${env.supabaseUrl}/rest/v1/roles?role_id=eq.${encodeURIComponent(input.roleId)}&select=role_id,name`, { headers: callerHeaders });
    const roles: unknown = rolesResponse.ok ? await rolesResponse.json() : null;
    if (!Array.isArray(roles) || roles.length !== 1 || roles[0]?.role_id !== input.roleId || typeof roles[0]?.name !== 'string') {
      return respond({ error: 'No se pudo verificar el rol asignado.' }, 400);
    }
    const invitationMetadata = { first_name: input.firstName.trim(), last_name: input.lastName.trim(), phone: input.phone,
      email: input.email.trim().toLowerCase(), institution_id: input.institutionId, slug: institutions[0].slug,
      role_id: input.roleId, role: roles[0].name, admin_tenant_onboarding: true };
    redirect.searchParams.set('slug', canonicalSlug(institutions[0].slug));
    async function findRecipient(): Promise<{ profile_id: string; confirmed: boolean } | null> {
      const lookup = await fetcher(`${env.supabaseUrl}/rest/v1/rpc/admin_tenant_invitation_recipient`, {
        method: 'POST', headers: callerHeaders, body: JSON.stringify({ target_institution_id: input.institutionId, target_email: input.email, target_role_id: input.roleId }),
      });
      if (!lookup.ok) throw new InvitationProcessingError('No se pudo verificar la cuenta existente. Revisa los permisos y el script 007.');
      const recipient: unknown = await lookup.json();
      if (recipient === null) return null;
      if (!recipient || typeof recipient !== 'object' || !('profile_id' in recipient) || typeof recipient.profile_id !== 'string'
        || !('confirmed' in recipient) || typeof recipient.confirmed !== 'boolean') throw new InvitationProcessingError('La respuesta de la cuenta existente no es válida.');
      return { profile_id: recipient.profile_id, confirmed: recipient.confirmed };
    }
    const existingRecipient = await findRecipient();
    let existingConfirmed = existingRecipient?.confirmed ?? false;
    if (!existingRecipient) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const password = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      const creation = await fetcher(`${env.supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST', headers: privilegedHeaders,
        body: JSON.stringify({ email: input.email.trim().toLowerCase(), password, email_confirm: false,
          user_metadata: invitationMetadata, app_metadata: { admin_tenant_invitation: invitationMetadata } }),
      });
      const account: unknown = await creation.json();
      if (creation.ok && account && typeof account === 'object' && 'id' in account && typeof account.id === 'string') {
        createdProfile = account.id;
      } else {
        const code = invitationAuthErrorCode(account);
        const duplicateMessage = account && typeof account === 'object' && 'msg' in account && typeof account.msg === 'string' ? account.msg
          : account && typeof account === 'object' && 'message' in account && typeof account.message === 'string' ? account.message : '';
        if ((!code || !['email_exists', 'user_already_exists', 'email_already_exists'].includes(code))
          && !/already.*(?:registered|exists)|email.*already/i.test(duplicateMessage)) {
          return respond({ error: 'No se pudo crear la cuenta pendiente. Revisa el correo y la configuración de Auth.' }, 409);
        }
        const recipient = await findRecipient();
        if (!recipient) throw new InvitationProcessingError('La cuenta existente no pudo verificarse tras el conflicto de creación.');
        existingConfirmed = recipient.confirmed;
      }
    }
    const assignment = await fetcher(`${env.supabaseUrl}/rest/v1/rpc/admin_tenant_prepare_invitation`, {
      method: 'POST', headers: callerHeaders, body: JSON.stringify({ target_institution_id: input.institutionId,
        target_role_id: input.roleId, target_email: input.email, target_first_name: input.firstName,
        target_last_name: input.lastName, target_phone: input.phone, target_modules: input.modules }),
    });
    if (!assignment.ok) {
      const failure: unknown = await assignment.json().catch(() => null);
      const reason = failure && typeof failure === 'object' && 'message' in failure && typeof failure.message === 'string' ? failure.message
        : failure && typeof failure === 'object' && 'error' in failure && typeof failure.error === 'string' ? failure.error : 'Revisa los permisos y el contrato de invitaciones 007.';
      throw new InvitationProcessingError(`No se pudo preparar la membresía institucional: ${reason}`);
    }
    assigned = true;
    // Notification failure must never revoke a successfully assigned membership.
    let notificationSent = false;
    try {
      const endpoint = existingConfirmed ? 'otp' : 'invite';
      const invitation = await fetcher(`${env.supabaseUrl}/auth/v1/${endpoint}?redirect_to=${encodeURIComponent(redirect.href)}`, {
        method: 'POST', headers: privilegedHeaders, signal: AbortSignal.timeout(15000),
        body: JSON.stringify(existingConfirmed ? { email: input.email.trim().toLowerCase(), create_user: false }
          : { email: input.email.trim().toLowerCase(), data: invitationMetadata }),
      });
      notificationSent = invitation.ok;
    } catch { notificationSent = false; }
    return respond({ assigned: true, pending: true, notificationSent });
  } catch (cause: unknown) {
    let cleanupFailed = false;
    if (createdProfile && !assigned) {
      try {
        const cleanup = await fetcher(`${env.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(createdProfile)}`, { method: 'DELETE', headers: privilegedHeaders });
        cleanupFailed = !cleanup.ok;
      } catch { cleanupFailed = true; }
    }
    return respond({ error: cause instanceof InvitationProcessingError ? cause.message : 'No se pudo completar la creación institucional. Revisa la conexión y el contrato de invitaciones del servidor.', cleanupFailed }, 500);
  }
}

