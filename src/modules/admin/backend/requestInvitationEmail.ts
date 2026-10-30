import { canonicalSlug } from '../auth/canonicalSlug.ts';
import { hasEmailShape } from '../auth/contactValidation.ts';

interface EmailEnvironment { supabaseUrl: string; serviceRoleKey: string }
const requests = new Map<string, number>();
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** Public recovery action: sends only to the stored pending recipient, never creates access. */
export async function requestInvitationEmail(request: Request, env: EmailEnvironment, origin: string,
  fetcher: typeof fetch = fetch): Promise<{ status: number; body: Record<string, unknown> }> {
  const accepted = () => ({ status: 200, body: { accepted: true, retryAfter: 60 } });
  try {
    const input: unknown = await request.json();
    if (!isRecord(input) || typeof input.email !== 'string' || !hasEmailShape(input.email)
      || typeof input.institutionId !== 'string' || !input.institutionId || input.email.length > 254) {
      return { status: 400, body: { error: 'Ingresa un correo válido y selecciona la institución.' } };
    }
    const email = input.email.trim().toLowerCase();
    const now = Date.now();
    for (const [key, expiry] of requests) if (expiry <= now) requests.delete(key);
    const expiry = requests.get(email) ?? 0;
    if (expiry > now || requests.size >= 1000) return { status: 429, body: { retryAfter: Math.max(1, Math.ceil((expiry - now) / 1000)), error: 'Por seguridad, espera unos segundos antes de solicitar un nuevo envío.' } };
    requests.set(email, now + 60000);
    const headers = { apikey: env.serviceRoleKey, Authorization: `Bearer ${env.serviceRoleKey}`, 'Content-Type': 'application/json' };
    if (!env.serviceRoleKey) throw new Error('Missing server configuration');
    const profilesQuery = new URLSearchParams({ email: `eq.${email}`, select: 'profile_id', limit: '1' });
    const profileResponse = await fetcher(`${env.supabaseUrl}/rest/v1/profiles?${profilesQuery}`, { headers });
    if (!profileResponse.ok) throw new Error('Profile lookup failed');
    const profiles: unknown = await profileResponse.json();
    if (!Array.isArray(profiles) || !isRecord(profiles[0]) || typeof profiles[0].profile_id !== 'string') return accepted();
    const profileId = profiles[0].profile_id;
    const query = new URLSearchParams({ institution_id: `eq.${input.institutionId}`, profile_id: `eq.${profileId}`, accepted_at: 'is.null', select: 'profile_id', limit: '1' });
    const pendingResponse = await fetcher(`${env.supabaseUrl}/rest/v1/admin_tenant_invitations?${query}`, { headers });
    if (!pendingResponse.ok) throw new Error('Invitation lookup failed');
    const pending: unknown = await pendingResponse.json();
    if (!Array.isArray(pending) || !pending.length) return accepted();
    const institutionQuery = new URLSearchParams({ institution_id: `eq.${input.institutionId}`, is_active: 'eq.true', select: 'slug', limit: '1' });
    const institutionResponse = await fetcher(`${env.supabaseUrl}/rest/v1/institutions?${institutionQuery}`, { headers });
    if (!institutionResponse.ok) throw new Error('Institution lookup failed');
    const institutions: unknown = await institutionResponse.json();
    if (!Array.isArray(institutions) || !isRecord(institutions[0]) || typeof institutions[0].slug !== 'string') return accepted();
    if (typeof input.slug === 'string' && canonicalSlug(input.slug) !== canonicalSlug(institutions[0].slug)) return accepted();
    const accountResponse = await fetcher(`${env.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(profileId)}`, { headers });
    if (!accountResponse.ok) throw new Error('Identity lookup failed');
    const account: unknown = await accountResponse.json();
    if (!isRecord(account) || account.email !== email) return accepted();
    const redirect = new URL('/panel/admin', origin);
    redirect.search = new URLSearchParams({ institution: input.institutionId, slug: canonicalSlug(institutions[0].slug) }).toString();
    const endpoint = account.email_confirmed_at ? 'otp' : 'invite';
    const sent = await fetcher(`${env.supabaseUrl}/auth/v1/${endpoint}?redirect_to=${encodeURIComponent(redirect.href)}`, {
      method: 'POST', headers, signal: AbortSignal.timeout(15000), body: JSON.stringify({ email, ...(endpoint === 'otp' ? { create_user: false } : {}) }),
    });
    if (sent.status === 429) return { status: 429, body: { retryAfter: 60, error: 'Por seguridad, espera unos segundos antes de solicitar un nuevo envío.' } };
    if (!sent.ok) throw new Error('Email delivery failed');
    return accepted();
  } catch {
    return { status: 503, body: { error: 'No se pudo solicitar el correo. Inténtalo más tarde.', retryAfter: 60 } };
  }
}
