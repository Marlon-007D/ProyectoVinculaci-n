import { currentAdminScope } from '../modules/admin/auth/institutionNavigation';
import { logoutDestination, logoutToPublicInstitution, remoteSignOutTarget } from '../modules/admin/auth/logoutDestination';
import { readSessionValue, writeSessionValue } from '../modules/admin/auth/sessionStorage';
import { useLocation, useNavigate } from 'react-router-dom';
import { accessScopeKey, resolveAssignedAccess } from '../modules/admin/auth/accessPolicy';
import { workspaceAuthRole } from '../modules/admin/auth/workspaceAuthRole';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { registerInstitutionalAccount } from './auth/registerInstitutionalAccount';
import { MFA_ENABLED } from './mfaConfig';
import { googleOAuthRequest, institutionContextFromSearch } from '../features/auth/utils/googleOAuth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  roleError: string | null;
  roleIssue: 'membership-required' | 'verification-failed' | null;
  institutionId: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ error: Error | null }>;
  loginWithGoogle: (context?: { institution?: string; slug?: string }) => Promise<{ error: Error | null }>;
  requestLoginLink: (email: string) => Promise<{ error: Error | null }>;
  register: (email: string, password: string, firstName: string, lastName: string, institutionId: string) => Promise<{ error: Error | null }>;
  isPasswordRecovery: boolean;
  mfaRequired: boolean;
  mfaEnrollmentRequired: boolean;
  completeMfaEnrollment: () => void;
  mfaChallengeReady: boolean;
  verifyMfa: (code: string) => Promise<{ error: Error | null }>;
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [publicLogoutTarget, setPublicLogoutTarget] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);
  useEffect(() => {
    if (!publicLogoutTarget) return;
    if (location.pathname + location.search !== publicLogoutTarget) {
      navigate(publicLogoutTarget, { replace: true });
      return;
    }
    // Let awaiting sidebar handlers finish before releasing the destination.
    const timer = window.setTimeout(() => setPublicLogoutTarget(null), 0);
    return () => window.clearTimeout(timer);
  }, [publicLogoutTarget, location.pathname, location.search, navigate]);
  const scope = institutionContextFromSearch(location.search);
  const scopeKey = accessScopeKey(scope);
  const resolvedScope = useRef<string | null>(null);
  // Once a session has resolved, a scope change revalidates access in the background
  // instead of raising `loading`, which would blank the private area.
  const sessionResolvedRef = useRef(false);
  // The institution in use survives the sign-out so a tab closed from elsewhere can return to its public portal.
  const knownInstitution = useRef<string | null>(null);
  const ownLogout = useRef(false);
  const roleRevision = useRef(0);
  const sessionUserId = useRef<string | null>(null);
  const sessionRevision = useRef(0);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [roleIssue, setRoleIssue] = useState<AuthContextType['roleIssue']>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaEnrollmentRequired, setMfaEnrollmentRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const mfaChallengeRef = useRef<{ factorId: string; challengeId: string } | null>(null);

  const checkMfaSession = async (nextSession: Session | null): Promise<boolean> => {
    // With MFA switched off no sign-in method is challenged, whatever the account's stored factors.
    if (!nextSession || !MFA_ENABLED) {
      setMfaRequired(false);
      setMfaFactorId(null);
      setMfaChallengeId(null);
      mfaChallengeRef.current = null;
      return false;
    }
    const revision = sessionRevision.current;
    const current = () => revision === sessionRevision.current && sessionUserId.current === nextSession.user.id;
    const { data: mfaEnabledForAssignedUser, error: eligibilityError } = await supabase.rpc('own_mfa_enabled_for_assigned_user');
    if (!current()) return true;
    if (eligibilityError || !mfaEnabledForAssignedUser) {
      setMfaRequired(false);
      setMfaFactorId(null);
      setMfaChallengeId(null);
      mfaChallengeRef.current = null;
      return false;
    }
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!current()) return true;
    if (assuranceError) {
      setMfaRequired(true);
      setMfaFactorId(null);
      setMfaChallengeId(null);
      mfaChallengeRef.current = null;
      return true;
    }
    if (assurance.currentLevel === 'aal2' || assurance.nextLevel !== 'aal2') {
      setMfaRequired(false);
      setMfaFactorId(null);
      setMfaChallengeId(null);
      mfaChallengeRef.current = null;
      return false;
    }
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (!current()) return true;
    if (factorsError) {
      setMfaRequired(true);
      setMfaFactorId(null);
      setMfaChallengeId(null);
      mfaChallengeRef.current = null;
      return true;
    }
    const factor = factors.totp.find((item) => item.status === 'verified');
    if (!factor) {
      setMfaRequired(false);
      setMfaFactorId(null);
      setMfaChallengeId(null);
      mfaChallengeRef.current = null;
      return false;
    }
    if (mfaChallengeRef.current?.factorId === factor.id) return true;
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (!current()) return true;
    if (challengeError) {
      setMfaRequired(true);
      setMfaFactorId(factor.id);
      setMfaChallengeId(null);
      mfaChallengeRef.current = null;
      return true;
    }
    setMfaFactorId(factor.id);
    setMfaChallengeId(challenge.id);
    mfaChallengeRef.current = { factorId: factor.id, challengeId: challenge.id };
    setMfaRequired(true);
    return true;
  };

  const fetchUserRoleAndTenant = useCallback(async (userId: string) => {
    const revision = ++roleRevision.current;
    const current = () => revision === roleRevision.current && sessionUserId.current === userId;
    const context = institutionContextFromSearch(window.location.search);
    resolvedScope.current = accessScopeKey(context);
    setRoleError(null);
    setRoleIssue(null);
    try {
      const { data: identity, error: identityError } = await supabase.auth.getUser();
      if (!current()) return;
      if (identityError || identity.user?.id !== userId) throw new Error('La identidad de la sesión no pudo verificarse.');
      const { data: memberships, error } = await supabase.from('memberships')
        .select('institution_id, role_id').eq('profile_id', userId).eq('is_active', true);
      if (!current()) return;
      if (error) throw error;
      if (!memberships?.length) {
        setRole(null); setInstitutionId(null); setRoleIssue('membership-required');
        return;
      }
      const { data: roles, error: rolesError } = await supabase.from('roles')
        .select('role_id, name').in('role_id', memberships.map(item => item.role_id));
      if (!current()) return;
      if (rolesError) throw rolesError;
      const roleNames = new Map((roles ?? []).map(item => [item.role_id, item.name]));
      const { data: institutions, error: institutionError } = await supabase.from('institutions')
        .select('institution_id, slug, is_active').in('institution_id', memberships.map(item => item.institution_id));
      if (!current()) return;
      if (institutionError) throw institutionError;
      if (!institutions?.length) throw new Error('No se pudo verificar la institución asignada.');
      const assigned = resolveAssignedAccess(memberships.map(item => {
        const institution = institutions?.find(candidate => candidate.institution_id === item.institution_id);
        return { institutionId: item.institution_id, slug: institution?.slug ?? '',
          role: roleNames.get(item.role_id) ?? null, active: institution?.is_active === true };
      }), context);
      switch (assigned.status) {
        case 'unassigned':
          setRole(null); setInstitutionId(null); setRoleIssue('membership-required');
          return;
        case 'verification-failed':
          throw new Error('No se pudo verificar el rol institucional asignado.');
        case 'authorized':
          setRole(workspaceAuthRole(assigned.role)); setInstitutionId(assigned.institutionId);
          break;
        default: { const exhaustive: never = assigned; return exhaustive; }
      }
      if (!MFA_ENABLED || readSessionValue('auth-login-method') === 'password') {
        setMfaEnrollmentRequired(false);
        return;
      }
      const { data: enrollmentRequired, error: mfaError } = await supabase.rpc('own_mfa_enrollment_required');
      if (current()) setMfaEnrollmentRequired(!mfaError && enrollmentRequired === true);
    } catch {
      if (!current()) return;
      setRole(null); setInstitutionId(null); setRoleIssue('verification-failed');
      setRoleError('No se pudo verificar tu acceso. Revisa tu conexión e intenta nuevamente.');
    }
  }, []);

  if (!loading) sessionResolvedRef.current = true;
  knownInstitution.current = institutionId ?? scope.institution ?? scope.slug ?? knownInstitution.current;
  // Adding the already-resolved institution to the URL revalidates quietly; naming another one must wait for its role.
  const sameInstitution = (!scope.institution && !scope.slug)
    || Boolean(scope.institution && institutionId && scope.institution.toLowerCase() === institutionId.toLowerCase());

  useEffect(() => {
    if (!user || loading || mfaRequired || mfaEnrollmentRequired || resolvedScope.current === scopeKey) return;
    const background = sessionResolvedRef.current && sameInstitution;
    if (!background) setLoading(true);
    const revision = roleRevision.current + 1;
    void fetchUserRoleAndTenant(user.id).finally(() => {
      if (!background && roleRevision.current === revision) setLoading(false);
    });
  }, [scopeKey, user, role, loading, mfaRequired, mfaEnrollmentRequired, fetchUserRoleAndTenant, sameInstitution]);

  useEffect(() => {
    let active = true;
    let initialSessionTask: Promise<void> | null = null;
    let sessionObserved = false;
    const reportSessionError = () => {
      if (!active) return;
      setRole(null); setInstitutionId(null); setRoleIssue('verification-failed');
      setRoleError('No se pudo validar tu acceso. Intenta nuevamente.');
    };

    let currentSessionUserId: string | null = null;
    // Another tab ended the session: leave the private area in one step instead of painting an empty panel.
    const leaveAfterRemoteSignOut = () => {
      if (ownLogout.current) return;
      const target = remoteSignOutTarget(window.location.origin, window.location.pathname, knownInstitution.current);
      if (target) window.location.replace(target);
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key?.startsWith('sb-') && event.key.endsWith('-auth-token') && event.newValue === null) leaveAfterRemoteSignOut();
    };
    const browser = window;
    browser.addEventListener('storage', onStorage);
    const applySession = async (nextSession: Session | null) => {
      const revision = ++sessionRevision.current;
      sessionUserId.current = nextSession?.user.id ?? null;
      currentSessionUserId = nextSession?.user.id ?? null;
      setRoleIssue(null);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        if (readSessionValue('auth-login-method') === 'password') {
          setMfaRequired(false);
          setMfaFactorId(null);
          setMfaChallengeId(null);
          mfaChallengeRef.current = null;
          await fetchUserRoleAndTenant(nextSession.user.id);
        } else {
          const mfaPending = await checkMfaSession(nextSession);
          if (!mfaPending) await fetchUserRoleAndTenant(nextSession.user.id);
        }
      } else {
        setRole(null);
        setRoleError(null);
        setRoleIssue(null);
        setInstitutionId(null);
        setMfaEnrollmentRequired(false);
      }
      if (active && revision === sessionRevision.current) setLoading(false);
    };

    const initializeSession = (nextSession: Session | null) => {
      if (sessionObserved) return initialSessionTask ?? Promise.resolve();
      sessionObserved = true;
      const revision = sessionRevision.current + 1;
      initialSessionTask ??= applySession(nextSession).catch(() => {
        if (revision !== sessionRevision.current) return;
        reportSessionError();
        if (active) setLoading(false);
      });
      return initialSessionTask;
    };

    void supabase.auth.getSession()
      .then(({ data: { session: currentSession }, error }) => {
        if (error) throw error;
        if (active) return initializeSession(currentSession);
      })
      .catch(() => {
        if (sessionObserved) return;
        reportSessionError();
        if (active) setLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'INITIAL_SESSION') {
        window.setTimeout(() => { if (active) void initializeSession(nextSession); }, 0);
        return;
      }
      if (event === 'SIGNED_OUT') leaveAfterRemoteSignOut();
      sessionObserved = true;
      const revision = ++sessionRevision.current;
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      // Same-account refreshes recheck access without destroying open forms.
      const backgroundRefresh = Boolean(currentSessionUserId && currentSessionUserId === nextSession?.user.id
        && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED'));
      sessionUserId.current = nextSession?.user.id ?? null;
      currentSessionUserId = nextSession?.user.id ?? null;
      if (!backgroundRefresh) {
        sessionResolvedRef.current = false;
        roleRevision.current++;
        setLoading(true);
        setRole(null);
      }
      setRoleIssue(null);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        window.setTimeout(() => {
          if (!active || sessionUserId.current !== nextSession.user.id) return;
          const passwordOnly = readSessionValue('auth-login-method') === 'password';
          if (passwordOnly) {
            setMfaRequired(false);
            setMfaFactorId(null);
            setMfaChallengeId(null);
            mfaChallengeRef.current = null;
          }
          void (passwordOnly
            ? fetchUserRoleAndTenant(nextSession.user.id)
            : checkMfaSession(nextSession).then((mfaPending) => mfaPending ? undefined : fetchUserRoleAndTenant(nextSession.user.id)))
            .catch(() => { if (revision === sessionRevision.current) reportSessionError(); })
            .finally(() => { if (active && revision === sessionRevision.current) setLoading(false); });
        }, 0);
      } else {
        setRole(null);
        setRoleError(null);
        setRoleIssue(null);
        setInstitutionId(null);
        setMfaEnrollmentRequired(false);
        setIsPasswordRecovery(false);
        mfaChallengeRef.current = null;
        setLoading(false);
      }
    });

    return () => {
      active = false;
      browser.removeEventListener('storage', onStorage);
      roleRevision.current++;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    writeSessionValue('auth-login-method', 'password');
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) writeSessionValue('auth-login-method', null);
    return { error };
  };

  const requestLoginLink = async (email: string) => {
    writeSessionValue('auth-login-method', 'email_totp');
    writeSessionValue('auth-landing-redirect', '1');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    });
    if (error) writeSessionValue('auth-login-method', null);
    return { error };
  };

  const loginWithGoogle = async (context: { institution?: string; slug?: string } = {}) => {
    writeSessionValue('auth-login-method', null);
    try {
      const { error } = await supabase.auth.signInWithOAuth(googleOAuthRequest(window.location.origin, context));
      return { error };
    } catch { return { error: new Error('No se pudo conectar con Google. Intenta nuevamente.') }; }
  };

  const register = registerInstitutionalAccount;

  const verifyMfa = async (code: string) => {
    if (!mfaFactorId || !mfaChallengeId) {
      return { error: new Error('No se pudo iniciar la verificación. Vuelve a iniciar sesión.') };
    }
    const { error } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: mfaChallengeId, code });
    if (!error) {
      setMfaRequired(false);
      setMfaFactorId(null);
      setMfaChallengeId(null);
      mfaChallengeRef.current = null;
      const { data: currentSession } = await supabase.auth.getSession();
      if (currentSession.session?.user) {
        setLoading(true);
        await fetchUserRoleAndTenant(currentSession.session.user.id);
        setLoading(false);
      }
    }
    return { error };
  };

  const completeMfaEnrollment = () => setMfaEnrollmentRequired(false);

  const requestPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  const logout = async () => {
    const destination = new URL(logoutDestination(currentAdminScope(window.location.search), institutionId), window.location.origin).href;
    setLogoutPending(true);
    ownLogout.current = true;
    try {
      await logoutToPublicInstitution(() => supabase.auth.signOut(), destination, () => {
        writeSessionValue('auth-login-method', null);
        setMfaRequired(false);
        setMfaEnrollmentRequired(false);
        setMfaFactorId(null);
        setMfaChallengeId(null);
        mfaChallengeRef.current = null;
        setSession(null);
        setUser(null);
        setRole(null);
        setInstitutionId(null);
        setLoading(false);
      }, target => {
        const publicUrl = new URL(target);
        setPublicLogoutTarget(publicUrl.pathname + publicUrl.search);
      });
    } finally {
      ownLogout.current = false;
      setLogoutPending(false);
    }
  };

  const scopePending = Boolean((!sessionResolvedRef.current || !sameInstitution) && user && !mfaRequired && !mfaEnrollmentRequired && resolvedScope.current !== scopeKey);
  return (
    <AuthContext.Provider value={{ user, session, role, roleError, roleIssue, institutionId, loading: loading || scopePending, login, loginWithGoogle, requestLoginLink, register, isPasswordRecovery, mfaRequired: MFA_ENABLED && mfaRequired, mfaEnrollmentRequired: MFA_ENABLED && mfaEnrollmentRequired, completeMfaEnrollment, mfaChallengeReady: Boolean(mfaChallengeId), verifyMfa, requestPasswordReset, updatePassword, logout }}>
      {logoutPending || publicLogoutTarget ? null : children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
