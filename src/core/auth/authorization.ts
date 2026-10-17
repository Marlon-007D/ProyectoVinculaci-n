/** Auth-owned values must be supplied by a verified session adapter. */
export interface VerifiedSessionContext {
  userId: string
  institutionId: string | null
  role: 'superadmin' | 'institution_admin' | 'teacher' | 'student' | null
  membershipStatus: 'pending' | 'approved' | 'rejected' | null
}

export interface SessionProvider {
  getVerifiedSession(): Promise<VerifiedSessionContext | null>
}

export interface TenantAuthorization {
  canAccessInstitution(institutionId: string): Promise<boolean>
}

/**
 * The Auth team will implement this port with a refreshed, verified Supabase
 * access token. The browser must never derive it from tenant form fields.
 */
export interface AccessTokenProvider {
  getAccessToken(): Promise<string | null>
}

/** Safe adapter until the Auth team provides a verified session provider. */
export class DenyByDefaultAuthorization implements SessionProvider, TenantAuthorization, AccessTokenProvider {
  async getVerifiedSession(): Promise<null> {
    return null
  }

  async canAccessInstitution(_institutionId: string): Promise<boolean> {
    return false
  }

  async getAccessToken(): Promise<null> {
    return null
  }
}

export function isApprovedTenantSession(
  session: VerifiedSessionContext | null,
  requestedInstitutionId: string,
): boolean {
  return Boolean(
    session
      && session.userId
      && session.institutionId
      && session.institutionId === requestedInstitutionId
      && session.membershipStatus === 'approved'
      && session.role !== null,
  )
}
