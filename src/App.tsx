import { ProjectSessionHost, isPrivateProjectsPath } from './modules/projects/integration/ProjectSessionHost';
import { lazy, Suspense, useMemo } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/AuthContext';
import { TenantProvider, useTenant } from './core/TenantContext';
import { SiteApp } from './modules/site';
import { ModuleBoundary } from './modules/projects/integration/ModuleBoundary';
import { InstitutionProvider, useInstitution } from './modules/site/context/InstitutionContext';
import { InstitutionSessionLayout } from './modules/site/components/Layout/InstitutionSessionLayout';
import { PrivateWorkspace } from './modules/site/components/Layout/PrivateWorkspace';
import { InstitutionalHeader } from './modules/site/components/Header/InstitutionalHeader';
import { InstitutionalPanel } from './pages/InstitutionalPanel';
import { DecePublicSection } from './modules/dece/public';
import { DeceApp, DeceDataProvider } from './modules/dece';
import { supabase } from './core/supabaseClient';
import { SessionProvider } from './core/auth/session';
import AdminRoutes from './modules/admin/AdminRoutes';
import SimulatorApp from './app/App';
import { AcademicManagementRoutes } from './features/feats/pages/AcademicManagementRoutes';
import { AuthPage } from './features/auth/pages/AuthPage';
import { membershipRequestService } from './modules/admin/userManagement/membershipRequestService';
import { RegistrationRoute } from './modules/auth/RegistrationRoute';

const ModuleRoutes = lazy(() => import('./modules/projects/integration/ModuleRoutes'));
const modulePage = <ModuleBoundary><Suspense fallback={<p role="status">Cargando módulo…</p>}><ModuleRoutes /></Suspense></ModuleBoundary>;
const RESERVED_SLUGS = new Set(['admin', 'panel', 'inicio', 'proyectos', 'dece', 'simuladores', 'portal', 'system-admin']);

function SlugSessionRoute() {
  const { slug = '' } = useParams();
  const location = useLocation();
  if (RESERVED_SLUGS.has(slug.toLowerCase())) return <SiteApp />;
  if (location.pathname.endsWith('/login'))
    return <Navigate to={'/login?' + new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), slug }).toString()} replace />;
  return <InstitutionProvider><InstitutionSessionLayout><SessionProvider /></InstitutionSessionLayout></InstitutionProvider>;
}

function PublicDeceRoute() {
  const { institutionId } = useInstitution();
  return <DecePublicSection institutionId={institutionId} title="Departamento de Consejería Estudiantil" />;
}

function AdminRoutesWithInstitutionalChrome({ superadminOnly = false }: { superadminOnly?: boolean }) {
  const { activeInstitution } = useTenant();
  const { user } = useAuth();
  const adminRoutes = <AdminRoutes superadminOnly={superadminOnly} />;
  const content = user ? <PrivateWorkspace>{adminRoutes}</PrivateWorkspace> : adminRoutes;
  if (!activeInstitution) return <><InstitutionalHeader />{content}</>;
  return <InstitutionProvider institutionId={activeInstitution.institution_id}><InstitutionSessionLayout>{content}</InstitutionSessionLayout></InstitutionProvider>;
}

function AcademicManagementWithInstitutionalChrome() {
  const { activeInstitution } = useTenant();
  const workspace = <PrivateWorkspace><Outlet /></PrivateWorkspace>;
  if (!activeInstitution) return <><InstitutionalHeader />{workspace}</>;
  return <InstitutionProvider institutionId={activeInstitution.institution_id}><InstitutionSessionLayout>{workspace}</InstitutionSessionLayout></InstitutionProvider>;
}

function DeceWorkspaceRoute() {
  const { user, role } = useAuth();
  const { activeInstitution, loadingTenant, modulePermissionError, hasModuleAccess } = useTenant();
  const integration = useMemo(() => activeInstitution ? {
    client: supabase,
    institutionId: activeInstitution.institution_id,
    profileId: user?.id,
    slug: activeInstitution.slug,
    getStudentId: (student: { recordId?: string }) => student.recordId ?? null,
  } : null, [activeInstitution, user?.id]);

  if (!user) return <Navigate to="/panel/admin" replace />;
  if (loadingTenant) return <main role="status">Cargando el espacio DECE…</main>;
  if (!activeInstitution || !integration) return <main role="alert">No hay una institución activa disponible para esta cuenta.</main>;
  if (role !== 'dece_staff') return <main role="alert">El módulo DECE está disponible únicamente para el personal DECE.</main>;
  if (modulePermissionError) return <main role="alert">{modulePermissionError}</main>;
  if (!hasModuleAccess('dece')) return <main role="alert">El módulo DECE no está habilitado para {activeInstitution.name}.</main>;

  return <DeceDataProvider value={integration}><DeceApp /></DeceDataProvider>;
}

function DeceWorkspaceWithInstitutionalChrome() {
  const { activeInstitution } = useTenant();
  const workspace = <DeceWorkspaceRoute />;
  if (!activeInstitution) return <><InstitutionalHeader />{workspace}</>;
  return <InstitutionProvider institutionId={activeInstitution.institution_id}><InstitutionSessionLayout>{workspace}</InstitutionSessionLayout></InstitutionProvider>;
}

function InstitutionalPanelWithChrome() {
  const { activeInstitution } = useTenant();
  const panel = <InstitutionalPanel />;
  if (!activeInstitution) return <><InstitutionalHeader />{panel}</>;
  return <InstitutionProvider institutionId={activeInstitution.institution_id}><InstitutionSessionLayout>{panel}</InstitutionSessionLayout></InstitutionProvider>;
}

function RoutesWithAuth() {
  const { user, mfaRequired, mfaEnrollmentRequired } = useAuth();
  const location = useLocation();
  const mfaScreen = location.pathname === '/panel/admin' || location.pathname === '/panel/superadmin';
  const institutionSessionPath = /^\/[^/]+\/(?:login|dece|mi-ficha|admin|sin-modulos)(?:\/|$)/.test(location.pathname);
  const protectedRoute = location.pathname.startsWith('/panel/')
    || institutionSessionPath
    || (location.pathname.startsWith('/proyectos') && !new URLSearchParams(location.search).has('transparency'));
  if (user && (mfaRequired || mfaEnrollmentRequired) && protectedRoute && !mfaScreen)
    return <Navigate to={'/panel/admin' + location.search} replace />;
  return <><ProjectSessionHost /><Routes>
    <Route path="/login" element={<AuthPage requestService={membershipRequestService} />} />
    <Route path="/register" element={<RegistrationRoute />} />
    <Route path="/panel" element={<InstitutionalPanelWithChrome />} />
    <Route path="/panel/admin" element={<AdminRoutesWithInstitutionalChrome />} />
    <Route path="/panel/instituciones" element={<AdminRoutesWithInstitutionalChrome superadminOnly />} />
    <Route path="/panel/superadmin" element={<AdminRoutesWithInstitutionalChrome superadminOnly />} />
    <Route element={<AcademicManagementWithInstitutionalChrome />}>
      <Route path="/panel/cursos" element={<AcademicManagementRoutes />} />
      <Route path="/panel/cursos/*" element={<AcademicManagementRoutes />} />
      <Route path="/panel/publicaciones/*" element={<AcademicManagementRoutes />} />
    </Route>
    <Route path="/panel/dece" element={<DeceWorkspaceWithInstitutionalChrome />} />
    <Route path="/panel/dece/*" element={<DeceWorkspaceWithInstitutionalChrome />} />
    <Route path="/system-admin" element={<Navigate to="/panel/superadmin" replace />} />
    <Route path="/panel/simuladores/*" element={<SimulatorApp />} />
    <Route path="/simuladores/*" element={<SimulatorApp />} />
    <Route path="/dece/:slug/*" element={<InstitutionProvider><PublicDeceRoute /></InstitutionProvider>} />
    <Route path="/:slug/login" element={<SlugSessionRoute />} />
    <Route path="/:slug/dece/*" element={<SlugSessionRoute />} />
    <Route path="/:slug/mi-ficha/*" element={<SlugSessionRoute />} />
    <Route path="/:slug/admin/*" element={<SlugSessionRoute />} />
    <Route path="/:slug/sin-modulos" element={<SlugSessionRoute />} />
    <Route path="/proyectos/*" element={isPrivateProjectsPath(location.pathname, location.search) ? null : modulePage} />
    <Route path="/panel/proyectos/*" element={isPrivateProjectsPath(location.pathname, location.search) ? null : modulePage} />
    <Route path="/panel/portal/*" element={modulePage} />
    <Route path="/portal/*" element={modulePage} />
    <Route path="/*" element={<SiteApp />} />
  </Routes></>;
}

export default function App() {
  return <BrowserRouter><AuthProvider><TenantProvider><RoutesWithAuth /></TenantProvider></AuthProvider></BrowserRouter>;
}
