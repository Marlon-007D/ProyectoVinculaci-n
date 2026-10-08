import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: string | null;
  institutionId: string | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<{ error: any }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchUserRoleAndTenant = async (userId: string) => {
    setRole(null);
    setInstitutionId(null);
    // Consultar membresía para conocer el rol e institución vinculada
    const { data, error } = await supabase
      .from('memberships')
      .select('role, institution_id')
      .eq('user_id', userId)
      .single();

    if (!error && data) {
      setRole(data.role);
      setInstitutionId(data.institution_id);
    } else {
      // Si no existe membresía específica, comprobar si es superadmin global
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_superadmin')
        .eq('id', userId)
        .single();

      if (profile?.is_superadmin) {
        setRole('superadmin');
      }
    }
  };

  useEffect(() => {
    // Cargar sesión inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        await fetchUserRoleAndTenant(session.user.id);
      }
      setLoading(false);
    }).catch(() => setLoading(false));

    // Escuchar cambios de estado en la autenticación
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setLoading(true);
        void fetchUserRoleAndTenant(session.user.id).finally(() => setLoading(false));
      } else {
        setRole(null);
        setInstitutionId(null);
        setLoading(false);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
    return { error };
  };

  const logout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, role, institutionId, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe ser usado dentro de AuthProvider');
  return context;
};
