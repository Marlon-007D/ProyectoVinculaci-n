import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { SiteApp } from './modules/site';
import { ModuleBoundary } from './modules/projects/integration/ModuleBoundary';

const ModuleRoutes = lazy(() => import('./modules/projects/integration/ModuleRoutes'));
const modulePage = <ModuleBoundary><Suspense fallback={<p role="status">Cargando módulo…</p>}><ModuleRoutes /></Suspense></ModuleBoundary>;

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/proyectos/*" element={modulePage} />
        <Route path="/panel/proyectos/*" element={modulePage} />
        <Route path="/panel/portal/*" element={modulePage} />
        <Route path="/portal/*" element={modulePage} />
        <Route path="/*" element={<SiteApp />} />
      </Routes>
    </BrowserRouter>
  );
}
