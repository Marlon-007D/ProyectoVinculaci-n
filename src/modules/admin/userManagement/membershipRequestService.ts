import { supabase } from '../../../core/supabaseClient';

export interface AccessRequestService {
  get(institution: string, slug?: string): Promise<{ status: 'pending' | 'approved' } | null>;
  submit(input: { institution: string; slug?: string; firstName: string; lastName: string; phone: string }): Promise<void>;
}

export const membershipRequestService: AccessRequestService = {
  async get(institution: string, slug?: string) {
    let data: unknown;
    try {
      const result = await supabase.rpc('own_institution_access_request', { target_institution: institution, target_slug: slug ?? null });
      if (result.error) throw result.error;
      data = result.data;
    } catch (cause: unknown) {
      throw new Error('No se pudo consultar tu solicitud. Verifica la conexión y que la migración de solicitudes esté aplicada.', { cause });
    }
    if (data === null) return null;
    if (typeof data !== 'object' || !('status' in data) || (data.status !== 'pending' && data.status !== 'approved')) {
      throw new Error('El estado de la solicitud no es válido.');
    }
    return { status: data.status };
  },
  async submit(input: Parameters<AccessRequestService['submit']>[0]) {
    try {
      const { error } = await supabase.rpc('request_institution_access', {
        target_institution: input.institution, target_slug: input.slug ?? null,
        given_name: input.firstName, family_name: input.lastName, contact_phone: input.phone,
      });
      if (error) throw error;
    } catch (cause: unknown) {
      let message = 'No se pudo enviar la solicitud. Revisa tu conexión e intenta nuevamente.';
      if (cause !== null && typeof cause === 'object' && 'message' in cause && typeof cause.message === 'string') {
        message = cause.message;
      }
      throw new Error(message, { cause });
    }
  },
};
