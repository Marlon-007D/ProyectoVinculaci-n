export interface AccessScope { institution?: string; slug?: string }
export interface AssignedMembership { institutionId: string; slug: string; role: string | null; active: boolean }
export type AssignedAccess =
  | { status: 'authorized'; role: string; institutionId: string }
  | { status: 'unassigned' }
  | { status: 'verification-failed' };

export function canonicalTenantRole(role: string): string {
  const aliases: Record<string, string> = { superadmin: 'super_admin', admin: 'institution_admin', docente: 'teacher', secretaria: 'secretary', personal: 'staff', dece_staff: 'dece', project_manager: 'projects_manager', editor: 'content_editor' };
  return aliases[role] ?? role;
}
export function isTenantSuperAdmin(role: unknown): boolean { return role === 'super_admin' || role === 'superadmin'; }
export function isTenantAdmin(role: unknown): boolean { return role === 'institution_admin' || role === 'admin'; }
export function isTenantManager(role: unknown): boolean { return isTenantSuperAdmin(role) || isTenantAdmin(role); }
export const internalRoles = ['teacher', 'secretary', 'staff', 'dece', 'projects_manager', 'content_editor', 'student', 'guest'] as const;
const assignedRoles = new Set<string>(['super_admin', 'institution_admin', ...internalRoles]);
const pendingRoles = new Set(['pending', 'guest', 'invitado', 'viewer']);
export function scopeMatches(scope: AccessScope, membership: AssignedMembership): boolean {
  const reference = scope.institution?.toLowerCase();
  return (!reference || reference === membership.institutionId.toLowerCase() || reference === membership.slug.toLowerCase())
    && (!scope.slug || scope.slug.toLowerCase() === membership.slug.toLowerCase());
}
export function resolveAssignedAccess(memberships: AssignedMembership[], scope: AccessScope): AssignedAccess {
  const scoped = memberships.filter(item => item.active && scopeMatches(scope, item));
  const assigned = scoped.find(item => item.role && assignedRoles.has(canonicalTenantRole(item.role)));
  if (assigned?.role) return { status: 'authorized', role: canonicalTenantRole(assigned.role), institutionId: assigned.institutionId };
  if (scoped.some(item => !item.role || !pendingRoles.has(item.role))) return { status: 'verification-failed' };
  return { status: 'unassigned' };
}
export function accessScopeKey(scope: AccessScope): string { return JSON.stringify([scope.institution?.toLowerCase() ?? '', scope.slug?.toLowerCase() ?? '']); }
export function canAssignTenantRole(actorRole: string | null, targetRole: string): boolean {
  if (!actorRole) return false;
  const target = canonicalTenantRole(targetRole);
  if (isTenantSuperAdmin(actorRole)) return target === 'institution_admin';
  return isTenantAdmin(actorRole) && internalRoles.some(role => role === target);
}
export function canManageTenantMember(actor: { profileId: string; institutionId: string; role: string }, target: { profileId: string; institutionId: string; role: string | null }): boolean {
  if (!actor.institutionId || actor.institutionId !== target.institutionId || actor.profileId === target.profileId) return false;
  if (!target.role || pendingRoles.has(target.role)) return isTenantManager(actor.role);
  return canAssignTenantRole(actor.role, target.role);
}

export function canDeleteTenantMember(actor: { profileId: string; institutionId: string; role: string }, target: { profileId: string; institutionId: string; role: string | null }): boolean {
  return Boolean(actor.institutionId && actor.institutionId === target.institutionId
    && actor.profileId !== target.profileId && isTenantManager(actor.role) && !isTenantSuperAdmin(target.role));
}
