import { isGlobalAdmin as isSuperAdmin } from './accessPolicy.ts';
export type AccessIssue = 'membership-required' | 'verification-failed';

type AdminAccess =
  | { status: 'loading'; message: string }
  | { status: 'login'; issue: AccessIssue | null }
  | { status: 'mfa' }
  | { status: 'authorized' };

export function resolveAdminAccess(input: {
  loading: boolean;
  hasUser: boolean;
  role: string | null;
  roleIssue: AccessIssue | null;
  mfaPending: boolean;
  loadingTenant: boolean;
  hasInstitution: boolean;
  tenantError: string | null;
}): AdminAccess {
  if (input.loading) return { status: 'loading', message: 'Validando sesión con Google…' };
  if (!input.hasUser) return { status: 'login', issue: null };
  if (input.mfaPending) return { status: 'mfa' };
  if (!input.role) return { status: 'login', issue: input.roleIssue ?? 'membership-required' };
  if (isSuperAdmin(input.role)) return { status: 'authorized' };
  if (input.loadingTenant) return { status: 'loading', message: 'Validando tu institución…' };
  if (!input.hasInstitution) {
    return { status: 'login', issue: input.tenantError ? 'verification-failed' : 'membership-required' };
  }
  return { status: 'authorized' };
}

export function resolveLoginIssue(input: {
  hasUser: boolean; role: string | null; roleIssue: AccessIssue | null;
  mfaPending: boolean; loadingTenant: boolean; hasInstitution: boolean; tenantError: string | null;
}): AccessIssue | null {
  if (!input.hasUser || isSuperAdmin(input.role) || input.mfaPending) return null;
  if (input.hasInstitution && input.role) return null;
  if (input.roleIssue) return input.roleIssue;
  if (!input.role || input.loadingTenant || input.hasInstitution) return null;
  return input.tenantError ? 'verification-failed' : 'membership-required';
}
