import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getUserInstitutions } from './institutionService';
import { useAuth } from './AuthContext';

export const INSTITUTION_MODULE_NAMES = ['inicio', 'projects', 'dece', 'simuladores', 'portal'] as const;
export type InstitutionModuleName = (typeof INSTITUTION_MODULE_NAMES)[number];
export type InstitutionModulePermissions = Record<InstitutionModuleName, boolean>;


export interface Institution {
  institution_id: string;
  name: string;
  slug: string;
  is_active: boolean;
  role: string;
  projects_enabled: boolean;
  enabled_modules: InstitutionModuleName[];
  module_permissions: InstitutionModulePermissions;
}
interface TenantContextType {
  activeInstitution: Institution | null;
  institutions: Institution[];
  setActiveInstitution: (institution: Institution | null) => void;
  loadingTenant: boolean;
  tenantError: string | null;
  modulePermissionError: string | null;
  hasModuleAccess: (moduleName: InstitutionModuleName) => boolean;
  reloadInstitutions: () => void;
}
const TenantContext = createContext<TenantContextType | undefined>(undefined);
export function TenantProvider({ children }: { children: ReactNode }) {
  const { user, role, loading, mfaRequired } = useAuth();
  const [state, setState] = useState<{
    owner: string;
    institutions: Institution[];
    error: string | null;
    modulePermissionError: string | null;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!user || loading || mfaRequired) return;
    let cancelled = false;

    const loadInstitutions = async () => {
      try {
        const institutions = await getUserInstitutions(user.id);
        if (!cancelled) setState({ owner: user.id, institutions, error: null, modulePermissionError: null });
      } catch (cause) {
        if (!cancelled) setState({ owner: user.id, institutions: [], modulePermissionError: null, error:
          cause instanceof Error?cause.message:'No se pudieron consultar tus instituciones y permisos con esta sesión. Comprueba tu acceso e inténtalo de nuevo.' });
      }
    };

    void loadInstitutions();
    return () => { cancelled = true; };
  }, [user, role, loading, mfaRequired, revision]);
  const current = !loading && user && state?.owner === user.id ? state : null;
  const institutions = current?.institutions ?? [];
  const activeInstitution = institutions.find(item => item.institution_id === selectedId) ?? institutions[0] ?? null;
  const hasModuleAccess = (moduleName: InstitutionModuleName) => activeInstitution?.module_permissions[moduleName] === true;
  return <TenantContext.Provider value={{
    institutions, activeInstitution, loadingTenant: loading || mfaRequired || Boolean(user && !current),
    tenantError: current?.error ?? null,
    modulePermissionError: current?.modulePermissionError ?? null,
    hasModuleAccess,
    setActiveInstitution: institution => setSelectedId(institution?.institution_id ?? null),
    reloadInstitutions: () => { setState(null); setRevision(value => value + 1); },
  }}>{children}</TenantContext.Provider>;
}
export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant debe usarse dentro de TenantProvider');
  return context;
}
