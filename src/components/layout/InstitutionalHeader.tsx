import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { SchoolBadge } from './SchoolBadge';
import { useAuth } from '../../core/AuthContext';
import { useTenant } from '../../core/TenantContext';

export function InstitutionalHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const { activeInstitution, institutions, setActiveInstitution, hasModuleAccess } = useTenant();

  const pathname = location.pathname;
  const isPanel = pathname === '/panel' || pathname === '/' || pathname === '/inicio';
  const isProjects = pathname === '/panel/proyectos' || pathname === '/proyectos';
  const isDece = pathname === '/panel/dece' || pathname === '/dece';
  const isSimulators = pathname === '/panel/simuladores' || pathname === '/simuladores';
  const isSite = pathname.startsWith('/panel/portal') || pathname.startsWith('/portal');

  const navLinks = (role === 'super_admin' ? [] : [
    { label: 'Inicio', path: '/panel', isActive: isPanel, moduleName: 'inicio' },
    { label: 'Proyectos', path: '/panel/proyectos', isActive: isProjects, moduleName: 'projects' },
    { label: 'DECE', path: '/panel/dece', isActive: isDece, moduleName: 'dece' },
    { label: 'Simuladores', path: '/panel/simuladores', isActive: isSimulators, moduleName: 'simuladores' },
    { label: 'Portal Web', path: '/panel/portal', isActive: isSite, moduleName: 'portal' },
  ] as const).filter((link) => hasModuleAccess(link.moduleName));

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/panel');
    } catch {
      return;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white shadow-[0_8px_26px_rgba(11,37,66,0.06)] border-b border-[#e0e8ee]">
      <div className="w-full text-white text-xs py-2 px-4 bg-[#0a233f]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] sm:text-xs text-teal-200 font-semibold">
            Plataforma Institucional Educativa
          </div>

          <div className="ml-auto text-xs">
            {role === 'super_admin' && institutions && institutions.length > 1 ? (
              <select
                value={activeInstitution?.institution_id || ''}
                onChange={(e) => {
                  const selected = institutions.find((i) => i.institution_id === e.target.value);
                  if (selected) setActiveInstitution(selected);
                }}
                className="bg-white/10 text-white text-[11px] font-semibold rounded px-2 py-0.5 border border-white/15 focus:outline-none cursor-pointer"
              >
                {institutions.map((inst) => (
                  <option key={inst.institution_id} value={inst.institution_id} className="text-gray-900">
                    {inst.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-[11px] text-teal-200">
                {activeInstitution?.name || 'Sede Educativa'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-3">
          <Link
            to="/panel"
            className="flex items-center gap-2.5 text-left group focus:outline-none shrink-0"
            title="Ir al inicio"
          >
            <SchoolBadge institutionName={activeInstitution?.name} size="md" />
          </Link>

          <nav className="hidden lg:flex items-center gap-1 xl:gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`relative px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors whitespace-nowrap ${
                  link.isActive
                    ? 'text-teal-900 bg-teal-50 border border-teal-200 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span>{link.label}</span>
                {link.isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-teal-600" />
                )}
              </Link>
            ))}

          </nav>

          <div className="hidden sm:flex items-center gap-3 shrink-0">
            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-gray-200 shrink-0">
                <Link
                  to="/panel/admin"
                  className="flex items-center gap-2 p-1 rounded hover:bg-gray-100 transition-colors text-left"
                  title="Ver perfil administrativo"
                >
                  <div className="w-8 h-8 rounded-full bg-[#0a233f] text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="hidden xl:block text-left max-w-[120px]">
                    <span className="block text-xs font-semibold text-gray-800 leading-tight truncate">
                      {user.email}
                    </span>
                      <span className="block text-[10px] text-teal-700 font-bold capitalize truncate">
                      {role || 'Usuario'}
                    </span>
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                  title="Cerrar sesión"
                >
                  Salir
                </button>
              </div>
            ) : (
              <Link
                to="/panel/admin"
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-teal-900 bg-teal-50 border border-teal-200 hover:bg-teal-100 transition-colors whitespace-nowrap"
              >
                Acceso Institucional
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-gray-700 hover:bg-gray-100 border border-gray-200"
            >
              {mobileMenuOpen ? 'Cerrar' : 'Menú'}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-2">
          <div className="space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold ${
                  link.isActive
                    ? 'bg-teal-50 text-teal-900 border border-teal-200 font-bold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{link.label}</span>
                {link.isActive && (
                    <span className="text-[10px] bg-teal-100 text-teal-900 px-2 py-0.5 rounded">
                    Activo
                  </span>
                )}
              </Link>
            ))}
          </div>

          <div className="pt-3 border-t border-gray-100">
            {user ? (
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs">
                <div>
                  <span className="block font-semibold text-gray-800">{user.email}</span>
                  <span className="block text-[11px] text-teal-700 font-bold capitalize">
                    {role || 'Usuario'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1 bg-white border border-gray-300 rounded text-rose-600 font-semibold"
                >
                  Salir
                </button>
              </div>
            ) : (
              <Link
                to="/panel/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="block w-full text-center py-2 text-xs font-semibold text-teal-900 bg-teal-50 border border-teal-200 rounded-lg"
              >
                Acceso Institucional
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
