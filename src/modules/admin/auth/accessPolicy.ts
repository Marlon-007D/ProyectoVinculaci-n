export interface AccessScope { institution?: string; slug?: string }
export interface AssignedMembership {
  institutionId: string;
  slug: string;
  role: string | null;
  active: boolean;
}
export type AssignedAccess =
  | { status: 'authorized'; role: string; institutionId: string | null }
  | { status: 'unassigned' }
  | { status: 'verification-failed' };

export function isGlobalAdmin(role: unknown): boolean {
  return role === 'super_admin' || role === 'superadmin';
}

const assignedRoles = new Set(['institution_admin', 'dece', 'dece_staff', 'projects_manager', 'project_manager', 'content_editor', 'editor', 'student']);
const pendingRoles = new Set(['pending', 'guest', 'invitado', 'viewer']);

export function scopeMatches(scope: AccessScope, membership: AssignedMembership): boolean {
  const reference = scope.institution?.toLowerCase();
  return (!reference || reference === membership.institutionId.toLowerCase() || reference === membership.slug.toLowerCase())
    && (!scope.slug || scope.slug.toLowerCase() === membership.slug.toLowerCase());
}

export function resolveAssignedAccess(memberships: AssignedMembership[], scope: AccessScope): AssignedAccess {
  if (memberships.some(item => item.active && isGlobalAdmin(item.role))) {
    return { status: 'authorized', role: 'super_admin', institutionId: null };
  }
  const scoped = memberships.filter(item => item.active && scopeMatches(scope, item));
  const assigned = scoped.find(item => item.role && assignedRoles.has(item.role));
  if (assigned?.role) return { status: 'authorized', role: assigned.role, institutionId: assigned.institutionId };
  if (scoped.some(item => !item.role || !pendingRoles.has(item.role))) return { status: 'verification-failed' };
  return { status: 'unassigned' };
}

export function accessScopeKey(scope: AccessScope): string {
  return JSON.stringify([scope.institution?.toLowerCase() ?? '', scope.slug?.toLowerCase() ?? '']);
}
