import { canAssignTenantRole, canonicalTenantRole, isTenantSuperAdmin } from '../auth/accessPolicy.ts';
export type MembershipTab = 'team' | 'registered' | 'students';

export const membershipTabs: { id: MembershipTab; label: string }[] = [
  { id: 'team', label: 'Personal y Equipo' },
  { id: 'registered', label: 'Usuarios Registrados' },
  { id: 'students', label: 'Estudiantes' },
];

export function institutionalRoleOptions<T extends { name: string }>(roles: T[], isPlatformAdmin: boolean): T[] {
  return roles.filter(role => canAssignTenantRole(isPlatformAdmin ? 'super_admin' : 'institution_admin', role.name));
}

export function membershipTab(role: string | null): MembershipTab | null {
  switch (role ? canonicalTenantRole(role) : role) {
    case 'super_admin':
    case 'teacher':
    case 'secretary':
    case 'staff':
    case 'institution_admin':
    case 'dece':
    case 'dece_staff':
    case 'projects_manager':
    case 'project_manager':
    case 'content_editor':
    case 'editor': return 'team';
    case 'student': return 'students';
    case 'pending':
    case 'guest':
    case 'invitado':
    case null:
    case '': return 'registered';
    default: return null;
  }
}

export function canRemoveMembership(actorId: string | undefined, profileId: string, role: string | null) {
  return Boolean(actorId && actorId !== profileId && role && !isTenantSuperAdmin(role));
}

export function visibleInstitutionMemberships<T extends { profile_id: string; institution_id: string; role_name: string | null }>(
  members: T[], institutionId: string | null, isPlatformAdmin: boolean,
): T[] {
  if (!institutionId) return [];
  const scoped = members.filter(member => member.institution_id === institutionId
    && (isPlatformAdmin || !isTenantSuperAdmin(member.role_name)));
  return scoped.filter(member => member.role_name !== null || !scoped.some(other => other.profile_id === member.profile_id
    && other.institution_id === member.institution_id && other.role_name));
}
