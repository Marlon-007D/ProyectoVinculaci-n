import { canonicalTenantRole } from './accessPolicy.ts';

/** Existing DECE routes use this public role identifier; authority stays canonical and tenant-scoped. */
export function workspaceAuthRole(role: string): string {
  return canonicalTenantRole(role) === 'dece' ? 'dece_staff' : canonicalTenantRole(role);
}
