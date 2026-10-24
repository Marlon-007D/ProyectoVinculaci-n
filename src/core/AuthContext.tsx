import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  roleError: string | null;
  institutionId: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ error: Error | null }>;
  requestLoginLink: (email: string) => Promise<{ error: Error | null }>;
  register: (email: string, password: string, firstName: string, lastName: string) => Promise<{ error: Error | null; confirmationRequired: boolean; existingAccount: boolean }>;
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
  const sessionRef = useRef<Session | null>(null);
  const generationRef = useRef(0);
  const revalidateMfaRef = useRef<() => Promise<void>>(async () => {});
  const revalidateRoleRef = useRef<() => Promise<void>>(async () => {});
  const assuranceLevelRef = useRef<string | null>(null);
  const mfaChallengeRef = useRef<{ factorId: string; challengeId: string } | null>(null);
  const clearAuthState = () => {
    sessionRef.current = null;
    setSession(null);
    setUser(null);
    setRole(null);
    setRoleError(null);
    setInstitutionId(null);
    setMfaRequired(false);
    setMfaEnrollmentRequired(false);
    setMfaFactorId(null);
    setMfaChallengeId(null);
    setIsPasswordRecovery(false);
    assuranceLevelRef.current = null;
    mfaChallengeRef.current = null;
  };
  const sessionAssuranceLevel = (nextSession: Session) => {
    try {
      const encodedPayload = nextSession.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = encodedPayload.padEnd(encodedPayload.length + (4 - encodedPayload.length % 4) % 4, '=');
      return JSON.parse(atob(payload)).aal as string | undefined;
    } catch {
      return undefined;
    }
  };

  const checkMfaSession = async (nextSession: Session | null, isCurrent: () => boolean = () => true): Promise<boolean | null> => {
    if (!nextSession) {
      setMfaRequired(false);
      setMfaFactorId(null);
      setMfaChallengeId(null);
      mfaChallengeRef.current = null;
      return false;
    }
    const { data: mfaEnabledForAssignedUser, error: eligibilityError } = await supabase.rpc('own_mfa_enabled_for_assigned_user');
    if (!isCurrent()) return null;
    if (eligibilityError || !mfaEnabledForAssignedUser) {
      setMfaRequired(false);
      setMfaFactorId(null);
      setMfaChallengeId(null);
      mfaChallengeRef.current = null;
      return false;
    }
    const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (!isCurrent()) return null;
    assuranceLevelRef.current = assuranceError ? null : assurance.currentLevel;
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
    if (!isCurrent()) return null;
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
    if (!isCurrent()) return null;
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

  const fetchUserRoleAndTenant = async (userId: string, isCurrent: () => boolean = () => true, preserveCurrent = false) => {
    if (!isCurrent()) return false;
    if (!preserveCurrent) {
      setRole(null);
      setRoleError(null);
      setInstitutionId(null);
    }

    const { data, error } = await supabase
      .from('memberships')
      .select('institution_id, role_id')
      .eq('profile_id', userId)
      .eq('is_active', true);
    if (!isCurrent()) return false;

    if (error) {
      setRole(null);
      setInstitutionId(null);
      setRoleError('No se pudo consultar tu rol. Verifica que esté aplicada la migración de acceso de superadministrador.');
      return;
    }

    const memberships = data ?? [];
    if (memberships.length === 0) {
      setRole(null);
      setInstitutionId(null);
      setRoleError('No se encontró una membresía visible para esta cuenta. Ejecuta database/superadmin.sql en Supabase y confirma que profile_id coincida con el ID de autenticación.');
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from('roles')
      .select('role_id, name')
      .in('role_id', memberships.map((item) => item.role_id));
    if (!isCurrent()) return false;

    if (rolesError) {
      setRole(null);
      setInstitutionId(null);
      setRoleError('No se pudieron consultar los nombres de rol. Verifica los permisos de lectura de la tabla roles.');
      return;
    }

    const roleNameById = new Map((roles ?? []).map((item) => [item.role_id, item.name]));
    const requestedInstitutionId = new URLSearchParams(window.location.search).get('institution');
    const scopedMembership = memberships.find((item) => item.institution_id === requestedInstitutionId);
    const membership = memberships.find((item) => roleNameById.get(item.role_id) === 'super_admin') ?? scopedMembership ?? memberships[0];
    const assignedRole = roleNameById.get(membership.role_id) ?? null;
    setRoleError(null);
    setRole(assignedRole);
    setInstitutionId(membership?.institution_id ?? null);

    // El modo de contraseña omite TOTP; el modo correo + TOTP conserva el enrolamiento.
    if (sessionStorage.getItem('auth-login-method') === 'password') {
      setMfaEnrollmentRequired(false);
      return;
    }

    // Solo se pide configurar TOTP cuando el flujo de asignación dejó la marca pendiente.
    const { data: enrollmentRequired, error: mfaStatusError } = await supabase.rpc('own_mfa_enrollment_required');
    if (!isCurrent()) return false;
    setMfaEnrollmentRequired(!mfaStatusError && enrollmentRequired === true);
    return Boolean(assignedRole);
  };

  useEffect(() => {
    let active = true;
    let initialSessionTask: Promise<void> | null = null;
    let sessionTask: Promise<void> = Promise.resolve();
    let pendingInitialSession: { session: Session | null; event: string; generation: number; identityChanged: boolean } | null = null;

    const isCurrent = (generation: number) => active && generationRef.current === generation;
    const clearSessionState = clearAuthState;
    const processSession = (nextSession: Session | null, event: string, initial: boolean, eventGeneration: number, identityChanged: boolean) =>
      applySession(nextSession, event, initial, eventGeneration, identityChanged).catch(() => {
        if (isCurrent(eventGeneration)) setLoading(false);
      });

    const applySession = async (nextSession: Session | null, event: string, initial = false, eventGeneration = generationRef.current, identityChanged = false) => {
      if (!isCurrent(eventGeneration)) return;
      const currentUserId = sessionRef.current?.user.id ?? null;
      const nextUserId = nextSession?.user.id ?? null;
      if (event === 'SIGNED_OUT' || !nextSession) {
        clearSessionState();
        setLoading(false);
        return;
      }
      const sameUser = !identityChanged && currentUserId !== null && currentUserId === nextUserId;
      let generation = eventGeneration;
      if (!sameUser && !identityChanged) {
        generationRef.current += 1;
        generation = generationRef.current;
        clearSessionState();
        setLoading(true);
      }
      if (!isCurrent(generation)) return;
      sessionRef.current = nextSession;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);

      if (sameUser && !initial) {
        const nextAssuranceLevel = sessionAssuranceLevel(nextSession);
        if (event === 'MFA_CHALLENGE_VERIFIED' || event === 'MFA_STATE_CHANGED' || (nextAssuranceLevel && assuranceLevelRef.current && nextAssuranceLevel !== assuranceLevelRef.current)) {
          await checkMfaSession(nextSession, () => isCurrent(generation));
        }
        if (event === 'ROLE_REVALIDATE') await fetchUserRoleAndTenant(nextSession.user.id, () => isCurrent(generation), true);
        return;
      }

      if (nextSession?.user) {
        if (sessionStorage.getItem('auth-login-method') === 'password') {
          setMfaRequired(false);
          setMfaFactorId(null);
          setMfaChallengeId(null);
          mfaChallengeRef.current = null;
          await fetchUserRoleAndTenant(nextSession.user.id, () => isCurrent(generation));
        } else {
          const mfaPending = await checkMfaSession(nextSession, () => isCurrent(generation));
          if (mfaPending === false) await fetchUserRoleAndTenant(nextSession.user.id, () => isCurrent(generation));
        }
      }
      if (isCurrent(generation)) setLoading(false);
    };

    const initializeSession = (nextSession: Session | null) => {
      if (!initialSessionTask) {
        const initial = pendingInitialSession ?? { session: nextSession, event: 'INITIAL_SESSION', generation: generationRef.current, identityChanged: false };
        pendingInitialSession = null;
        initialSessionTask = processSession(initial.session, initial.event, true, initial.generation, initial.identityChanged);
        sessionTask = initialSessionTask;
      }
      return initialSessionTask;
    };

    const enqueueSession = (nextSession: Session | null, event: string, eventGeneration = generationRef.current, identityChanged = false) => {
      if (!initialSessionTask) {
        pendingInitialSession = { session: nextSession, event, generation: eventGeneration, identityChanged };
        return Promise.resolve();
      }
      sessionTask = sessionTask.then(() => processSession(nextSession, event, false, eventGeneration, identityChanged));
      return sessionTask;
    };

    revalidateMfaRef.current = () => {
      const currentSession = sessionRef.current;
      if (currentSession) return enqueueSession(currentSession, 'MFA_STATE_CHANGED');
      return Promise.resolve();
    };
    revalidateRoleRef.current = () => {
      const currentSession = sessionRef.current;
      if (currentSession) return enqueueSession(currentSession, 'ROLE_REVALIDATE');
      return Promise.resolve();
    };

    void supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => {
        if (active) void initializeSession(pendingInitialSession?.session ?? currentSession);
      })
      .catch(() => {
        if (active) void initializeSession(pendingInitialSession?.session ?? null);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      if (event === 'INITIAL_SESSION') {
        if (!initialSessionTask) {
          pendingInitialSession = { session: nextSession, event, generation: generationRef.current, identityChanged: false };
          void initializeSession(nextSession);
        } else {
          enqueueSession(nextSession, event);
        }
        return;
      }
      const currentUserId = sessionRef.current?.user.id ?? null;
      const nextUserId = nextSession?.user.id ?? null;
      const identityChanged = event === 'SIGNED_OUT' || currentUserId !== nextUserId;
      if (identityChanged) {
        generationRef.current += 1;
        clearSessionState();
        if (nextSession) {
          sessionRef.current = nextSession;
          setLoading(true);
        }
        else setLoading(false);
      }
      enqueueSession(nextSession, event, generationRef.current, identityChanged);
    });

    return () => {
      active = false;
      generationRef.current += 1;
      revalidateMfaRef.current = async () => {};
      revalidateRoleRef.current = async () => {};
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

  const register = async (email: string, password: string, firstName: string, lastName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { first_name: firstName.trim(), last_name: lastName.trim() },
      },
    });
    if (!error) {
      if (data.session) await supabase.auth.signOut();
      return { error: null, confirmationRequired: !data.session, existingAccount: false };
    }

    // A retry can encounter an account created by a previous request even when
    // the confirmation email request returned an error. Check using the
    // password the person just entered before reporting registration failure.
    const { data: priorSession } = await supabase.auth.getSession();
    if (priorSession.session) return { error, confirmationRequired: false, existingAccount: false };
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (!signInError) {
      await supabase.auth.signOut();
      return { error: null, confirmationRequired: false, existingAccount: true };
    }
    if (signInError.code === 'email_not_confirmed') {
      return { error: null, confirmationRequired: true, existingAccount: true };
    }
    return { error, confirmationRequired: false, existingAccount: false };
  };

  const verifyMfa = async (code: string) => {
    if (!mfaFactorId || !mfaChallengeId) {
      return { error: new Error('No se pudo iniciar la verificación. Vuelve a iniciar sesión.') };
    }
    const generation = generationRef.current;
    const { error } = await supabase.auth.mfa.verify({ factorId: mfaFactorId, challengeId: mfaChallengeId, code });
    if (!error && generationRef.current === generation) {
      setMfaRequired(false);
      setMfaFactorId(null);
      setMfaChallengeId(null);
      mfaChallengeRef.current = null;
      const { data: currentSession } = await supabase.auth.getSession();
      if (generationRef.current === generation && currentSession.session?.user.id === sessionRef.current?.user.id) {
        await revalidateRoleRef.current();
      }
    }
    return { error };
  };

  const completeMfaEnrollment = () => {
    setMfaEnrollmentRequired(false);
    void revalidateMfaRef.current();
  };

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
    generationRef.current += 1;
    clearAuthState();
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
