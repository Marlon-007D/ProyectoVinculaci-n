import { Link } from 'react-router-dom';
import { useTenant } from '../core/TenantContext';

export function InstitutionalPanel() {
  const { activeInstitution } = useTenant();

  const institutionDisplayName = activeInstitution?.name || 'Plataforma Institucional Educativa';

  const modules = [
    {
      id: 'proyectos',
      title: 'Proyectos de Vinculación',
      path: '/panel/proyectos',
      description: 'Gestión y coordinación de proyectos comunitarios, asignación de docentes y seguimiento de horas de vinculación estudiantil.',
    },
    {
      id: 'portal',
      title: 'Portal Web',
      path: '/panel/portal',
      description: 'Administración de contenidos del portal educativo, publicaciones institucionales, noticias y avisos oficiales.',
    },
    {
      id: 'dece',
      title: 'Departamento DECE',
      path: '/panel/dece',
      description: 'Consejería estudiantil, registro de fichas socioeconómicas y atención integral psicopedagógica.',
    },
    {
      id: 'simuladores',
      title: 'Simuladores Académicos',
      path: '/panel/simuladores',
      description: 'Módulos prácticos para estudiantes con simuladores de facturación electrónica SRI y ejercicios académicos.',
    },
    {
      id: 'admin',
      title: 'Administración y Seguridad',
      path: '/panel/admin',
      description: 'Configuración general de la plataforma, roles de usuario, permisos y parámetros institucionales.',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div className="bg-[#0b2545] rounded-2xl p-6 sm:p-8 text-white shadow-sm">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
          {institutionDisplayName}
        </h1>
        <p className="mt-2 text-sm text-slate-300 max-w-2xl leading-relaxed">
          Plataforma centralizada para la gestión de proyectos de vinculación, portal web, departamento de consejería estudiantil, simuladores y administración institucional.
        </p>
      </div>

      <div>
        <div className="mb-5">
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Módulos del Sistema
          </h2>
          <p className="text-xs text-slate-500">
            Selecciona el módulo correspondiente para ingresar a su área de trabajo.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
            >
              <div className="space-y-2">
                <h3 className="font-bold text-slate-900 text-lg leading-snug">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="pt-5 mt-5 border-t border-slate-100">
                <Link
                  to={item.path}
                  className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg font-semibold text-xs text-white bg-[#0b2545] hover:bg-sky-900 transition-colors"
                >
                  Ingresar
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
