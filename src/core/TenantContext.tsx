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
        // Continuar con fallback
      }

      // Compatibilidad con instalaciones que aún no aplican la RPC. RLS limita
      // esta consulta a los tenants visibles para la sesión.
      try {
        const { data: instList, error: instError } = await supabase
          .from('institutions')
          .select('institution_id, name, slug, is_active')
          .eq('is_active', true);

        if (!instError && instList && instList.length > 0) {
          const mapped: Institution[] = instList.map(inst => ({
            institution_id: inst.institution_id,
            name: inst.name,
            slug: inst.slug,
            is_active: inst.is_active,
            role: role ?? 'institution_admin',
            projects_enabled: true,
          }));
          if (!cancelled) setState({ owner: user.id, institutions: mapped, error: null });
          return;
        }
      } catch {
        // Continuar con fallback
      }

      if (!cancelled) {
        setState({
          owner: user.id,
          institutions: [],
          error: 'No hay instituciones disponibles para esta cuenta. Verifica su membresía y las políticas RLS en Supabase.',
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
    institutions, activeInstitution, loadingTenant: loading || Boolean(user && !current),
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
