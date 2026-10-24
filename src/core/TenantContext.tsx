import { resolveAssignedAccess } from '../modules/admin/auth/accessPolicy';
import { useLocation } from 'react-router-dom';
import { isSuperAdmin } from './auth/superAdmin';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './AuthContext';
import { institutionContextFromSearch, matchesInstitution } from '../features/auth/utils/googleOAuth';

export const INSTITUTION_MODULE_NAMES = ['inicio', 'projects', 'dece', 'simuladores', 'portal'] as const;
export type InstitutionModuleName = (typeof INSTITUTION_MODULE_NAMES)[number];
export type InstitutionModulePermissions = Record<InstitutionModuleName, boolean>;

interface TenantMembership {
  institution_id: string;
  institutions: Pick<Institution, 'institution_id' | 'name' | 'slug' | 'is_active'> | null;
  roles: { name: string } | null;
}

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
  const location = useLocation();
  const { user, role, loading, mfaRequired } = useAuth();
  const activeUserId = useRef(user?.id ?? null);
  const activeRequestKey = useRef<string | null>(null);
  const startedRequestKey = useRef<string | null>(null);
  activeUserId.current = user?.id ?? null;
  const [state, setState] = useState<{
    owner: string;
    requestKey: string;
    institutions: Institution[];
    error: string | null;
    modulePermissionError: string | null;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!user || loading || mfaRequired) {
      activeRequestKey.current = null;
      startedRequestKey.current = null;
      return;
    }
    const requestKey = `${user.id}:${role ?? ''}:${revision}`;
    activeRequestKey.current = requestKey;
    if (startedRequestKey.current === requestKey) return;
    startedRequestKey.current = requestKey;

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
        if (isSuperAdmin(role)) {
          const { data, error } = await supabase
            .from('institutions')
            .select('institution_id, name, slug, is_active')
            .eq('is_active', true);
          if (!error && data) {
            const institutions: Institution[] = data.map((item) => ({ ...item, role: 'super_admin', projects_enabled: false, enabled_modules: [], module_permissions: noModulePermissions() }));
            const result = await attachEnabledModules(institutions);
            if (activeUserId.current === user.id && activeRequestKey.current === requestKey) setState({ owner: user.id, requestKey, institutions: result.institutions, error: null, modulePermissionError: result.error });
            return;
          }
        } else {
          const { data, error } = await supabase
            .from('memberships')
            .select('institution_id, institutions:institutions!fk_memberships_institution(institution_id, name, slug, is_active), roles:roles!fk_memberships_role(name)')
            .eq('profile_id', user.id)
            .eq('is_active', true)
            .overrideTypes<TenantMembership[], { merge: false }>();

          if (!error && data) {
            const institutions: Institution[] = data.flatMap((membership) => {
              const institution = membership.institutions;
              const assignedRole = membership.roles?.name;
              if (!institution?.is_active || !assignedRole) return [];
              const access = resolveAssignedAccess([{ institutionId: institution.institution_id, slug: institution.slug, role: assignedRole, active: true }], {});
              if (access.status !== 'authorized') return [];
              return [{ ...institution, role: assignedRole, projects_enabled: false, enabled_modules: [], module_permissions: noModulePermissions() }];
            });
            if (institutions.length > 0) {
              const result = await attachEnabledModules(institutions);
              if (activeUserId.current === user.id && activeRequestKey.current === requestKey) setState({ owner: user.id, requestKey, institutions: result.institutions, error: null, modulePermissionError: result.error });
              return;
            }
          }
        }
      } catch {
        // Reportar el error de asignación debajo.
      }

      if (activeUserId.current === user.id && activeRequestKey.current === requestKey) {
        setState({
          owner: user.id,
          requestKey,
          institutions: [],
          error: 'No se pudieron cargar las instituciones asignadas a esta cuenta. Verifica las membresias y sus permisos en Supabase.',
          modulePermissionError: null,
        });
      }
    };

    void loadInstitutions();
  }, [user, role, loading, mfaRequired, revision]);
  const expectedKey = user ? `${user.id}:${role ?? ''}:${revision}` : null;
  const current = !loading && user && state?.owner === user.id && state.requestKey === expectedKey ? state : null;
  const institutions = current?.institutions ?? [];
  const context = institutionContextFromSearch(location.search);
  const requestedInstitutionId = context.institution;
  const requestedSlug = context.slug;
  const requestedInstitution = institutions.find(item => matchesInstitution(context, item));
  useEffect(() => {
    if ((requestedInstitutionId || requestedSlug) && requestedInstitution)
      setSelectedId(requestedInstitution.institution_id);
  }, [requestedInstitutionId, requestedSlug, requestedInstitution]);
  const activeInstitution = requestedInstitutionId || requestedSlug
    ? requestedInstitution ?? null
    : institutions.find(item => item.institution_id === selectedId) ?? institutions[0] ?? null;
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
