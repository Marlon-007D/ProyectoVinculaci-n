import type { SupabaseClient } from '@supabase/supabase-js';
import type { InvitationLink } from './invitationLink';

type CapturableLink = Exclude<InvitationLink, { kind: 'none' | 'error' }>;
type CallbackAuth = Pick<SupabaseClient['auth'], 'getSession' | 'setSession' | 'verifyOtp'>;

export async function captureInvitationSession(link: CapturableLink, auth: CallbackAuth, isCurrent: () => boolean = () => true): Promise<void> {
  const initial = await auth.getSession();
  if (!isCurrent()) return;
  if (initial.error) throw initial.error;
  if (link.kind === 'token-hash') {
    const verified = await auth.verifyOtp({ token_hash: link.tokenHash, type: link.type });
    if (verified.error) throw verified.error;
    return;
  }
  if (link.kind === 'tokens' && initial.data.session?.access_token !== link.accessToken) {
    if (!link.refreshToken) throw new Error('El enlace no contiene una sesión completa.');
    const restored = await auth.setSession({ access_token: link.accessToken, refresh_token: link.refreshToken });
    if (restored.error) throw restored.error;
    return;
  }
  if (!initial.data.session) throw new Error('El enlace no contiene una sesión válida.');
}
