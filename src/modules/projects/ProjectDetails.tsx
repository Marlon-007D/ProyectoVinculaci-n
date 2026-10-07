import React from 'react';
import type { Project } from './types';

interface ProjectDetailsProps {
  project: Project;
  onBack: () => void;
}

export const ProjectDetails: React.FC<ProjectDetailsProps> = ({ project, onBack }) => {
  return (
    <div className="min-h-screen p-6 md:p-10 bg-gray-50 text-gray-800">
      <button
        onClick={onBack}
        className="mb-6 text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center gap-1"
      >
        ← Volver al listado
      </button>

      <header className="bg-white p-6 rounded-md border border-gray-200 shadow-sm mb-6 flex flex-col md:flex-row justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">{project.name}</h1>
          {project.description && <p className="text-gray-600 text-sm">{project.description}</p>}
        </div>
        <span className={`px-3 py-1 rounded text-xs font-medium border ${project.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'
          }`}>
          {project.is_active ? 'Proyecto Activo' : 'Proyecto Inactivo'}
        </span>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Presupuesto Asignado</span>
          <p className="text-2xl font-bold text-gray-900 mt-2">
            ${project.budget_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Gastos Ejecutados</span>
          <p className="text-2xl font-bold text-red-600 mt-2">
            $0.00
          </p>
        </div>
        <div className="bg-white p-5 rounded-md border border-gray-200 shadow-sm">
          <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">Saldo Disponible</span>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            ${project.budget_total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-md border border-gray-200 shadow-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Rubros del Proyecto</h2>
          <button className="bg-gray-100 text-gray-700 border border-gray-300 py-1.5 px-4 rounded text-sm font-medium hover:bg-gray-200 transition-colors">
            Añadir Rubro
          </button>
        </div>

        <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-300 rounded-md">
          <p className="text-gray-500 text-sm">Aún no se han configurado los rubros para este proyecto.</p>
          <p className="text-gray-400 text-xs mt-1">Aquí construiremos la tabla para administrar el presupuesto detallado.</p>
        </div>
      </div>
    </div>
  );
};
