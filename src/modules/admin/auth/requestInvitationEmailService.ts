import type { SupabaseClient } from '@supabase/supabase-js';
import type { InvitationEmailResult } from './RequestInvitationEmail';

export async function requestInvitationEmailService(client: Pick<SupabaseClient, 'functions'>,
  email: string, institutionId: string): Promise<InvitationEmailResult> {
  const { data, error } = await client.functions.invoke<InvitationEmailResult>('admin-tenant-invite', {
    body: { action: 'request_invitation_email', email, institutionId },
  });
  if (!error) return data ?? { error: 'El servidor no confirmó la solicitud.' };
  if (error.context instanceof Response) {
    const response = error.context;
    const body: unknown = await response.clone().json().catch(() => null);
    const value = body && typeof body === 'object' ? body : {};
    return { rateLimited: response.status === 429,
      retryAfter: 'retryAfter' in value && typeof value.retryAfter === 'number' ? value.retryAfter : 60,
      error: 'error' in value && typeof value.error === 'string' ? value.error : 'No se pudo solicitar el correo. Verifica la actualización de admin-tenant-invite.' };
  }
  throw new Error('No se pudo conectar con el servicio de invitaciones.');
}
