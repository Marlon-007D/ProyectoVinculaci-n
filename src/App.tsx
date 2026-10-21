import AdminRoutes from './modules/admin/AdminRoutes';
import { RegistrationRoute } from './modules/auth/RegistrationRoute';
import { useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/AuthContext';
import { TenantProvider, useTenant, type InstitutionModuleName } from './core/TenantContext';
import { supabase } from './core/supabaseClient';
import { MfaEnrollment, SuperAdminPanel, UserManagement } from './modules/admin';
import { ProjectsWorkspace } from './modules/projects/ProjectsWorkspace';
import { DeceApp, DeceDataProvider } from './modules/dece';
import { SiteApp } from './modules/site';
import { SimuladoresApp } from './app/SimuladoresApp';
import { InstitutionalLayout } from './components/layout/InstitutionalLayout';
import { InstitutionalPanel } from './pages/InstitutionalPanel';
import { NotFoundPage } from './pages/NotFoundPage';
import './App.css';

function AccessScreen() {
  return <AdminRoutes />;
}

function PasswordRecoveryScreen() {
  const { updatePassword, logout, mfaRequired, mfaChallengeReady, verifyMfa } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  async function verifyRecoveryCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await verifyMfa(code);
    setBusy(false);
    if (result.error) setError('El código no es válido o venció. Revisa tu aplicación autenticadora.');
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (password.length < 8) return setError('Usa al menos 8 caracteres.');
    if (password !== confirmation) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.error) setError(result.error.message);
    else setSaved(true);
  }

  return (
    <main className="grid min-h-[80vh] place-items-center bg-[radial-gradient(ellipse_at_50%_20%,#e6f1ef_0,transparent_55%),#f4f7f9] p-6">
      <section className="w-full max-w-[430px] rounded-[18px] border border-[#e4ebed] bg-white p-7 shadow-[0_16px_50px_#18384412] sm:p-[38px]">
        <div aria-hidden="true" className="mb-6 grid size-12 place-items-center rounded-[15px] bg-brand font-bold text-white">V</div>
        <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#398278]">SEGURIDAD DE LA CUENTA</p>
        <h1 className="mb-2 text-[25px] font-bold tracking-tight text-ink">Nueva contraseña</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted">{mfaRequired ? 'Confirma tu identidad con el código de tu aplicación autenticadora para continuar con la recuperación.' : 'Crea una contraseña nueva para recuperar el acceso.'}</p>
        {mfaRequired ? (
          mfaChallengeReady ? <form onSubmit={verifyRecoveryCode} className="flex flex-col gap-3">
            <label htmlFor="recovery-totp" className="text-[13px] font-semibold text-[#314953]">Código de seis dígitos</label>
            <input id="recovery-totp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required className="h-12 rounded-lg border border-[#d8e1e4] px-3 text-center text-lg tracking-[.3em]" />
            {error && <p role="alert" className="rounded-lg border border-[#f2d1ce] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#9b3838]">{error}</p>}
            <button disabled={busy || code.length !== 6} className="h-[45px] rounded-lg bg-brand font-bold text-white hover:bg-brand-dark disabled:opacity-65">{busy ? 'Verificando…' : 'Verificar identidad'}</button>
          </form> : <p role="alert" className="rounded-lg border border-[#f2d1ce] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#9b3838]">No se pudo iniciar la verificación. Vuelve a solicitar el enlace e inténtalo de nuevo.</p>
        ) : <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="new-password" className="text-[13px] font-semibold text-[#314953]">Contraseña nueva</label>
          <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} className="h-11 rounded-lg border border-[#d8e1e4] px-3" />
          <label htmlFor="confirm-password" className="text-[13px] font-semibold text-[#314953]">Confirmar contraseña</label>
          <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={event => setConfirmation(event.target.value)} className="h-11 rounded-lg border border-[#d8e1e4] px-3" />
          {error && <p role="alert" className="rounded-lg border border-[#f2d1ce] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#9b3838]">{error}</p>}
          {saved && <p role="status" className="rounded-lg border border-[#cce7df] bg-[#f0faf6] px-4 py-3 text-[13px] text-[#286b58]">Contraseña actualizada. Cierra esta sesión y entra con la nueva contraseña.</p>}
          {!saved && <button disabled={busy} className="mt-2 h-[45px] rounded-lg bg-brand font-bold text-white hover:bg-brand-dark disabled:opacity-65">{busy ? 'Guardando…' : 'Guardar contraseña'}</button>}
          {saved && <button type="button" onClick={() => void logout()} className="h-[45px] rounded-lg bg-brand font-bold text-white">Volver al inicio de sesión</button>}
        </form>}
      </section>
    </main>
  );
}

export function AdminWorkspace() {
  const { user, role, roleError, loading, isPasswordRecovery } = useAuth();
  const location = useLocation();
  const isSuperAdminRoute = location.pathname.startsWith('/panel/superadmin') || location.pathname.startsWith('/system-admin');

  if (isPasswordRecovery) return <PasswordRecoveryScreen />;

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

  if (roleError) return <main className="mx-auto max-w-2xl px-4 py-12"><section className="rounded-xl border border-[#eadfc4] bg-white p-5 text-sm text-[#65573c] shadow-sm"><h1 className="mb-2 text-lg font-bold text-ink">No se pudo verificar tu acceso</h1><p className="mb-0">{roleError}</p></section></main>;
  if (!role) return <div className="flex min-h-[40vh] items-center justify-center gap-3 text-sm text-[#53656e]"><span className="size-[17px] animate-spin rounded-full border-2 border-[#dce7e7] border-t-[#398278]" />Verificando permisos…</div>;
  if (role === 'super_admin' && !isSuperAdminRoute) return <Navigate to="/panel/superadmin" replace />;
  if (role !== 'super_admin' && isSuperAdminRoute) return <Navigate to="/panel/admin" replace />;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-[30px]">
      {role !== 'super_admin' && (
        <section className="py-[16px] sm:pb-[18px]">
          <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#398278]">ESPACIO DE ADMINISTRACIÓN</p>
          <h1 className="mb-2 text-[26px] font-bold tracking-tight text-ink sm:text-3xl">Panel de gestión</h1>
          <p className="mb-0 text-sm text-muted">Administra los permisos de acceso de tu institución.</p>
        </section>
      )}

      {role === 'super_admin' ? (
        <div className="space-y-6">
          <SuperAdminPanel />
          <UserManagement />
        </div>
      ) : role === 'institution_admin' ? (
        <div className="space-y-5">
          <section className="rounded-xl border border-[#dcebe7] bg-white p-5 shadow-sm">
            <p className="mb-1 text-[10px] font-bold tracking-[0.15em] text-[#398278]">ADMINISTRACIÓN INSTITUCIONAL</p>
            <h2 className="mb-2 text-lg font-bold text-ink">Tu espacio de administración</h2>
            <p className="mb-0 text-sm text-muted">Tu cuenta administra únicamente la institución asignada. Los cambios de roles quedan limitados a esa unidad educativa.</p>
          </section>
          <UserManagement />
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

function MfaChallengeScreen() {
  const { user, verifyMfa, logout, mfaChallengeReady } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const result = await verifyMfa(code.replace(/\s/g, ''));
    setBusy(false);
    if (result.error) setError('El código no es válido o venció. Revisa tu aplicación e inténtalo de nuevo.');
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f7f9] p-5">
      <section className="w-full max-w-[430px] rounded-[18px] border border-[#e4ebed] bg-white p-7 shadow-[0_16px_50px_#18384412] sm:p-[38px]">
        <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#398278]">VERIFICACIÓN DE CUENTA</p>
        <h1 className="mb-2 text-2xl font-bold tracking-tight text-ink">Confirma tu identidad</h1>
        <p className="mb-5 text-sm leading-relaxed text-muted">Escribe el código temporal de seis dígitos de tu aplicación autenticadora para continuar como {user?.email}.</p>
        {mfaChallengeReady ? <form onSubmit={submit} className="flex flex-col gap-3">
          <label htmlFor="login-totp" className="text-[13px] font-semibold text-[#314953]">Código de verificación</label>
          <input id="login-totp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required className="h-12 rounded-lg border border-[#d8e1e4] px-3 text-center text-lg tracking-[.3em]" />
          {error && <p role="alert" className="rounded-lg border border-[#f2d1ce] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#9b3838]">{error}</p>}
          <button disabled={busy || code.length !== 6} className="h-[45px] rounded-lg bg-brand font-bold text-white hover:bg-brand-dark disabled:opacity-60">{busy ? 'Verificando…' : 'Verificar y continuar'}</button>
        </form> : <p role="alert" className="rounded-lg border border-[#f2d1ce] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#9b3838]">No fue posible iniciar la verificación ahora. Cierra sesión e inténtalo de nuevo.</p>}
        <button type="button" onClick={() => void logout()} className="mt-4 w-full text-center text-sm font-semibold text-brand underline-offset-4 hover:underline">Cerrar sesión</button>
      </section>
    </main>
  );
}

function ProjectsPageWrapper() {
  const navigate = useNavigate();
  return <ProjectsWorkspace onLogin={() => navigate('/panel/admin')} />;
}

function ModuleGate({ moduleName, children }: { moduleName: InstitutionModuleName; children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { activeInstitution, loadingTenant, modulePermissionError, hasModuleAccess } = useTenant();
  if (moduleName === 'inicio' && !authLoading && !user) return <Navigate to="/panel/admin" replace />;
  if (loadingTenant) return <div className="mx-auto max-w-3xl p-8 text-sm text-slate-600">Cargando permisos de la institucion...</div>;
  if (!activeInstitution) {
    if (moduleName === 'inicio') return <Navigate to="/panel/admin" replace />;
    return <div className="mx-auto max-w-3xl p-8 text-sm text-slate-600">No hay una institución activa disponible para esta cuenta.</div>;
  }
  if (modulePermissionError) return <div className="mx-auto max-w-3xl p-8"><section role="alert" className="rounded-xl border border-rose-200 bg-white p-6 text-sm text-rose-800">{modulePermissionError}</section></div>;
  if (!hasModuleAccess(moduleName)) {
    return <div className="mx-auto max-w-3xl p-8"><section className="rounded-xl border border-amber-200 bg-white p-6 text-sm text-amber-900">Este modulo no esta habilitado para {activeInstitution.name}. Solicita al superadministrador que lo active.</section></div>;
  }
  return <>{children}</>;
}

function DecePageWrapper() {
  const { activeInstitution } = useTenant();
  const integration = useMemo(() => {
    if (!activeInstitution) return null;
    return {
      client: supabase,
      institutionId: activeInstitution.institution_id,
      getStudentId: (student: { recordId?: string }) => student.recordId ?? null,
    };
  }, [activeInstitution]);

  if (!integration) {
    return (
      <div className="mx-auto max-w-3xl p-8 text-sm text-slate-600">
        No hay una institución activa disponible para esta cuenta.
      </div>
    );
  }

  return (
    <DeceDataProvider value={integration}>
      <DeceApp />
    </DeceDataProvider>
  );
}

function TenantSiteApp() {
  const { activeInstitution } = useTenant();
  if (!activeInstitution) return <Navigate to="/panel/admin" replace />;
  return <SiteApp institutionId={activeInstitution.institution_id} />;
}

function AppRoutes() {
  const { user, isPasswordRecovery, mfaRequired, mfaEnrollmentRequired, completeMfaEnrollment } = useAuth();

  if (isPasswordRecovery) return <PasswordRecoveryScreen />;
  if (user && mfaRequired) return <MfaChallengeScreen />;
  if (user && mfaEnrollmentRequired) return <MfaEnrollment onEnrolled={completeMfaEnrollment} />;

  return (
    <Routes>
      <Route path="register" element={<RegistrationRoute />} />
      <Route path="panel/admin" element={<AdminRoutes />} />
      <Route path="panel/superadmin" element={<AdminRoutes superadminOnly />} />
      <Route element={<InstitutionalLayout />}>
        <Route index element={<Navigate to="/panel/admin" replace />} />
        <Route path="inicio" element={<Navigate to="/panel" replace />} />
        <Route path="panel" element={<ModuleGate moduleName="inicio"><InstitutionalPanel /></ModuleGate>} />
        <Route path="panel/proyectos" element={<ModuleGate moduleName="projects"><ProjectsPageWrapper /></ModuleGate>} />
        <Route path="panel/dece" element={<ModuleGate moduleName="dece"><DecePageWrapper /></ModuleGate>} />
        <Route path="panel/simuladores" element={<ModuleGate moduleName="simuladores"><SimuladoresApp /></ModuleGate>} />
        <Route path="panel/portal/*" element={<ModuleGate moduleName="portal"><TenantSiteApp /></ModuleGate>} />
        <Route path="system-admin" element={<Navigate to="/panel/superadmin" replace />} />
        <Route path="proyectos" element={<Navigate to="/panel/proyectos" replace />} />
        <Route path="dece" element={<Navigate to="/panel/dece" replace />} />
        <Route path="simuladores" element={<Navigate to="/panel/simuladores" replace />} />
        <Route path="portal/*" element={<ModuleGate moduleName="portal"><TenantSiteApp /></ModuleGate>} />
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
