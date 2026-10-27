import { currentAdminScope } from './institutionNavigation.ts';

export const expiredInvitationMessage = 'El enlace de invitación ha expirado o ya fue utilizado. Solicita un nuevo acceso.';
type LinkType = 'invite' | 'recovery' | 'magiclink';
export type InvitationLink = { kind: 'none' } | { kind: 'error'; message: string }
  | { kind: 'tokens'; accessToken: string; refreshToken: string; invitation?: true }
  | { kind: 'token-hash'; tokenHash: string; type: LinkType }
  | { kind: 'session' };

export function parseInvitationLink(search: string, hash: string): InvitationLink {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ''));
  const get = (key: string) => fragment.get(key) ?? query.get(key);
  const type = get('type');
  const invitation = type === 'invite' || type === 'recovery' || type === 'magiclink';
  const code = get('error_code');
  if (code === 'otp_expired') return { kind: 'error', message: expiredInvitationMessage };
  if ((get('error') || code) && (invitation || /email.link/i.test(get('error_description') ?? ''))) {
    return { kind: 'error', message: 'No se pudo verificar el enlace de acceso. Solicita una nueva invitación.' };
  }
  const accessToken = get('access_token');
  if (accessToken) return { kind: 'tokens', accessToken, refreshToken: get('refresh_token') ?? '', ...(invitation ? { invitation: true as const } : {}) };
  const tokenHash = get('token_hash');
  if (invitation && tokenHash) return { kind: 'token-hash', tokenHash, type };
  if (invitation) return { kind: 'session' };
  return { kind: 'none' };
}

export function invitationLanding(search: string, completePassword = false): string {
  const scope = currentAdminScope(search);
  const params = new URLSearchParams();
  if (scope.institution) params.set('institution', scope.institution);
  if (scope.slug) params.set('slug', scope.slug);
  if (completePassword) params.set('accept_invitation', '1');
  return '/panel/admin' + (params.size ? '?' + params.toString() : '');
}
