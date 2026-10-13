import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SchoolBadge } from './SchoolBadge';
import { useTenant } from '../../core/TenantContext';

export function InstitutionalFooter() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { activeInstitution, institutions, setActiveInstitution } = useTenant();

  useEffect(() => {
    const checkScroll = () => {
      if (window.scrollY > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    window.addEventListener('scroll', checkScroll, { passive: true });
    return () => window.removeEventListener('scroll', checkScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <footer className="w-full text-slate-100 relative border-t bg-[#0a233f] border-slate-700">
        <div className="border-b border-white/10 py-5 px-4">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
            <div className="flex items-center gap-3">
              <SchoolBadge institutionName={activeInstitution?.name} size="sm" showText={false} />
              <div>
                <h4 className="font-bold text-sm tracking-tight text-white">
                  {activeInstitution?.name || 'Plataforma Institucional Educativa'}
                </h4>
                <p className="text-xs text-sky-200">
                  Sistema de Gestión Web, Vinculación Comunitaria y Módulos Académicos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/panel"
                className="px-3.5 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-600 text-white font-semibold text-xs transition-colors"
              >
                Inicio
              </Link>
              <Link
                to="/panel/admin"
                className="px-3.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold text-xs transition-colors"
              >
                Acceso Administrativo
              </Link>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <h5 className="text-xs font-bold tracking-wider uppercase text-sky-300 mb-3 pb-1 border-b border-white/10">
                Plataforma Institucional
              </h5>
              <p className="text-xs text-slate-300 leading-relaxed mb-3">
                Entorno integral para la administración web, seguimiento de prácticas de vinculación comunitaria, consejería DECE y simuladores educativos.
              </p>
              <span className="text-[11px] text-sky-400 font-medium">
                Red multiinstitucional de 4 unidades educativas
              </span>
            </div>

            <div>
              <h5 className="text-xs font-bold tracking-wider uppercase text-sky-300 mb-3 pb-1 border-b border-white/10">
                Módulos del Sistema
              </h5>
              <ul className="space-y-2 text-xs text-slate-300">
                <li>
                  <Link to="/panel/proyectos" className="hover:text-white transition-colors">
                    Proyectos de Vinculación
                  </Link>
                </li>
                <li>
                  <Link to="/panel/portal" className="hover:text-white transition-colors">
                    Portal Web Institucional
                  </Link>
                </li>
                <li>
                  <Link to="/panel/dece" className="hover:text-white transition-colors">
                    Departamento DECE
                  </Link>
                </li>
                <li>
                  <Link to="/panel/simuladores" className="hover:text-white transition-colors">
                    Simuladores Académicos
                  </Link>
                </li>
                <li>
                  <Link to="/panel/admin" className="hover:text-white transition-colors">
                    Administración y Seguridad
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="text-xs font-bold tracking-wider uppercase text-sky-300 mb-3 pb-1 border-b border-white/10">
                Accesos Directos
              </h5>
              <ul className="space-y-2 text-xs text-slate-300">
                <li>
                  <Link to="/panel" className="hover:text-white transition-colors">
                    Inicio del Panel
                  </Link>
                </li>
                <li>
                  <Link to="/panel/admin" className="hover:text-white transition-colors">
                    Panel de Administración
                  </Link>
                </li>
                <li>
                  <Link to="/panel/proyectos" className="hover:text-white transition-colors">
                    Registro de Horas de Vinculación
                  </Link>
                </li>
                <li>
                  <Link to="/panel/portal" className="hover:text-white transition-colors">
                    Gestor de Contenidos
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h5 className="text-xs font-bold tracking-wider uppercase text-sky-300 mb-3 pb-1 border-b border-white/10">
                Unidades Educativas
              </h5>
              <div className="space-y-2 text-xs text-slate-300">
                {institutions && institutions.length > 0 ? (
                  institutions.map((inst) => (
                    <button
                      key={inst.institution_id}
                      type="button"
                      onClick={() => setActiveInstitution(inst)}
                      className="block text-left text-xs text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      {inst.name}
                    </button>
                  ))
                ) : (
                  <p className="font-semibold text-white">
                    {activeInstitution?.name || 'Sede Educativa'}
                  </p>
                )}
                <p className="text-[11px] text-slate-400 leading-relaxed pt-1">
                  Configuración administrable para las sedes educativas desde el módulo de seguridad.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 bg-black/20 py-3.5 px-4 text-xs text-slate-400">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left">
            <p>
              2026 Plataforma Institucional de Vinculación y Educación. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span>Versión 3.8.0</span>
              <span>·</span>
              <span>Portal Multicentro</span>
            </div>
          </div>
        </div>
      </footer>

      {showScrollTop && (
        <button
          type="button"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-40 px-3 py-1.5 text-xs font-bold rounded-lg bg-sky-900 hover:bg-sky-800 text-white shadow-md transition-colors border border-white/20 cursor-pointer"
          aria-label="Volver arriba"
          title="Volver al inicio"
        >
          Arriba
        </button>
      )}
    </>
  );
}
