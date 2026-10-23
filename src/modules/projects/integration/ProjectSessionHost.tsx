import { Activity, lazy, Suspense, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../../core/AuthContext';
import { useTenant } from '../../../core/TenantContext';
import { ModuleBoundary } from './ModuleBoundary';

const Workspace = lazy(() => import('../ProjectsWorkspace').then(module => ({ default: module.ProjectsWorkspace })));

export function isPrivateProjectsPath(pathname: string, search: string) {
  return /^\/(?:panel\/)?proyectos(?:\/|$)/.test(pathname)
    && !new URLSearchParams(search).has('transparency');
}

// Activity preserves forms and component state in memory while pausing hidden effects.
// Changing account/institution or losing access discards the previous workspace.
export function ProjectSessionHost() {
  const { user, mfaRequired, mfaEnrollmentRequired } = useAuth();
  const tenant = useTenant();
  const location = useLocation();
  const active = isPrivateProjectsPath(location.pathname, location.search);
  const scope = `${user?.id ?? ''}:${tenant.activeInstitution?.institution_id ?? ''}`;
  return <Session key={scope} active={active} retain={Boolean(user && tenant.activeInstitution && !mfaRequired && !mfaEnrollmentRequired && !tenant.modulePermissionError && tenant.hasModuleAccess('projects'))} />;
}

function Session({ active, retain }: { active: boolean; retain: boolean }) {
  const [visited, setVisited] = useState(false);
  useEffect(() => { setVisited(old => retain && (old || active)); }, [active, retain]);
  if (!active && !(retain && visited)) return null;
  return <Activity mode={active ? 'visible' : 'hidden'}><ModuleBoundary><Suspense fallback={<p role="status">Cargando proyectos…</p>}><Workspace /></Suspense></ModuleBoundary></Activity>;
}
