import { useState, type FormEvent } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/AuthContext';
import { TenantProvider } from './core/TenantContext';
import { MfaEnrollment, SuperAdminPanel, UserManagement } from './modules/admin';
import { ProjectsWorkspace } from './modules/projects/ProjectsWorkspace';
import { DeceApp } from './modules/dece';
import { SiteApp } from './modules/site';
import { SimuladoresApp } from './app/SimuladoresApp';
import { InstitutionalLayout } from './components/layout/InstitutionalLayout';
import { InstitutionalPanel } from './pages/InstitutionalPanel';
import { NotFoundPage } from './pages/NotFoundPage';
import './App.css';

export function AccessScreen({ onSuccess }: { onSuccess?: () => void }) {
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
    <main className="grid min-h-[75vh] place-items-center bg-[radial-gradient(ellipse_at_50%_20%,#e6f1ef_0,transparent_55%),#f4f7f9] p-6">
      <section className="w-full max-w-[430px] rounded-[18px] border border-[#e4ebed] bg-white p-7 shadow-[0_16px_50px_#18384412] sm:p-[38px]">
        <div aria-hidden="true" className="mb-6 grid size-12 place-items-center rounded-[15px] bg-brand font-bold text-white shadow-[0_6px_16px_#145b5825]">
          V
        </div>
        <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#398278]">PLATAFORMA INSTITUCIONAL</p>
        <h1 className="mb-2 font-sans text-[25px] font-bold leading-tight tracking-tight text-ink">Gestión y Autenticación</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted">Ingresa con tus credenciales institucionales para gestionar administración, seguridad y roles.</p>
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="email" className="mt-2 text-[13px] font-semibold text-[#314953]">Correo electrónico</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={event => setEmail(event.target.value)}
            required
            className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46] focus-visible:outline"
            placeholder="admin@institucion.edu.ec"
          />
          <label htmlFor="password" className="mt-2 text-[13px] font-semibold text-[#314953]">Contraseña</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            required
            className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46]"
            placeholder="••••••••"
          />
          {error && <p role="alert" className="rounded-lg border border-[#f2d1ce] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#9b3838]">{error}</p>}
          <div className="flex items-center justify-between text-xs text-teal-700 py-1">
            <button
              type="button"
              className="text-left underline hover:text-teal-900 font-medium cursor-pointer"
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

export function AdminWorkspace() {
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
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-[30px]">
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

function ProjectsPageWrapper() {
  const navigate = useNavigate();
  return <ProjectsWorkspace onLogin={() => navigate('/panel/admin')} />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<InstitutionalLayout />}>
        <Route index element={<Navigate to="/panel" replace />} />
        <Route path="inicio" element={<Navigate to="/panel" replace />} />
        <Route path="panel" element={<InstitutionalPanel />} />
        <Route path="panel/proyectos" element={<ProjectsPageWrapper />} />
        <Route path="panel/dece" element={<DeceApp />} />
        <Route path="panel/simuladores" element={<SimuladoresApp />} />
        <Route path="panel/portal/*" element={<SiteApp />} />
        <Route path="panel/admin" element={<AdminWorkspace />} />
        <Route path="proyectos" element={<Navigate to="/panel/proyectos" replace />} />
        <Route path="dece" element={<Navigate to="/panel/dece" replace />} />
        <Route path="simuladores" element={<Navigate to="/panel/simuladores" replace />} />
        <Route path="portal/*" element={<SiteApp />} />
        <Route path="admin" element={<Navigate to="/panel/admin" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TenantProvider>
          <AppRoutes />
        </TenantProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
