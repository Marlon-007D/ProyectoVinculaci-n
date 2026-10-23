import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../core/AuthContext';
import { useTenant } from '../../core/TenantContext';
import { canonicalRole } from '../../core/auth/institutionalRoles';
import { PrivateWorkspace } from '../site/components/Layout/PrivateWorkspace';
import { InstitutionSessionLayout } from '../site/components/Layout/InstitutionSessionLayout';
import { InstitutionProvider } from '../site/context/InstitutionContext';

import adminStyles from '../admin/AdminRoutes.module.css';
import { ProjectsDashboard } from './ProjectsDashboard';
import { PortalEditor } from '../portal-editor/PortalEditor';
import { moduleClass as css } from './projectStyles';

export function ProjectsWorkspace({ mode = 'projects' }: { mode?: 'projects' | 'portal' }) {
  const auth = useAuth();
  const tenant = useTenant();
  const location = useLocation();
  const institution = tenant.activeInstitution;
  useEffect(() => {
    const reload = () => tenant.reloadInstitutions();
    window.addEventListener('projects-institutions-changed', reload);
    return () => window.removeEventListener('projects-institutions-changed', reload);
  }, [tenant.reloadInstitutions]);

  if (auth.loading) return <main className={adminStyles.page} role="status">Comprobando acceso institucional…</main>;
  if (!auth.user) return <Navigate to={'/panel/admin' + location.search} state={{ returnTo: location.pathname + location.search }} replace />;
  if (auth.mfaRequired || auth.mfaEnrollmentRequired) return <Navigate to={'/panel/admin' + location.search} replace />;

  function content() {
    if (auth.roleError) return <p role="alert">{auth.roleError}</p>;
    if (tenant.loadingTenant) return <p role="status">Cargando institución…</p>;
    const error = tenant.tenantError || tenant.modulePermissionError;
    if (error) return <section className={css('project-card')}><p role="alert">{error}</p><button onClick={tenant.reloadInstitutions}>Reintentar</button></section>;
    if (!institution) return <p>No tienes una institución activa asignada.</p>;
    if (!tenant.hasModuleAccess(mode)) return <p>Este módulo no está habilitado para tu institución.</p>;
    const allowed = mode === 'projects' ? ['super_admin', 'institution_admin', 'projects_manager'] : ['super_admin', 'institution_admin', 'content_editor'];
    if (!allowed.includes(canonicalRole(institution.role))) return <p>Tu rol no permite gestionar este módulo.</p>;
    if (mode === 'portal') return <PortalEditor key={auth.user!.id} />;
    return <><ProjectsDashboard key={`${auth.user!.id}:${institution.institution_id}`} institution={institution} /></>;
  }
  const workspace = <PrivateWorkspace><div>{content()}</div></PrivateWorkspace>;
  return institution ? <InstitutionProvider institutionId={institution.institution_id}><InstitutionSessionLayout>{workspace}</InstitutionSessionLayout></InstitutionProvider> : workspace;
}
