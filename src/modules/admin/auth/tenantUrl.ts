import { canonicalSlug } from './canonicalSlug.ts';

export interface TenantIdentity { institution_id: string; slug: string; name: string }

// An assigned ID takes precedence over a conflicting slug. Never combine rows.
export function resolveTenantIdentity(items: readonly TenantIdentity[], search: string): TenantIdentity | undefined {
  const params = new URLSearchParams(search);
  const id = params.get('institution');
  const slug = params.get('slug');
  return items.find(item => item.institution_id === id)
    ?? items.find(item => item.slug.toLowerCase() === (id ?? '').toLowerCase())
    ?? items.find(item => item.slug.toLowerCase() === (slug ?? '').toLowerCase());
}

export function canonicalTenantSearch(search: string, tenant: TenantIdentity): string {
  const params = new URLSearchParams(search);
  params.set('institution', tenant.institution_id);
  params.set('slug', tenant.slug);
  return '?' + params.toString();
}

export function invitationRedirect(origin: string, tenant: TenantIdentity): string {
  const base = new URL(origin);
  const slug = canonicalSlug(tenant.slug);
  if (!['http:', 'https:'].includes(base.protocol) || !tenant.institution_id || !slug) throw new Error('El contexto institucional de la invitación no es válido.');
  const url = new URL('/panel/admin', base.origin);
  url.searchParams.set('institution', tenant.institution_id);
  url.searchParams.set('slug', slug);
  return url.href;
}
