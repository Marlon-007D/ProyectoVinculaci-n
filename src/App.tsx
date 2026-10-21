import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/AuthContext';
import { TenantProvider } from './core/TenantContext';
import { SiteApp } from './modules/site';
import { ModuleBoundary } from './modules/projects/integration/ModuleBoundary';
import { InstitutionProvider, useInstitution } from './modules/site/context/InstitutionContext';
import { DecePublicSection } from './modules/dece/public';
import { SessionProvider } from './core/auth/session';
import AdminRoutes from './modules/admin/AdminRoutes';
import { RegistrationRoute } from './modules/auth/RegistrationRoute';
import SimulatorApp from './app/App';

const ModuleRoutes = lazy(() => import('./modules/projects/integration/ModuleRoutes'));
const modulePage = <ModuleBoundary><Suspense fallback={<p role="status">Cargando módulo…</p>}><ModuleRoutes /></Suspense></ModuleBoundary>;
const RESERVED_SLUGS = new Set(['admin', 'panel', 'inicio', 'proyectos', 'dece', 'simuladores', 'portal', 'system-admin']);

function SlugSessionRoute() {
  const { slug = '' } = useParams();
  return RESERVED_SLUGS.has(slug.toLowerCase()) ? <SiteApp /> : <SessionProvider />;
}

function PublicDeceRoute() {
  const { institutionId } = useInstitution();
  return <DecePublicSection institutionId={institutionId} title="Departamento de Consejería Estudiantil" />;
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
  return <Routes>
    <Route path="/register" element={<RegistrationRoute />} />
    <Route path="/panel/admin" element={<AdminRoutes />} />
    <Route path="/panel/superadmin" element={<AdminRoutes superadminOnly />} />
    <Route path="/system-admin" element={<Navigate to="/panel/superadmin" replace />} />
    <Route path="/panel/simuladores/*" element={<SimulatorApp />} />
    <Route path="/simuladores/*" element={<SimulatorApp />} />
    <Route path="/dece/:slug/*" element={<InstitutionProvider><PublicDeceRoute /></InstitutionProvider>} />
    <Route path="/:slug/login" element={<SlugSessionRoute />} />
    <Route path="/:slug/dece/*" element={<SlugSessionRoute />} />
    <Route path="/:slug/mi-ficha/*" element={<SlugSessionRoute />} />
    <Route path="/:slug/admin/*" element={<SlugSessionRoute />} />
    <Route path="/:slug/sin-modulos" element={<SlugSessionRoute />} />
    <Route path="/proyectos/*" element={modulePage} />
    <Route path="/panel/proyectos/*" element={modulePage} />
    <Route path="/panel/portal/*" element={modulePage} />
    <Route path="/portal/*" element={modulePage} />
    <Route path="/*" element={<SiteApp />} />
  </Routes>;
}

export default function App() {
  return <BrowserRouter><AuthProvider><TenantProvider><RoutesWithAuth /></TenantProvider></AuthProvider></BrowserRouter>;
}
