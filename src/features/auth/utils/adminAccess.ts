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
  if (input.loadingTenant) return { status: 'loading', message: 'Validando tu institución…' };
  if (!input.hasInstitution && input.role !== 'super_admin') {
    return { status: 'login', issue: input.tenantError ? 'verification-failed' : 'membership-required' };
  }
  return { status: 'authorized' };
}
