import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';

export const INSTITUTION_MODULE_NAMES = ['inicio', 'projects', 'dece', 'simuladores', 'portal'] as const;
export type InstitutionModuleName = (typeof INSTITUTION_MODULE_NAMES)[number];
export type InstitutionModulePermissions = Record<InstitutionModuleName, boolean>;

const noModulePermissions = (): InstitutionModulePermissions => ({
  inicio: false,
  projects: false,
  dece: false,
  simuladores: false,
  portal: false,
});

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
      const attachEnabledModules = async (items: Institution[]) => {
        const { data, error } = await supabase.rpc('get_accessible_module_settings');
        if (error || !Array.isArray(data)) {
          return {
            institutions: items.map((institution) => ({
              ...institution,
              enabled_modules: [],
              module_permissions: noModulePermissions(),
              projects_enabled: false,
            })),
            error: 'No se pudieron verificar los permisos de módulos. Aplica la migración de módulos por institución e inténtalo de nuevo.',
          };
        }

        const institutions = items.map((institution) => {
          const module_permissions = noModulePermissions();
          data.forEach((setting: { institution_id: string; module_name: string; is_enabled: boolean }) => {
            if (setting.institution_id === institution.institution_id
              && INSTITUTION_MODULE_NAMES.includes(setting.module_name as InstitutionModuleName)) {
              module_permissions[setting.module_name as InstitutionModuleName] = setting.is_enabled;
            }
          });
          const enabled_modules = INSTITUTION_MODULE_NAMES.filter((moduleName) => module_permissions[moduleName]);
          return {
            ...institution,
            module_permissions,
            enabled_modules,
            projects_enabled: module_permissions.projects,
          };
        });
        return { institutions, error: null };
      };

      try {
        if (role === 'super_admin') {
          const { data, error } = await supabase
            .from('institutions')
            .select('institution_id, name, slug, is_active')
            .eq('is_active', true);
          if (!error && data) {
            const institutions = data.map((item) => ({ ...item, role, projects_enabled: true })) as Institution[];
            const result = await attachEnabledModules(institutions);
            if (!cancelled) setState({ owner: user.id, institutions: result.institutions, error: null, modulePermissionError: result.error });
            return;
          }
        } else {
          const { data, error } = await supabase
            .from('memberships')
            .select('institution_id, institutions!fk_memberships_institution(institution_id, name, slug, is_active), roles!fk_memberships_role(name)')
            .eq('profile_id', user.id)
            .eq('is_active', true);

          if (!error && data) {
            const institutions: Institution[] = data.flatMap((membership: any) => {
              const institution = membership.institutions;
              const assignedRole = membership.roles?.name;
              if (!institution?.is_active || !assignedRole) return [];
              return [{ ...institution, role: assignedRole, projects_enabled: true } as Institution];
            });
            if (institutions.length > 0) {
              const result = await attachEnabledModules(institutions);
              if (!cancelled) setState({ owner: user.id, institutions: result.institutions, error: null, modulePermissionError: result.error });
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
          error: 'No se pudieron cargar las instituciones asignadas a esta cuenta. Verifica las membresias y sus permisos en Supabase.',
          modulePermissionError: null,
        });
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
