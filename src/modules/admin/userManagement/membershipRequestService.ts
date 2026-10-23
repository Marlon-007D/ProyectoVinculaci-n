import { supabase } from '../../../core/supabaseClient';

export interface AccessRequestService {
  get(institution: string, slug?: string): Promise<{ status: 'pending' | 'approved' } | null>;
  submit(input: { institution: string; slug?: string; firstName: string; lastName: string; phone: string }): Promise<void>;
}

export const membershipRequestService: AccessRequestService = {
  async get(institution, slug) {
    const { data, error } = await supabase.rpc('own_institution_access_request', { target_institution: institution, target_slug: slug ?? null });
    if (error) throw new Error('No se pudo consultar tu solicitud. Verifica que la migración de solicitudes esté aplicada.');
    if (data === null) return null;
    if (data.status !== 'pending' && data.status !== 'approved') throw new Error('El estado de la solicitud no es válido.');
    return data;
  },
  async submit(input) {
    const { error } = await supabase.rpc('request_institution_access', {
      target_institution: input.institution, target_slug: input.slug ?? null,
      given_name: input.firstName, family_name: input.lastName, contact_phone: input.phone,
    });
    if (error) throw new Error(error.message);
  },
};
