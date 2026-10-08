import React, { createContext, useContext, useEffect, useState } from 'react';
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

  const fetchUserRoleAndTenant = async (userId: string) => {
    setRole(null);
    setRoleError(null);
    setInstitutionId(null);

    const { data, error } = await supabase
      .from('memberships')
      .select('institution_id, role_id')
      .eq('profile_id', userId);

    if (error) {
      setRoleError('No se pudo consultar tu rol. Verifica que esté aplicada la migración de acceso de superadministrador.');
      return;
    }

    const memberships = data ?? [];
    if (memberships.length === 0) {
      setRoleError('No se encontró una membresía visible para esta cuenta. Ejecuta database/superadmin.sql en Supabase y confirma que profile_id coincida con el ID de autenticación.');
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
    const membership = memberships.find((item) => roleNameById.get(item.role_id) === 'super_admin') ?? memberships[0];
    setRole(roleNameById.get(membership.role_id) ?? null);
    setInstitutionId(membership?.institution_id ?? null);
  };

  useEffect(() => {
    let active = true;

    const applySession = async (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        await fetchUserRoleAndTenant(nextSession.user.id);
      } else {
        setRole(null);
        setRoleError(null);
        setInstitutionId(null);
      }
      if (active) setLoading(false);
    };

    void supabase.auth.getSession()
      .then(({ data: { session: currentSession } }) => applySession(currentSession))
      .catch(() => {
        if (active) setLoading(false);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setLoading(true);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        window.setTimeout(() => {
          void fetchUserRoleAndTenant(nextSession.user.id).finally(() => {
            if (active) setLoading(false);
          });
        }, 0);
      } else {
        setRole(null);
        setRoleError(null);
        setInstitutionId(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    return { error };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, roleError, institutionId, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
};
