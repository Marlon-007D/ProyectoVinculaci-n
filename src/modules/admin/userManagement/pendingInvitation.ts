import { canonicalTenantRole } from '../auth/accessPolicy.ts';
import type { AssignTenantRole, TenantMember, TenantSnapshot } from './tenantAdmin.types';

/** Reuse the verified row, never another tenant's form or a caller supplied role. */
export function pendingInvitationInput(snapshot: TenantSnapshot, member: TenantMember, institutionId: string): AssignTenantRole {
  const stored = snapshot.members.find(row => row.profile_id === member.profile_id && row.institution_id === institutionId);
  const role = snapshot.roles.find(row => canonicalTenantRole(row.name) === canonicalTenantRole(stored?.role_name ?? ''));
  if (snapshot.institution_id !== institutionId || !stored?.invitation_pending || stored.is_active || !role) {
    throw new Error('No se pudo verificar la invitación pendiente de esta institución.');
  }
  return { institutionId, email: stored.email, roleId: role.role_id, firstName: stored.first_name,
    lastName: stored.last_name, phone: stored.phone, modules: stored.modules.filter(name => snapshot.modules.includes(name)) };
}
