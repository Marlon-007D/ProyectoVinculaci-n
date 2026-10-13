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
  const { activeInstitution, institutions, setActiveInstitution } = useTenant();

  const pathname = location.pathname;
  const isPanel = pathname === '/panel' || pathname === '/' || pathname === '/inicio';
  const isProjects = pathname === '/panel/proyectos' || pathname === '/proyectos';
  const isDece = pathname === '/panel/dece' || pathname === '/dece';
  const isSimulators = pathname === '/panel/simuladores' || pathname === '/simuladores';
  const isSite = pathname.startsWith('/panel/portal') || pathname.startsWith('/portal');
  const isAdmin = pathname === '/panel/admin' || pathname === '/admin';

  const navLinks = [
    { label: 'Inicio', path: '/panel', isActive: isPanel },
    { label: 'Proyectos', path: '/panel/proyectos', isActive: isProjects },
    { label: 'DECE', path: '/panel/dece', isActive: isDece },
    { label: 'Simuladores', path: '/panel/simuladores', isActive: isSimulators },
    { label: 'Portal Web', path: '/panel/portal', isActive: isSite },
  ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/panel');
    } catch {
      return;
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full shadow-xs bg-white border-b border-gray-200">
      <div className="w-full text-white text-xs py-2 px-4 bg-[#0a233f]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="text-[11px] sm:text-xs text-sky-200 font-medium">
            Plataforma Institucional Educativa
          </div>

          <div className="ml-auto text-xs">
            {institutions && institutions.length > 1 ? (
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
              <span className="text-[11px] text-sky-200">
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
                    ? 'text-sky-900 bg-sky-50 border border-sky-200 shadow-2xs font-bold'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <span>{link.label}</span>
                {link.isActive && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-sky-600" />
                )}
              </Link>
            ))}

            <Link
              to="/panel/admin"
              className={`px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-colors whitespace-nowrap ${
                isAdmin
                    ? 'text-sky-900 bg-sky-50 border border-sky-200 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span>Admin</span>
            </Link>
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
                    <span className="block text-[10px] text-sky-700 font-bold capitalize truncate">
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
                className="px-3.5 py-2 rounded-lg text-xs font-semibold text-sky-900 bg-sky-50 border border-sky-200 hover:bg-sky-100 transition-colors whitespace-nowrap"
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
                    ? 'bg-sky-50 text-sky-900 border border-sky-200 font-bold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{link.label}</span>
                {link.isActive && (
                  <span className="text-[10px] bg-sky-200 text-sky-900 px-2 py-0.5 rounded">
                    Activo
                  </span>
                )}
              </Link>
            ))}

            <Link
              to="/panel/admin"
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold ${
                isAdmin
                  ? 'bg-sky-50 text-sky-900 border border-sky-200 font-bold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span>Administración</span>
              {isAdmin && (
                <span className="text-[10px] bg-sky-200 text-sky-900 px-2 py-0.5 rounded">
                  Activo
                </span>
              )}
            </Link>
          </div>

          <div className="pt-3 border-t border-gray-100">
            {user ? (
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg text-xs">
                <div>
                  <span className="block font-semibold text-gray-800">{user.email}</span>
                  <span className="block text-[11px] text-sky-700 font-bold capitalize">
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
                className="block w-full text-center py-2 text-xs font-semibold text-sky-900 bg-sky-50 border border-sky-200 rounded-lg"
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
