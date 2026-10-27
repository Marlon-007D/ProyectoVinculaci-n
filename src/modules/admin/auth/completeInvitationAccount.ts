import type { SupabaseClient } from '@supabase/supabase-js';
import type { InvitationAccountService } from './invitationAccount';

export const invitationPasswordMinimum = 6;

export function invitationPasswordIssue(password: string, confirmation: string): string | null {
  if (password.length < invitationPasswordMinimum) return 'La contraseña debe tener al menos 6 caracteres.';
  return password === confirmation ? null : 'Las contraseñas no coinciden.';
}

type InvitationAuth = Pick<SupabaseClient['auth'], 'getSession' | 'getUser' | 'refreshSession' | 'updateUser' | 'signInWithPassword'>;

/** Validate the current identity before changing credentials or accepting scoped access. */
export async function completeInvitationAccount(auth: InvitationAuth, accounts: InvitationAccountService,
  input: { userId: string; institutionId: string; slug: string; password: string },
  saveInvitedPassword?: (institutionId: string, password: string) => Promise<void>,
  prepareSession?: () => void) {
  const session = await auth.getSession();
  if (session.error || !session.data.session || session.data.session.user.id !== input.userId) {
    throw new Error('La sesión de invitación no está disponible. Abre nuevamente el enlace del correo.');
  }
  if (session.data.session.expires_at && session.data.session.expires_at * 1000 <= Date.now() + 30_000) {
    const renewed = await auth.refreshSession();
    if (renewed.error || renewed.data.session?.user.id !== input.userId) {
      throw new Error('Tu sesión ha expirado. Solicita un nuevo enlace de acceso.');
    }
  }
  const identity = await auth.getUser();
  if (identity.error || identity.data.user?.id !== input.userId) throw new Error('No se pudo verificar tu sesión. Abre nuevamente el enlace del correo.');
  const details = await accounts.load(input.userId, input.institutionId, input.slug);
  const saved = await auth.updateUser({ password: input.password });
  let savedOnServer = false;
  // Auth confirms this password is already persisted; allow retrying acceptance
  // after a previous successful password write without changing it again.
  if (saved.error && saved.error.code !== 'same_password') {
    const requiresAal2 = saved.error.code === 'insufficient_aal'
      || /AAL2 session is required/i.test(saved.error.message);
    if (requiresAal2 && details.pending && saveInvitedPassword) {
      await saveInvitedPassword(input.institutionId, input.password);
      savedOnServer = true;
    } else {
      throw new Error(`No se pudo guardar la contraseña: ${saved.error.message}`);
    }
  }
  try {
    if (details.pending) await accounts.accept(input.institutionId);
  } catch (cause: unknown) {
    const reason = cause instanceof Error ? cause.message : 'Inténtalo nuevamente.';
    throw new Error(`La contraseña se guardó, pero no se pudo activar el acceso. ${reason}`, { cause });
  }
  // Credential and membership writes have succeeded. Synchronization failure must
  // not misreport them as failed or ask the user to change the password again.
  try {
    prepareSession?.();
    if (savedOnServer) {
      // An administrative password change can invalidate the old refresh token.
      // Establish a fresh SDK-persisted session using the password just saved.
      const signedIn = await auth.signInWithPassword({ email: details.email, password: input.password });
      if (signedIn.error || signedIn.data.session?.user.id !== input.userId) return { details, synchronized: false };
    }
    if (identity.data.user.user_metadata?.admin_tenant_onboarding === true) {
      const metadata = await auth.updateUser({ data: { admin_tenant_onboarding: false } });
      if (metadata.error) return { details, synchronized: false };
    }
    if (savedOnServer) return { details, synchronized: true };
    const refreshed = await auth.refreshSession();
    return { details, synchronized: !refreshed.error };
  } catch {
    return { details, synchronized: false };
  }
}
