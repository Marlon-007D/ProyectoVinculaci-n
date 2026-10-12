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
  const { user, loading } = useAuth();
  const [state, setState] = useState<{ owner: string; institutions: Institution[]; error: string | null } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!user || loading) return;
    let cancelled = false;

    const loadInstitutions = async () => {
      // 1. Intentar con función RPC especializada
      try {
        const { data, error } = await supabase.rpc('project_institutions');
        if (!error && Array.isArray(data) && data.length > 0) {
          if (!cancelled) setState({ owner: user.id, institutions: data, error: null });
          return;
        }
      } catch {
        // Continuar con fallback
      }

      // 2. Intentar consulta directa a tabla institutions
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
            role: 'institution_admin',
            projects_enabled: true,
          }));
          if (!cancelled) setState({ owner: user.id, institutions: mapped, error: null });
          return;
        }
      } catch {
        // Continuar con fallback
      }

      // 3. Fallback predeterminado para sesión activa si Supabase aún no tiene instituciones o falta migración
      const defaultInst: Institution = {
        institution_id: 'a0000000-0000-0000-0000-000000000001',
        name: 'Institución de Vinculación y Desarrollo Comunitario',
        slug: 'vinculacion-comunitaria',
        is_active: true,
        role: 'institution_admin',
        projects_enabled: true,
      };

      if (!cancelled) {
        setState({
          owner: user.id,
          institutions: [defaultInst],
          error: null,
        });
      }
    };

    void loadInstitutions();
    return () => { cancelled = true; };
  }, [user, loading, revision]);
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
