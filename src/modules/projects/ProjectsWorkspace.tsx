import { useEffect, useState } from 'react';
import { useAuth } from '../../core/AuthContext';
import { useTenant } from '../../core/TenantContext';
import { ProjectsDashboard } from './ProjectsDashboard';
import { PublicProjects } from './PublicProjects';
import './projects.css';

export function ProjectsWorkspace({ onLogin }: { onLogin: () => void }) {
  const { user, loading } = useAuth();
  const { activeInstitution, loadingTenant, tenantError, reloadInstitutions } = useTenant();
  const [view, setView] = useState<'manage' | 'public'>(() => new URLSearchParams(location.search).has('transparency') ? 'public' : 'manage');
  useEffect(() => {
    const reload = () => reloadInstitutions();
    window.addEventListener('projects-institutions-changed', reload);
    return () => window.removeEventListener('projects-institutions-changed', reload);
  }, [reloadInstitutions]);
  return <section className="projects-workspace">
    <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-6 py-3.5 shadow-2xs print:hidden">
      <div className="flex items-center gap-2">
        <button
          className={`rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
            view === 'manage'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
          aria-pressed={view === 'manage'}
          onClick={() => setView('manage')}
        >
          Gestión institucional
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all ${
            view === 'public'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
          aria-pressed={view === 'public'}
          onClick={() => setView('public')}
        >
          Transparencia pública
        </button>
      </div>

    </div>
    {view === 'public' ? <PublicProjects /> : loading || loadingTenant ? <p className="p-8" role="status">Comprobando acceso institucional…</p>
      : !user ? <div className="p-8"><h1 className="text-2xl font-bold">Proyectos de vinculación</h1><p className="my-4">Inicia sesión para gestionar los proyectos de tu institución. Los resúmenes aprobados están disponibles en Transparencia pública.</p><button className="rounded bg-teal-700 px-5 py-2 text-white" onClick={onLogin}>Acceso institucional</button></div>
      : tenantError ? <p role="alert" className="m-6 rounded border border-red-200 bg-red-50 p-4">{tenantError}</p>
      : !activeInstitution ? <p className="p-8">No tienes una institución activa asignada. Un superadministrador debe registrar la institución y asignar tu membresía.</p>
      : !activeInstitution.projects_enabled ? <p className="p-8">El módulo de proyectos está deshabilitado para esta institución.</p>
      : !['super_admin', 'institution_admin', 'project_manager'].includes(activeInstitution.role) ? <p className="p-8">Tu rol no permite gestionar proyectos. Puedes consultar los resúmenes aprobados en Transparencia pública.</p>
      : <ProjectsDashboard key={`${user.id}:${activeInstitution.institution_id}`} institution={activeInstitution} />}
  </section>;
}
