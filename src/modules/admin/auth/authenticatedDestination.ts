import { canonicalTenantRole, isTenantSuperAdmin, scopeMatches } from './accessPolicy.ts';
import { canonicalSlug } from './canonicalSlug.ts';

interface VerifiedInstitution {
  institution_id: string; slug: string; role: string; is_active: boolean;
  module_permissions: Partial<Record<string, boolean>>;
}

/** Use verified memberships and permissions, never a URL role or a legacy slug login. */
export function authenticatedDestination(institution: VerifiedInstitution, authInstitutionId: string | null, role: string | null, search: string): string | null {
  const params = new URLSearchParams(search);
  if (!role || !institution.is_active || institution.institution_id !== authInstitutionId
    || canonicalTenantRole(role) !== canonicalTenantRole(institution.role)
    || !scopeMatches({ institution: params.get('institution') ?? undefined, slug: params.get('slug') ?? undefined },
      { institutionId: institution.institution_id, slug: institution.slug, role, active: true })) return null;
  const modules: Readonly<Record<string, readonly [string, string]>> = {
    dece: ['dece', '/panel/dece'], projects_manager: ['projects', '/panel/proyectos'],
    content_editor: ['portal', '/panel/portal'],
  };
  const preferred = modules[canonicalTenantRole(role)];
  // Module roles open their module; administrators open the panel home, which lists only their modules.
  const path = preferred && institution.module_permissions[preferred[0]] ? preferred[1] : isTenantSuperAdmin(role) ? '/panel/admin' : '/panel';
  return path + '?' + new URLSearchParams({ institution: institution.institution_id, slug: canonicalSlug(institution.slug) }).toString();
}
