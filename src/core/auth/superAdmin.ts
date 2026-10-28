export function isSuperAdmin(role: unknown): boolean {
  return role === 'super_admin' || role === 'superadmin';
}

export interface GlobalAdminAuthority {
  getVerifiedRole: (profileId: string) => Promise<unknown>;
  hasGlobalRole: () => Promise<boolean>;
}

export async function hasSuperAdminAccess(profileId: string, authority: GlobalAdminAuthority): Promise<boolean> {
  if (isSuperAdmin(await authority.getVerifiedRole(profileId))) return true;
  return authority.hasGlobalRole();
}
