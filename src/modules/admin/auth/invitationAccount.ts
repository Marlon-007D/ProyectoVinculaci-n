import type { SupabaseClient } from '@supabase/supabase-js';
import { canonicalSlug } from './canonicalSlug.ts';

export interface InvitationDetails {
  email: string; firstName: string; lastName: string; phone: string;
  institutionId: string; slug: string; role: string; pending?: boolean; institutionName?: string;
}
export interface InvitationAccountService {
  load(userId: string, institutionId: string, slug: string): Promise<InvitationDetails>;
  accept(institutionId: string): Promise<void>;
}
function record(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }

export function verifiedInvitationDetails(profile: unknown, membership: unknown, email: string, institutionId: string, slug: string, pending = false): InvitationDetails {
  if (!record(profile) || !['first_name', 'last_name', 'phone'].every(key => typeof profile[key] === 'string' && profile[key].trim())
    || !record(membership) || membership.institution_id !== institutionId || (pending ? membership.is_active !== false : membership.is_active !== true)
    || !record(membership.institutions) || typeof membership.institutions.slug !== 'string' || !canonicalSlug(slug) || canonicalSlug(membership.institutions.slug) !== canonicalSlug(slug)
    || !record(membership.roles) || typeof membership.roles.name !== 'string' || !membership.roles.name || !email) {
    throw new Error('No se pudieron verificar los datos asignados a tu invitación en esta institución.');
  }
  return { email, firstName: String(profile.first_name), lastName: String(profile.last_name), phone: String(profile.phone), institutionId, slug: membership.institutions.slug, role: membership.roles.name,
    ...(typeof membership.institutions.name === 'string' ? { institutionName: membership.institutions.name } : {}) };
}

export function createInvitationAccountService(client: Pick<SupabaseClient, 'auth' | 'from' | 'rpc'>): InvitationAccountService {
  return {
    async load(userId, institutionId, slug) {
      try {
        const { data: identity, error: identityError } = await client.auth.getUser();
        if (identityError || identity.user?.id !== userId || !identity.user.email_confirmed_at || !identity.user.email) throw new Error('Confirma el enlace del correo antes de completar tu cuenta.');
        const own = await client.rpc('admin_tenant_own_invitation', { target_institution_id: institutionId });
        if (own.error && own.error.code !== 'PGRST202') throw new Error('No se pudo verificar la invitación pendiente. Revisa la conexión y el script 006.');
        const invitation: unknown = own.data;
        if (record(invitation) && invitation.pending === true && invitation.email === identity.user.email) {
          return { ...verifiedInvitationDetails(invitation.profile, invitation.membership, identity.user.email, institutionId, slug, true), pending: true };
        }
        const { data: profile, error: profileError } = await client.from('profiles').select('first_name,last_name,phone').eq('profile_id', userId).maybeSingle();
        const { data: membership, error: membershipError } = await client.from('memberships').select('institution_id,is_active,roles(name),institutions(slug)')
          .eq('profile_id', userId).eq('institution_id', institutionId).eq('is_active', true).maybeSingle();
        if (profileError || membershipError) throw new Error('No se pudieron consultar tus datos. Revisa la conexión y vuelve a intentarlo.');
        // Server-owned invitation metadata preserves the administrator's original
        // contact values even if a profile trigger created an incomplete profile.
        const assigned: unknown = identity.user.app_metadata?.admin_tenant_invitation;
        const trustedDetails = record(assigned) && assigned.institution_id === institutionId && typeof assigned.slug === 'string' && canonicalSlug(assigned.slug) === canonicalSlug(slug)
          && assigned.email === identity.user.email ? assigned : profile;
        return verifiedInvitationDetails(trustedDetails, membership, identity.user.email, institutionId, slug);
      } catch (cause: unknown) {
        if (cause instanceof Error) throw cause;
        throw new Error('No se pudo verificar la invitación.', { cause });
      }
    },
    async accept(institutionId) {
      const { error } = await client.rpc('admin_tenant_accept_invitation', { target_institution_id: institutionId });
      if (error) throw new Error('No se pudo activar la membresía pendiente. Verifica el correo y el script 006.');
    },
  };
}
