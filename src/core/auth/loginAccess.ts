export interface LoginInstitution {
  institution_id: string;
  slug: string;
  role: string;
  is_active: boolean;
}

export type LoginAccess<T> =
  | { status: 'select'; institutions: T[] }
  | { status: 'unassigned' }
  | { status: 'redirect'; destination: string };

export function institutionMatches(item: { institution_id: string; slug?: string }, reference: string): boolean {
  return item.institution_id.toLowerCase() === reference.toLowerCase()
    || (Boolean(item.slug) && item.slug?.toLowerCase() === reference.toLowerCase());
}

export function loginDestination(institution: LoginInstitution): string {
  const query = '?institution=' + encodeURIComponent(institution.institution_id);
  const base = '/' + encodeURIComponent(institution.slug);
  switch (institution.role) {
    case 'super_admin': return '/panel/superadmin' + query;
    case 'institution_admin': return '/panel/admin' + query;
    case 'dece':
    case 'dece_staff': return base + '/dece' + query;
    case 'student': return base + '/mi-ficha' + query;
    case 'projects_manager':
    case 'project_manager': return '/panel/proyectos' + query;
    case 'content_editor':
    case 'editor': return '/panel/portal' + query;
    case 'viewer': return '/proyectos?transparency=1&institution=' + encodeURIComponent(institution.slug);
    default: return base + '/sin-modulos' + query;
  }
}

// URL references are preferences. Only verified, active memberships authorize access.
export function resolveLoginAccess<T extends LoginInstitution>(institutions: T[], references: string[]): LoginAccess<T> {
  const active = institutions.filter(item => item.is_active);
  for (const reference of references.filter(Boolean)) {
    const match = active.find(item => institutionMatches(item, reference));
    if (match) return { status: 'redirect', destination: loginDestination(match) };
  }
  if (active.length === 1) return { status: 'redirect', destination: loginDestination(active[0]) };
  return active.length ? { status: 'select', institutions: active } : { status: 'unassigned' };
}
