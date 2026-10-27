import { isTenantSuperAdmin } from '../auth/accessPolicy.ts';
import { adminDestination } from '../auth/institutionNavigation.ts';

export interface AssignedAdminTenant {
  institution_id: string;
  name: string;
  slug: string;
  role: string;
  is_active: boolean;
}

export function selectableAdminTenants<T extends AssignedAdminTenant>(institutions: readonly T[]): T[] {
  return institutions.filter(item => item.is_active && isTenantSuperAdmin(item.role))
    .filter((item, index, items) => items.findIndex(other => other.institution_id === item.institution_id) === index)
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));
}

export function tenantSelectionDestination(institutions: readonly AssignedAdminTenant[], institutionId: string, search: string, hash: string): string | null {
  const selected = selectableAdminTenants(institutions).find(item => item.institution_id === institutionId);
  if (!selected) return null;
  return adminDestination('/panel/admin' + hash, search, { institution: selected.institution_id, slug: selected.slug });
}
