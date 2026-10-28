import type { SupabaseClient } from '@supabase/supabase-js';
import { canonicalSlug } from './canonicalSlug.ts';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** A cached session alone cannot authorize a callback for another institution. */
export async function recoverInvitationSession(client: Pick<SupabaseClient, 'auth' | 'rpc'>, search: string): Promise<boolean> {
  const params = new URLSearchParams(search);
  const institution = params.get('institution') ?? params.get('institution_id');
  const slug = params.get('slug');
  if (!institution || !slug || !canonicalSlug(slug)) return false;
  try {
    // Wait for the SDK's initial URL processing before interpreting the URL error.
    const session = await client.auth.getSession();
    if (!session.data.session) return false;
    const identity = await client.auth.getUser();
    if (identity.error || identity.data.user?.id !== session.data.session.user.id || !identity.data.user?.email_confirmed_at) return false;
    for (const rpc of ['admin_tenant_own_invitation', 'admin_tenant_own_account']) {
      const result: { data: unknown; error: unknown } = await client.rpc(rpc, { target_institution_id: institution });
      const { data, error } = result;
      if (error || !record(data) || data.email !== identity.data.user.email || !record(data.membership)) continue;
      const member = data.membership;
      if (member.institution_id === institution && record(member.institutions)
        && typeof member.institutions.slug === 'string' && canonicalSlug(member.institutions.slug) === canonicalSlug(slug)
        && (rpc === 'admin_tenant_own_invitation' ? data.pending === true && member.is_active === false : member.is_active === true)) return true;
    }
    return false;
  } catch { return false; }
}
