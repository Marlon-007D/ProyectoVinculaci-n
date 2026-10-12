import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ProjectDetails } from './ProjectDetails';
import { createProjectService, projectError } from './projectService';
import type { Institution } from '../../core/TenantContext';
import { isMoney, sumMoney } from './projectValidation';
import type { Project } from './types';

export const ProjectsDashboard = ({ institution }: { institution: Institution }) => {
  const projectService = useMemo(() => createProjectService(institution.institution_id), [institution.institution_id]);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const loadId = useRef(0);
  const [loadError, setLoadError] = useState('');
  async function mutate(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setErrorMsg('');
    try { await action(); } catch (cause) { setErrorMsg(projectError(cause)); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<'supabase' | 'local'>('supabase');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Filtros y busqueda
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    budget_total: '',
    start_date: '',
    end_date: '',
  });

  const loadProjects = useCallback(async () => {
    const request = ++loadId.current;
    setLoading(true);
    setLoadError('');
    try {
      const res = await projectService.getProjects();
      if (request !== loadId.current) return;
      setProjects(res.data);
      setSource(res.source);
    } catch (cause) {
      if (request === loadId.current) { setProjects([]); setLoadError(projectError(cause)); }
    } finally {
      if (request === loadId.current) setLoading(false);
    }
  }, [projectService]);
  useEffect(() => { void loadProjects(); return () => { loadId.current++; }; }, [loadProjects]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const budget = parseFloat(newProject.budget_total);

    if (!isMoney(budget) || budget > 100000 || !newProject.name.trim()) {
      setErrorMsg('Escribe un nombre y un presupuesto entre $0 y $100.000, con máximo dos decimales.');
      return;
    }

    if (newProject.start_date && newProject.end_date) {
      const start = new Date(newProject.start_date);
      const end = new Date(newProject.end_date);

      if (end < start) {
        setErrorMsg('La fecha de fin no puede ser anterior a la fecha de inicio.');
        return;
      }

      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365);

      if (diffYears > 3) {
        setErrorMsg('La duracion del proyecto no debe exceder los 3 anos.');
        return;
      }
    }

    try {
      const res = await projectService.createProject({
        name: newProject.name.trim(),
        description: newProject.description.trim(),
        budget_total: budget,
        start_date: newProject.start_date,
        end_date: newProject.end_date,
      });

      setProjects(prev => [res.data, ...prev]);
      setIsModalOpen(false);
      setNewProject({ name: '', description: '', budget_total: '', start_date: '', end_date: '' });
    } catch (cause) {
      setErrorMsg(projectError(cause));
    }
  };

  const handleToggleStatus = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus = await projectService.toggleProjectStatus(projectId);
    setProjects(prev => prev.map(p => (p.id === projectId ? { ...p, is_active: newStatus } : p)));
  };

  const handleProjectUpdated = (updatedProj: Project) => {
    setSelectedProject(updatedProj);
    setProjects(prev => prev.map(p => (p.id === updatedProj.id ? updatedProj : p)));
  };

  // Filtrado de proyectos
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === 'all' ? true : statusFilter === 'active' ? p.is_active : !p.is_active;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  // Metricas globales
  const totalProjectsCount = projects.length;
  const activeProjectsCount = projects.filter(p => p.is_active).length;
  const globalTotalBudget = sumMoney(projects.map(project => project.budget_total));
  const globalSpentBudget = sumMoney(projects.flatMap(project => (project.budget_items ?? []).map(item => item.spent_amount)));

  if (selectedProject) {
    return (
      <ProjectDetails
        project={selectedProject}
        institutionName={institution.name}
        canPublish={['super_admin', 'institution_admin'].includes(institution.role)}
        onBack={() => setSelectedProject(null)}
        onProjectUpdate={handleProjectUpdated}
      />
    );
  }

  return (
    <fieldset disabled={busy} className="min-h-screen p-6 md:p-10 bg-gray-50 text-gray-800">
      {(loadError || errorMsg) && <p role="alert" className="mb-4 rounded border border-red-200 bg-red-50 p-4 text-red-800">{loadError || errorMsg}</p>}
      {/* Encabezado principal */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 bg-white p-6 rounded-md border border-gray-200 shadow-sm gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
              Proyectos · {institution.name}
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                source === 'supabase'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              <span className={`size-1.5 rounded-full ${source === 'supabase' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              {loading ? 'Consultando…' : loadError ? 'Consulta fallida' : source === 'supabase' ? 'Datos de Supabase' : ''}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Planificacion, asignacion de partidas presupuestarias, registro de facturas y seguimiento de equipos de vinculacion.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            disabled={loading} onClick={() => void loadProjects()}
            className="text-gray-600 hover:text-gray-900 px-3 py-2 text-xs border border-gray-200 rounded bg-white hover:bg-gray-50 transition-colors"
            title="Recargar desde Supabase"
          >
            Actualizar
          </button>
          <button
            onClick={() => {
              setErrorMsg('');
              setIsModalOpen(true);
            }}
            className="bg-blue-600 text-white py-2 px-5 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Nuevo Proyecto
          </button>
        </div>
      </header>

      {/* Tarjetas KPI de resumen general */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider block">Total Proyectos</span>
          <p className="text-2xl font-bold text-gray-900 mt-1">{totalProjectsCount}</p>
          <span className="text-xs text-gray-400 mt-1 block">Iniciativas registradas</span>
        </div>

        <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider block">Proyectos Activos</span>
          <p className="text-2xl font-bold text-emerald-600 mt-1">{activeProjectsCount}</p>
          <span className="text-xs text-gray-400 mt-1 block">En ejecucion actual</span>
        </div>

        <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider block">Presupuesto Asignado</span>
          <p className="text-2xl font-bold text-gray-900 mt-1">
            ${globalTotalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-xs text-gray-400 mt-1 block">Presupuesto global</span>
        </div>

        <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider block">Gastos Ejecutados</span>
          <p className="text-2xl font-bold text-red-600 mt-1">
            ${globalSpentBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <span className="text-xs text-gray-400 mt-1 block">
            {globalTotalBudget > 0 ? Math.round((globalSpentBudget / globalTotalBudget) * 100) : 0}% de ejecucion
          </span>
        </div>
      </div>

      {/* Barra de filtros y busqueda */}
      <div className="bg-white p-4 rounded-md border border-gray-200 shadow-sm mb-6 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="w-full sm:w-96">
          <input
            type="text"
            placeholder="Buscar por nombre o descripcion..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-300 rounded focus:border-blue-500 outline-none"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <label className="text-xs text-gray-500 font-medium">Estado:</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
            className="px-3 py-2 text-xs border border-gray-300 rounded bg-white text-gray-700 outline-none"
          >
            <option value="all">Todos los proyectos ({projects.length})</option>
            <option value="active">Solo activos ({activeProjectsCount})</option>
            <option value="inactive">Solo inactivos ({projects.length - activeProjectsCount})</option>
          </select>
        </div>
      </div>

      {/* Lista de proyectos */}
      {loading ? (
        <div className="bg-white rounded-md p-12 text-center border border-gray-200 shadow-sm">
          <div className="inline-block size-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-gray-500 text-sm">Cargando proyectos desde el servicio...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-md p-12 text-center border border-gray-200 shadow-sm">
          <p className="text-gray-600 font-medium text-sm">No se encontraron proyectos registrados con los criterios seleccionados.</p>
          <p className="text-gray-400 text-xs mt-1">Haz clic en "Nuevo Proyecto" para registrar uno.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProjects.map(project => {
            const projectSpent = (project.budget_items || []).reduce((acc, b) => acc + (b.spent_amount || 0), 0);
            const percent = project.budget_total > 0 ? Math.min(100, Math.round((projectSpent / project.budget_total) * 100)) : 0;
            const rubrosCount = (project.budget_items || []).length;
            const membersCount = (project.members || []).length;

            return (
              <div key={project.id} className="bg-white border border-gray-200 rounded-md p-5 shadow-sm flex flex-col justify-between hover:border-gray-300 transition-colors">
                <div>
                  <div className="flex justify-between items-start mb-3 gap-2">
                    <h2 className="text-base font-semibold text-gray-900 leading-snug line-clamp-2" title={project.name}>
                      {project.name}
                    </h2>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium shrink-0 border ${
                        project.is_active
                          ? 'bg-green-50 text-green-700 border-green-200'
                          : 'bg-gray-100 text-gray-600 border-gray-200'
                      }`}
                    >
                      {project.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>

                  {project.description && (
                    <p className="text-gray-600 text-xs mb-4 line-clamp-3 leading-relaxed">
                      {project.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-xs text-gray-500 mb-4 bg-gray-50 p-2.5 rounded border border-gray-100">
                    <div>
                      <span className="block font-medium text-gray-700">Inicio</span>
                      {project.start_date || 'No definida'}
                    </div>
                    <div>
                      <span className="block font-medium text-gray-700">Fin</span>
                      {project.end_date || 'No definida'}
                    </div>
                  </div>

                  <div className="mb-4">
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs text-gray-600">Presupuesto</span>
                      <span className="text-sm font-bold text-gray-900">
                        ${project.budget_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Ejecutado: ${projectSpent.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <span>{percent}%</span>
                    </div>

                    <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${percent > 90 ? 'bg-red-500' : percent > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4 pt-2 border-t border-gray-100">
                    <span>Partidas: <strong className="text-gray-700">{rubrosCount}</strong></span>
                    <span>Equipo: <strong className="text-gray-700">{membersCount} miembros</strong></span>
                  </div>
                </div>

                <div className="pt-3 border-t border-gray-100 flex items-center gap-2">
                  <button
                    onClick={() => setSelectedProject(project)}
                    className="flex-1 bg-blue-600 text-white py-1.5 px-3 rounded text-xs font-medium hover:bg-blue-700 transition-colors text-center"
                  >
                    Ver Detalles
                  </button>
                  <button
                    onClick={event => void mutate(() => handleToggleStatus(project.id, event))}
                    className="px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded bg-gray-50 hover:bg-gray-100 transition-colors"
                    title={project.is_active ? 'Pausar proyecto' : 'Activar proyecto'}
                  >
                    {project.is_active ? 'Pausar' : 'Activar'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Registrar Proyecto */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-md p-6 max-w-lg w-full shadow-lg">
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">Registrar Proyecto de Vinculacion</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded">
                {errorMsg}
              </div>
            )}

            <form onSubmit={event => { event.preventDefault(); void mutate(() => handleAddProject(event)); }} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nombre del Proyecto</label>
                <input
                  type="text" required maxLength={120}
                  placeholder="Ej. Capacitacion Tecnologica en Comunidades Rurales"
                  value={newProject.name}
                  onChange={e => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Descripción y objetivos públicos</label>
                <textarea
                  rows={3} maxLength={500}
                  placeholder="Objetivos y actividades. Evita nombres o identificaciones de beneficiarios."
                  value={newProject.description}
                  onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de Inicio</label>
                  <input
                    type="date" required
                    value={newProject.start_date}
                    onChange={e => setNewProject({ ...newProject, start_date: e.target.value })}
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Fecha de Finalizacion</label>
                  <input
                    type="date" required
                    value={newProject.end_date}
                    onChange={e => setNewProject({ ...newProject, end_date: e.target.value })}
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Presupuesto Aprobado ($)</label>
                <input
                  type="number" required min="1" max="100000" step="0.01"
                  placeholder="Ej. 12000.00"
                  value={newProject.budget_total}
                  onChange={e => setNewProject({ ...newProject, budget_total: e.target.value })}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-gray-600 bg-gray-100 rounded hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs text-white bg-blue-600 rounded hover:bg-blue-700 font-medium"
                >
                  Guardar Proyecto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </fieldset>
  );
};
