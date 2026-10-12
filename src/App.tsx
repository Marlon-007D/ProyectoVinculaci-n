import { useState, type FormEvent } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/AuthContext';
import { TenantProvider, useTenant } from './core/TenantContext';
import { isSupabaseConfigured } from './core/supabaseClient';
import { MfaEnrollment, SuperAdminPanel, UserManagement } from './modules/admin';
import { ProjectsWorkspace } from './modules/projects/ProjectsWorkspace';
import { DeceApp } from './modules/dece';
import { SiteApp } from './modules/site';
import { SimuladoresApp } from './app/SimuladoresApp';
import './App.css';

type MainTab = 'proyectos' | 'portal' | 'dece' | 'simuladores' | 'admin';

function AccessScreen({ onSuccess }: { onSuccess?: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await login(email.trim(), password);
      if (result.error) {
        setError('No se pudo iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.');
      } else {
        if (onSuccess) onSuccess();
      }
    } catch {
      setError('No fue posible conectar con el servicio de autenticación.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-[80vh] place-items-center bg-[radial-gradient(ellipse_at_50%_20%,#e6f1ef_0,transparent_55%),#f4f7f9] p-6">
      <section className="w-full max-w-[430px] rounded-[18px] border border-[#e4ebed] bg-white p-7 shadow-[0_16px_50px_#18384412] sm:p-[38px]">
        <div aria-hidden="true" className="mb-6 grid size-12 place-items-center rounded-[15px] bg-brand font-bold text-white shadow-[0_6px_16px_#145b5825]">V</div>
        <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#398278]">PLATAFORMA INSTITUCIONAL</p>
        <h1 className="mb-2 font-sans text-[25px] font-bold leading-tight tracking-tight text-ink">Gestión de Vinculación</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted">Ingresa con las credenciales de tu cuenta institucional para gestionar administración y roles.</p>
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="email" className="mt-2 text-[13px] font-semibold text-[#314953]">Correo electrónico</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46] focus-visible:outline" placeholder="admin@institucion.edu.ec" />
          <label htmlFor="password" className="mt-2 text-[13px] font-semibold text-[#314953]">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46]" placeholder="••••••••" />
          {error && <p role="alert" className="rounded-lg border border-[#f2d1ce] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#9b3838]">{error}</p>}
          <div className="flex items-center justify-between text-xs text-teal-700 py-1">
            <button
              type="button"
              className="text-left underline hover:text-teal-900 font-medium"
              onClick={() => {
                setEmail('admin@institucion.edu.ec');
                setPassword('admin123');
              }}
            >
              Cargar credenciales de demostración
            </button>
          </div>
          <button disabled={busy} className="mt-1 h-[45px] rounded-lg bg-brand font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-wait disabled:opacity-65">
            {busy ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
        <p className="mb-0 mt-[22px] text-center text-[11px] text-[#8b989d]">Acceso exclusivo para personal autorizado</p>
      </section>
    </main>
  );
}

function AdminWorkspace() {
  const { user, role, roleError, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-[#53656e]">
        <span className="size-[17px] animate-spin rounded-full border-2 border-[#dce7e7] border-t-[#398278]" />
        Comprobando sesión…
      </div>
    );
  }

  if (!user) {
    return <AccessScreen />;
  }

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-[30px]">
      <section className="py-[16px] sm:pb-[18px]">
        <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#398278]">ESPACIO DE ADMINISTRACIÓN</p>
        <h1 className="mb-2 text-[26px] font-bold tracking-tight text-ink sm:text-3xl">Panel de gestión y seguridad</h1>
        <p className="mb-0 text-sm text-muted">Administra las instituciones, membresías, factores MFA y auditoría de la plataforma.</p>
      </section>

      {role === 'super_admin' ? (
        <div className="space-y-6">
          <SuperAdminPanel />
          <UserManagement />
          <MfaEnrollment />
        </div>
      ) : (
        <section className="mt-4 rounded-lg border border-[#eadfc4] bg-white p-5 text-[13px] text-[#65573c] shadow-sm">
          <strong className="text-base text-[#52442a] block mb-1">Acceso restringido de Superadministración</strong>
          <p className="my-1 text-sm">{roleError ?? 'Tu cuenta tiene permisos estándar. Para acceder a herramientas de superadministración se requiere rol super_admin.'}</p>
          <span className="inline-block mt-2 px-2.5 py-1 bg-[#f5eddb] rounded text-xs text-[#827657] font-semibold">Rol actual: {role || 'sin rol asignado'}</span>
        </section>
      )}
    </div>
  );
}

function MainLayout() {
  const [activeTab, setActiveTab] = useState<MainTab>('proyectos');
  const { user, role, logout } = useAuth();
  const { activeInstitution } = useTenant();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Barra de navegación superior institucional */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
          {/* Logo y título de la plataforma */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('proyectos')}
              className="flex items-center gap-3 text-left focus:outline-none"
            >
              <div className="size-10 rounded-xl bg-brand font-extrabold text-white text-lg flex items-center justify-center shadow-sm">
                V
              </div>
              <div className="hidden sm:block">
                <span className="font-bold text-gray-900 leading-tight block text-base">Vinculación</span>
                <span className="text-[11px] font-medium text-gray-500 tracking-normal block">
                  {activeInstitution?.name || 'Plataforma multiinstitución'}
                </span>
              </div>
            </button>

            {/* Indicador de conexión Supabase */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-full">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{isSupabaseConfigured ? 'Supabase configurado' : 'Sin configurar'}</span>
            </div>
          </div>

          {/* Menu de pestanas principales */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('proyectos')}
              className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${activeTab === 'proyectos'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              Proyectos
            </button>
            <button
              onClick={() => setActiveTab('portal')}
              className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${activeTab === 'portal'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              Portal Web
            </button>
            <button
              onClick={() => setActiveTab('dece')}
              className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${activeTab === 'dece'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              DECE
            </button>
            <button
              onClick={() => setActiveTab('simuladores')}
              className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${activeTab === 'simuladores'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              Simuladores
            </button>
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${activeTab === 'admin'
                ? 'bg-teal-700 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
            >
              Admin
            </button>
          </nav>

          {/* Zona de usuario / autenticación */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden lg:block text-right">
                  <span className="block text-xs font-semibold text-gray-800 leading-tight">{user.email}</span>
                  <span className="block text-[10px] text-teal-700 font-medium capitalize">{role || 'Usuario'}</span>
                </div>
                <button
                  onClick={() => void logout()}
                  className="px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Salir
                </button>
              </div>
            ) : (
              <button
                onClick={() => setActiveTab('admin')}
                className="px-3 py-1.5 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 rounded-md hover:bg-teal-100 transition-colors"
              >
                Acceso Institucional
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Contenido del módulo activo */}
      <main className="flex-1">
        {activeTab === 'proyectos' && <ProjectsWorkspace onLogin={() => setActiveTab('admin')} />}
        {activeTab === 'portal' && <SiteApp />}
        {activeTab === 'dece' && <DeceApp />}
        {activeTab === 'simuladores' && <SimuladoresApp />}
        {activeTab === 'admin' && <AdminWorkspace />}
      </main>

      {/* Pie de página institucional unificado */}
      <footer className="bg-white border-t border-gray-200 py-4 px-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-2">
          <span>Plataforma Institucional · {activeInstitution?.name || 'Institución Educativa'}</span>
          <span className="text-gray-400">Prueba</span>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <MainLayout />
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
