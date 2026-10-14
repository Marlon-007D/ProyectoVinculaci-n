import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';

export interface Institution {
  institution_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  role: string;
  projects_enabled: boolean;
  enabled_modules?: string[];
}
interface TenantContextType {
  activeInstitution: Institution | null;
  institutions: Institution[];
  setActiveInstitution: (institution: Institution | null) => void;
  loadingTenant: boolean;
  tenantError: string | null;
  reloadInstitutions: () => void;
}
const TenantContext = createContext<TenantContextType | undefined>(undefined);
export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, role, loading, mfaRequired } = useAuth();
  const [state, setState] = useState<{ owner: string; institutions: Institution[]; error: string | null } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!user || loading || mfaRequired) return;
    let cancelled = false;

    const loadInstitutions = async () => {
      // La RPC entrega todas las instituciones al superadmin global y solo las
      // membresías propias al resto de administradores.
      try {
        const { data, error } = await supabase.rpc('project_institutions');
        if (!error && Array.isArray(data) && data.length > 0) {
          if (!cancelled) setState({ owner: user.id, institutions: data, error: null });
          return;
        }
      } catch {
        // Si la RPC falla, no se infieren instituciones desde la tabla completa.
      }

      try {
        if (role === 'super_admin') {
          const { data, error } = await supabase
            .from('institutions')
            .select('institution_id, name, slug, is_active')
            .eq('is_active', true);
          if (!error && data) {
            const institutions: Institution[] = data.map((item) => ({ ...item, role, projects_enabled: true }));
            if (!cancelled) setState({ owner: user.id, institutions, error: null });
            return;
          }
        } else {
          const { data, error } = await supabase
            .from('memberships')
            .select('institution_id, institutions!fk_memberships_institution(institution_id, name, slug, is_active), roles!fk_memberships_role(name)')
            .eq('profile_id', user.id);

          if (!error && data) {
            const institutions: Institution[] = data.flatMap((membership: any) => {
              const institution = membership.institutions;
              const assignedRole = membership.roles?.name;
              if (!institution?.is_active || !assignedRole) return [];
              return [{ ...institution, role: assignedRole, projects_enabled: true }];
            });
            if (institutions.length > 0) {
              if (!cancelled) setState({ owner: user.id, institutions, error: null });
              return;
            }
          }
        }
      } catch {
        // Reportar el error de asignación debajo.
      }

      if (!cancelled) {
        setState({
          owner: user.id,
          institutions: [],
          error: 'No se pudieron cargar las instituciones asignadas a esta cuenta. Verifica la función project_institutions y sus permisos en Supabase.',
        });
      }
    };

    void loadInstitutions();
    return () => { cancelled = true; };
  }, [user, role, loading, mfaRequired, revision]);
  const current = !loading && user && state?.owner === user.id ? state : null;
  const institutions = current?.institutions ?? [];
  const activeInstitution = institutions.find(item => item.institution_id === selectedId) ?? institutions[0] ?? null;
  return <TenantContext.Provider value={{
    institutions, activeInstitution, loadingTenant: loading || mfaRequired || Boolean(user && !current),
    tenantError: current?.error ?? null,
    setActiveInstitution: institution => setSelectedId(institution?.institution_id ?? null),
    reloadInstitutions: () => { setState(null); setRevision(value => value + 1); },
  }}>{children}</TenantContext.Provider>;
}
export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant debe usarse dentro de TenantProvider');
  return context;
}
