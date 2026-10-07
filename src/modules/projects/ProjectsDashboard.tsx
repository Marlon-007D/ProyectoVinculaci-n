import React, { useState } from 'react';
import { ProjectDetails } from './ProjectDetails';
import type { Project } from './types';

export const ProjectsDashboard = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  
  const [newProject, setNewProject] = useState({ 
    name: '', 
    description: '', 
    budget_total: '',
    start_date: '',
    end_date: ''
  });

  const handleAddProject = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const budget = parseFloat(newProject.budget_total);
    
    if (budget < 0 || budget > 100000) {
      setErrorMsg('El presupuesto debe ser realista para una institución educativa (Máx: $100,000.00).');
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
        setErrorMsg('La duración del proyecto no debe exceder los 3 años.');
        return;
      }
    }

    const projectToAdd: Project = {
      id: crypto.randomUUID(),
      institution_id: '00000000-0000-0000-0000-000000000000',
      name: newProject.name,
      description: newProject.description,
      budget_total: budget,
      is_active: true,
      start_date: newProject.start_date,
      end_date: newProject.end_date,
    };

    setProjects([...projects, projectToAdd]);
    setIsModalOpen(false);
    setNewProject({ name: '', description: '', budget_total: '', start_date: '', end_date: '' });
  };

  if (selectedProject) {
    return <ProjectDetails project={selectedProject} onBack={() => setSelectedProject(null)} />;
  }

  return (
    <div className="min-h-screen p-6 md:p-10 bg-gray-50 text-gray-800">
      <header className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-5 rounded-md border border-gray-200 shadow-sm">
        <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
          Gestión de Proyectos
        </h1>
        <button 
          onClick={() => {
            setErrorMsg('');
            setIsModalOpen(true);
          }}
          className="mt-4 md:mt-0 bg-blue-600 text-white py-2 px-5 rounded hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Nuevo Proyecto
        </button>
      </header>

      {projects.length === 0 ? (
        <div className="bg-white rounded-md p-10 text-center border border-gray-200 shadow-sm">
          <p className="text-gray-500">No hay proyectos registrados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {projects.map(project => (
            <div key={project.id} className="bg-white border border-gray-200 rounded-md p-5 shadow-sm flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-semibold text-gray-900 leading-snug pr-2 truncate" title={project.name}>
                  {project.name}
                </h2>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  project.is_active ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}>
                  {project.is_active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              
              <div className="flex-grow">
                {project.description && (
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                    {project.description}
                  </p>
                )}
                
                <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 mb-4 bg-gray-50 p-3 rounded border border-gray-100">
                  <div>
                    <span className="block font-medium text-gray-700">Fecha de inicio</span>
                    {project.start_date || 'No definida'}
                  </div>
                  <div>
                    <span className="block font-medium text-gray-700">Fecha de fin</span>
                    {project.end_date || 'No definida'}
                  </div>
                </div>

                <div className="mb-2">
                  <span className="text-sm font-medium text-gray-700 block mb-1">Presupuesto Asignado</span>
                  <div className="text-lg font-semibold text-gray-900 truncate" title={`$${project.budget_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}>
                    ${project.budget_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-100">
                <button 
                  onClick={() => setSelectedProject(project)}
                  className="w-full bg-white text-blue-600 border border-blue-600 py-2 rounded text-sm font-medium hover:bg-blue-50 transition-colors"
                >
                  Ver Detalles
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-900/50 flex justify-center items-center z-50 p-4">
          <div className="bg-white rounded-md p-6 max-w-lg w-full shadow-lg">
            <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-3">
              <h2 className="text-lg font-semibold text-gray-900">Registrar Proyecto</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAddProject} className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input 
                  type="text" required maxLength={100}
                  value={newProject.name}
                  onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                <textarea 
                  rows={3} maxLength={500}
                  value={newProject.description}
                  onChange={(e) => setNewProject({...newProject, description: e.target.value})}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none resize-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de inicio</label>
                  <input 
                    type="date" required
                    value={newProject.start_date}
                    onChange={(e) => setNewProject({...newProject, start_date: e.target.value})}
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de fin</label>
                  <input 
                    type="date" required
                    value={newProject.end_date}
                    onChange={(e) => setNewProject({...newProject, end_date: e.target.value})}
                    className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Presupuesto ($)</label>
                <input 
                  type="number" required min="0" max="100000" step="0.01"
                  value={newProject.budget_total}
                  onChange={(e) => setNewProject({...newProject, budget_total: e.target.value})}
                  className="w-full p-2 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded hover:bg-gray-200">
                  Cancelar
                </button>
                <button type="submit" className="px-4 py-2 text-sm text-white bg-blue-600 rounded hover:bg-blue-700">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
