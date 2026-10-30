import { ProjectSessionHost, isPrivateProjectsPath } from './modules/projects/integration/ProjectSessionHost';
import { lazy, Suspense, useMemo, useRef } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/AuthContext';
import { TenantProvider, useTenant } from './core/TenantContext';
import { SiteApp } from './modules/site';
import { ModuleBoundary } from './modules/projects/integration/ModuleBoundary';
import { InstitutionProvider, useInstitution } from './modules/site/context/InstitutionContext';
import { InstitutionSessionLayout } from './modules/site/components/Layout/InstitutionSessionLayout';
import { PrivateWorkspace } from './modules/site/components/Layout/PrivateWorkspace';
import { PrivateContentSkeleton } from './modules/site/components/Layout/PrivateContentSkeleton';
import { InstitutionalHeader } from './modules/site/components/Header/InstitutionalHeader';
import { InstitutionalPanel } from './pages/InstitutionalPanel';
import { DecePublicSection } from './modules/dece/public';
import { DeceApp, DeceDataProvider } from './modules/dece';
import { supabase } from './core/supabaseClient';
import { SessionProvider } from './core/auth/session';
import AdminRoutes from './modules/admin/AdminRoutes';
import SimulatorApp from './app/App';
import { AcademicManagementRoutes } from './features/feats/pages/AcademicManagementRoutes';
import { returnToFromLocation } from './modules/admin/auth/returnTo';
import { AuthPage } from './features/auth/pages/AuthPage';
import { membershipRequestService } from './modules/admin/userManagement/membershipRequestService';
import { RegistrationRoute } from './modules/auth/RegistrationRoute';
import { ErrorBoundary } from './shared/components/ErrorPage/ErrorBoundary';
import { ErrorPage } from './shared/components/ErrorPage/ErrorPage';

const ModuleRoutes = lazy(() => import('./modules/projects/integration/ModuleRoutes'));
const modulePage = <ModuleBoundary><Suspense fallback={<p role="status">Cargando módulo…</p>}><ModuleRoutes /></Suspense></ModuleBoundary>;
const RESERVED_SLUGS = new Set(['admin', 'panel', 'inicio', 'proyectos', 'dece', 'simuladores', 'portal', 'system-admin']);

function SlugSessionRoute() {
  const { slug = '' } = useParams();
  const location = useLocation();
  if (RESERVED_SLUGS.has(slug.toLowerCase())) return <SiteApp />;
  if (location.pathname.endsWith('/login'))
    return <Navigate to={'/login?' + new URLSearchParams({ ...Object.fromEntries(new URLSearchParams(location.search)), slug }).toString()} state={location.state} replace />;
  return <InstitutionProvider><InstitutionSessionLayout><SessionProvider /></InstitutionSessionLayout></InstitutionProvider>;
}

function PublicDeceRoute() {
  const { institutionId } = useInstitution();
  return <DecePublicSection institutionId={institutionId} title="Departamento de Consejería Estudiantil" />;
}

// One private layout for every /panel workspace: InstitutionProvider and the site frame stay mounted
// while the user moves between modules, so only the content area changes.
function PrivateLayout() {
  const { user, loading } = useAuth();
  const { activeInstitution, loadingTenant } = useTenant();
  const { pathname } = useLocation();
  const resolvedFor = useRef<string | null>(null);
  if (!loading && !loadingTenant) resolvedFor.current = user?.id ?? null;
  // Children decide redirects from `user`, which is null until the session resolves.
  const resolving = loading || (Boolean(user) && resolvedFor.current !== user?.id);
  const shell = <PrivateWorkspace><PrivateContentSkeleton /></PrivateWorkspace>;
  if (resolving) return shell;
  const bare = pathname === '/panel';
  const outlet = <Outlet />;
  const content = user && !bare ? <PrivateWorkspace>{outlet}</PrivateWorkspace> : outlet;
  if (!activeInstitution) return <><InstitutionalHeader />{content}</>;
  return <InstitutionProvider institutionId={activeInstitution.institution_id} loadingFallback={shell}><InstitutionSessionLayout>{content}</InstitutionSessionLayout></InstitutionProvider>;
}

function DeceWorkspaceRoute() {
  const { user, role, loading } = useAuth();
  const location = useLocation();
  const { activeInstitution, loadingTenant, modulePermissionError, hasModuleAccess } = useTenant();
  const integration = useMemo(() => activeInstitution ? {
    client: supabase,
    institutionId: activeInstitution.institution_id,
    profileId: user?.id,
    slug: activeInstitution.slug,
    getStudentId: (student: { recordId?: string }) => student.recordId ?? null,
  } : null, [activeInstitution, user?.id]);

  if (loading) return <main role="status">Cargando el espacio DECE…</main>;
  if (!user) return <Navigate to={'/login' + location.search} state={{ returnTo: returnToFromLocation(location) }} replace />;
  if (loadingTenant) return <main role="status">Cargando el espacio DECE…</main>;
  if (!activeInstitution || !integration) return <main role="alert">No hay una institución activa disponible para esta cuenta.</main>;
  if (role !== 'dece_staff') return <main role="alert">El módulo DECE está disponible únicamente para el personal DECE.</main>;
  if (modulePermissionError) return <main role="alert">{modulePermissionError}</main>;
  if (!hasModuleAccess('dece')) return <main role="alert">El módulo DECE no está habilitado para {activeInstitution.name}.</main>;

  return <DeceDataProvider value={integration}><DeceApp /></DeceDataProvider>;
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
  return <ErrorBoundary resetKey={location.pathname}><ProjectSessionHost /><Routes>
    <Route path="/login" element={<AuthPage requestService={membershipRequestService} />} />
    <Route path="/register" element={<RegistrationRoute />} />
    <Route element={<PrivateLayout />}>
      <Route path="/panel" element={<InstitutionalPanel />} />
      <Route path="/panel/admin" element={<AdminRoutes />} />
      <Route path="/panel/instituciones" element={<AdminRoutes superadminOnly />} />
      <Route path="/panel/superadmin" element={<AdminRoutes superadminOnly />} />
      <Route path="/panel/cursos" element={<AcademicManagementRoutes />} />
      <Route path="/panel/cursos/*" element={<AcademicManagementRoutes />} />
      <Route path="/panel/publicaciones/*" element={<AcademicManagementRoutes />} />
      <Route path="/panel/dece" element={<DeceWorkspaceRoute />} />
      <Route path="/panel/dece/*" element={<DeceWorkspaceRoute />} />
    </Route>
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
    <Route path="/panel/*" element={<ErrorPage kind="not-found" homeHref="/panel" />} />
    <Route path="/*" element={<SiteApp />} />
  </Routes></ErrorBoundary>;
}

export default function App() {
  return <ErrorBoundary fallback={() => <ErrorPage kind="unexpected" onRetry={() => window.location.reload()} />}>
    <BrowserRouter><AuthProvider><TenantProvider><RoutesWithAuth /></TenantProvider></AuthProvider></BrowserRouter>
  </ErrorBoundary>;
}
