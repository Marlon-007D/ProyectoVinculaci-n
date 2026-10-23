import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import { registerInstitutionalAccount } from './auth/registerInstitutionalAccount';
import { institutionMatches } from './auth/loginAccess';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  roleError: string | null;
  institutionId: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ error: Error | null }>;
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
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaEnrollmentRequired, setMfaEnrollmentRequired] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const mfaChallengeRef = useRef<{ factorId: string; challengeId: string } | null>(null);

  const checkMfaSession = async (nextSession: Session | null): Promise<boolean> => {
    if (!nextSession) {
      setMfaRequired(false);
      setMfaFactorId(null);
      setMfaChallengeId(null);
      mfaChallengeRef.current = null;
      return false;
    }
    const { data: mfaEnabledForAssignedUser, error: eligibilityError } = await supabase.rpc('own_mfa_enabled_for_assigned_user');
    if (eligibilityError || !mfaEnabledForAssignedUser) {
      setMfaRequired(false);
      setMfaFactorId(null);
      setMfaChallengeId(null);
      mfaChallengeRef.current = null;
      return false;
    }
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
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

  const fetchUserRoleAndTenant = async (userId: string) => {
    setRole(null);
    setRoleError(null);
    setInstitutionId(null);

    const { data, error } = await supabase
      .from('memberships')
      .select('institution_id, role_id')
      .eq('profile_id', userId)
      .eq('is_active', true);

    if (error) {
      setRoleError('No se pudo consultar tu rol. Verifica que esté aplicada la migración de acceso de superadministrador.');
      return;
    }

    const memberships = data ?? [];
    if (memberships.length === 0) {
      setRoleError('Tu cuenta aún no tiene una membresía activa. Si acabas de registrarte, espera la aprobación de un administrador de tu institución.');
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('role_id, name')
      .in('role_id', memberships.map((item) => item.role_id));

    if (rolesError) {
      setRoleError('No se pudieron consultar los nombres de rol. Verifica los permisos de lectura de la tabla roles.');
      return;
    }

    const roleNameById = new Map((roles ?? []).map((item) => [item.role_id, item.name]));
    const requestedInstitutionId = new URLSearchParams(window.location.search).get('institution');
    const loginSlug = /^\/([^/]+)\/login\/?$/.exec(window.location.pathname)?.[1];
    const references = [loginSlug, requestedInstitutionId].filter((value): value is string => Boolean(value));
    let scopedMembership = memberships.find((item) => references.includes(item.institution_id));
    if ((!scopedMembership || loginSlug) && references.length) {
      const { data: assignedInstitutions } = await supabase.from('institutions')
        .select('institution_id, slug').in('institution_id', memberships.map(item => item.institution_id));
      const institution = references.flatMap(reference =>
        (assignedInstitutions ?? []).filter(item => institutionMatches(item, reference)))[0];
      scopedMembership = memberships.find(item => item.institution_id === institution?.institution_id) ?? scopedMembership;
    }
    const membership = memberships.find((item) => roleNameById.get(item.role_id) === 'super_admin') ?? scopedMembership ?? memberships[0];
    const assignedRole = roleNameById.get(membership.role_id) ?? null;
    setRole(assignedRole);
    setInstitutionId(membership?.institution_id ?? null);

    // El modo de contraseña omite TOTP; el modo correo + TOTP conserva el enrolamiento.
    if (sessionStorage.getItem('auth-login-method') === 'password') {
      setMfaEnrollmentRequired(false);
      return;
    }

    // Solo se pide configurar TOTP cuando el flujo de asignación dejó la marca pendiente.
    const { data: enrollmentRequired, error: mfaStatusError } = await supabase.rpc('own_mfa_enrollment_required');
    setMfaEnrollmentRequired(!mfaStatusError && enrollmentRequired === true);
  };

  useEffect(() => {
    let active = true;
    let initialSessionTask: Promise<void> | null = null;

    const applySession = async (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        if (sessionStorage.getItem('auth-login-method') === 'password') {
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
        setInstitutionId(null);
        setMfaEnrollmentRequired(false);
      }
      if (active) setLoading(false);
    };

    const initializeSession = (nextSession: Session | null) => {
      initialSessionTask ??= applySession(nextSession);
      return initialSessionTask;
    };

    void supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        if (active) void initializeSession(currentSession);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'INITIAL_SESSION') {
        void initializeSession(nextSession);
        return;
      }
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      setLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        window.setTimeout(() => {
          const passwordOnly = sessionStorage.getItem('auth-login-method') === 'password';
          if (passwordOnly) {
            setMfaRequired(false);
            setMfaFactorId(null);
            setMfaChallengeId(null);
            mfaChallengeRef.current = null;
          }
          void (passwordOnly
            ? fetchUserRoleAndTenant(nextSession.user.id)
            : checkMfaSession(nextSession).then((mfaPending) => mfaPending ? undefined : fetchUserRoleAndTenant(nextSession.user.id)))
            .finally(() => { if (active) setLoading(false); });
        }, 0);
      } else {
        setRole(null);
        setRoleError(null);
        setInstitutionId(null);
        setMfaEnrollmentRequired(false);
        setIsPasswordRecovery(false);
        mfaChallengeRef.current = null;
        setLoading(false);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    sessionStorage.setItem('auth-login-method', 'password');
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    if (error) sessionStorage.removeItem('auth-login-method');
    return { error };
  };

  const requestLoginLink = async (email: string) => {
    sessionStorage.setItem('auth-login-method', 'email_totp');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    });
    if (error) sessionStorage.removeItem('auth-login-method');
    return { error };
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
    await supabase.auth.signOut();
    sessionStorage.removeItem('auth-login-method');
    setMfaRequired(false);
    setMfaEnrollmentRequired(false);
    setMfaFactorId(null);
    setMfaChallengeId(null);
      mfaChallengeRef.current = null;
  };

  return (
    <AuthContext.Provider value={{ user, session, role, roleError, institutionId, loading, login, requestLoginLink, register, isPasswordRecovery, mfaRequired, mfaEnrollmentRequired, completeMfaEnrollment, mfaChallengeReady: Boolean(mfaChallengeId), verifyMfa, requestPasswordReset, updatePassword, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
