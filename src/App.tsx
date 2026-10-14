import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/AuthContext';
import { TenantProvider, useTenant } from './core/TenantContext';
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
  const { login, register, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [registerMode, setRegisterMode] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [registered, setRegistered] = useState(false);
  const [expiredAuthLink, setExpiredAuthLink] = useState(false);
  const [registrationNotice, setRegistrationNotice] = useState('');

  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.slice(1));
    if (params.get('error_code') === 'otp_expired' || params.get('error') === 'access_denied') {
      setExpiredAuthLink(true);
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await login(email.trim(), password);
      if (result.error) {
        setError('No se pudo iniciar sesión. Verifica tus credenciales e inténtalo de nuevo.');
      }
    } catch {
      setError('No fue posible conectar con el servicio de autenticación.');
    } finally {
      setBusy(false);
    }
  }

  async function submitRegistration(event: FormEvent) {
    event.preventDefault();
    setError('');
    setRegistered(false);
    setRegistrationNotice('');
    if (!firstName.trim() || !lastName.trim()) return setError('Escribe tus nombres y apellidos.');
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.');
    if (password !== confirmation) return setError('Las contraseñas no coinciden.');
    setBusy(true);
    try {
      const result = await register(email.trim().toLowerCase(), password, firstName, lastName);
      if (result.error) {
        const detail = result.error.message;
        const normalizedDetail = detail.toLowerCase();
        if (normalizedDetail.includes('already registered') || normalizedDetail.includes('already been registered')) {
          setError('Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.');
        } else {
          setError(`No se pudo completar el registro: ${detail}`);
        }
      }
      else {
        setRegistered(true);
        setRegistrationNotice(result.existingAccount
          ? result.confirmationRequired
            ? 'La cuenta ya existe y su correo todavía está pendiente de confirmación. Revisa tu bandeja y spam.'
            : 'La cuenta ya existe y la contraseña es correcta. Puedes iniciar sesión.'
          : 'Cuenta registrada. Confirma el correo recibido; después, el superadministrador podrá asignarte un rol.');
      }
    } catch {
      setError('No fue posible conectar con el servicio de registro.');
    } finally {
      setBusy(false);
    }
  }

  async function sendResetLink() {
    if (!email.trim()) {
      setError('Escribe tu correo institucional para solicitar el enlace de recuperación.');
      return;
    }
    setBusy(true);
    setError('');
    setResetSent(false);
    try {
      const result = await requestPasswordReset(email.trim());
      if (result.error) setError(result.error.message);
      else setResetSent(true);
    } catch {
      setError('No se pudo enviar la solicitud. Revisa la conexión e inténtalo otra vez.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-[80vh] place-items-center bg-[radial-gradient(ellipse_at_50%_20%,#e6f1ef_0,transparent_55%),#f4f7f9] p-6">
      <section className="w-full max-w-[430px] rounded-[18px] border border-[#e4ebed] bg-white p-7 shadow-[0_16px_50px_#18384412] sm:p-[38px]">
        <div aria-hidden="true" className="mb-6 grid size-12 place-items-center rounded-[15px] bg-brand font-bold text-white shadow-[0_6px_16px_#145b5825]">V</div>
        <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#398278]">ACCESO INSTITUCIONAL</p>
        <h1 className="mb-2 font-sans text-[25px] font-bold leading-tight tracking-tight text-ink">{registerMode ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted">{registerMode ? 'Registra tu cuenta. El acceso de administración se habilita cuando te asignen un rol.' : 'Ingresa con la cuenta que te asignó el responsable de tu institución.'}</p>
        <form onSubmit={registerMode ? submitRegistration : submit} className="flex flex-col gap-2">
          {registerMode && <>
            <label htmlFor="register-first-name" className="mt-2 text-[13px] font-semibold text-[#314953]">Nombres</label>
            <input id="register-first-name" type="text" autoComplete="given-name" value={firstName} onChange={event => setFirstName(event.target.value)} required className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46]" placeholder="Nombres" />
            <label htmlFor="register-last-name" className="mt-2 text-[13px] font-semibold text-[#314953]">Apellidos</label>
            <input id="register-last-name" type="text" autoComplete="family-name" value={lastName} onChange={event => setLastName(event.target.value)} required className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46]" placeholder="Apellidos" />
          </>}
          <label htmlFor="email" className="mt-2 text-[13px] font-semibold text-[#314953]">Correo electrónico</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46] focus-visible:outline" placeholder="admin@institucion.edu.ec" />
          <label htmlFor="password" className="mt-2 text-[13px] font-semibold text-[#314953]">Contraseña</label>
          <input id="password" type="password" autoComplete={registerMode ? 'new-password' : 'current-password'} minLength={registerMode ? 8 : undefined} value={password} onChange={event => setPassword(event.target.value)} required className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46]" placeholder="••••••••" />
          {registerMode && <>
            <label htmlFor="confirm-register-password" className="mt-2 text-[13px] font-semibold text-[#314953]">Confirmar contraseña</label>
            <input id="confirm-register-password" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} required className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46]" />
          </>}
          {error && <p role="alert" className="rounded-lg border border-[#f2d1ce] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#9b3838]">{error}</p>}
          {expiredAuthLink && <p role="alert" className="rounded-lg border border-[#f2d1ce] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#9b3838]">Ese enlace vencio o ya se uso. Solicita uno nuevo desde Recuperar contrasena.</p>}
          {resetSent && <p role="status" className="rounded-lg border border-[#cce7df] bg-[#f0faf6] px-4 py-3 text-[13px] text-[#286b58]">Si la cuenta existe, recibiras un enlace para crear una contrasena nueva. Revisa tambien spam; los enlaces anteriores pueden vencer al solicitar otro.</p>}
          {registered && <p role="status" className="rounded-lg border border-[#d5e2ee] bg-[#f3f8fc] px-4 py-3 text-[13px] text-[#245b88]">{registrationNotice}</p>}
          <button disabled={busy} className="mt-1 h-[45px] rounded-lg bg-brand font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-wait disabled:opacity-65">
            {busy ? 'Procesando…' : registerMode ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </form>
        {!registerMode && <button type="button" disabled={busy} onClick={() => void sendResetLink()} className="mt-4 w-full text-center text-sm font-semibold text-brand underline-offset-4 hover:underline disabled:opacity-60">¿Olvidaste tu contraseña? Recuperar por correo</button>}
        <button type="button" disabled={busy} onClick={() => { setRegisterMode(value => !value); setError(''); setRegistered(false); setResetSent(false); setConfirmation(''); }} className="mt-3 w-full text-center text-sm font-semibold text-brand underline-offset-4 hover:underline disabled:opacity-60">
          {registerMode ? 'Ya tengo cuenta; iniciar sesión' : '¿Aún no tienes cuenta? Regístrate'}
        </button>
        <p className="mb-0 mt-5 text-center text-[11px] text-[#8b989d]">El registro no asigna permisos automáticamente.</p>
      </section>
    </main>
  );
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

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-[30px]">
      <section className="py-[16px] sm:pb-[18px]">
        <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#398278]">ESPACIO DE ADMINISTRACIÓN</p>
        <h1 className="mb-2 text-[26px] font-bold tracking-tight text-ink sm:text-3xl">Panel de gestión</h1>
        <p className="mb-0 text-sm text-muted">Administra las instituciones y los permisos de acceso.</p>
      </section>

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

function ModuleGate({ moduleName, children }: { moduleName: string; children: ReactNode }) {
  const { activeInstitution, loadingTenant } = useTenant();
  if (loadingTenant) return <div className="mx-auto max-w-3xl p-8 text-sm text-slate-600">Cargando permisos de la institucion...</div>;
  if (!activeInstitution) return <div className="mx-auto max-w-3xl p-8 text-sm text-slate-600">No hay una institucion activa disponible para esta cuenta.</div>;
  if (activeInstitution.enabled_modules && !activeInstitution.enabled_modules.includes(moduleName)) {
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

function AppRoutes() {
  const { user, isPasswordRecovery, mfaRequired, mfaEnrollmentRequired, completeMfaEnrollment } = useAuth();

  if (isPasswordRecovery) return <PasswordRecoveryScreen />;
  if (user && mfaRequired) return <MfaChallengeScreen />;
  if (user && mfaEnrollmentRequired) return <MfaEnrollment onEnrolled={completeMfaEnrollment} />;

  return (
    <Routes>
      <Route element={<InstitutionalLayout />}>
        <Route index element={<Navigate to="/panel" replace />} />
        <Route path="inicio" element={<Navigate to="/panel" replace />} />
        <Route path="panel" element={<InstitutionalPanel />} />
        <Route path="panel/proyectos" element={<ModuleGate moduleName="projects"><ProjectsPageWrapper /></ModuleGate>} />
        <Route path="panel/dece" element={<ModuleGate moduleName="dece"><DecePageWrapper /></ModuleGate>} />
        <Route path="panel/simuladores" element={<ModuleGate moduleName="simuladores"><SimuladoresApp /></ModuleGate>} />
        <Route path="panel/portal/*" element={<ModuleGate moduleName="portal"><SiteApp /></ModuleGate>} />
        <Route path="panel/admin" element={<AdminWorkspace />} />
        <Route path="proyectos" element={<Navigate to="/panel/proyectos" replace />} />
        <Route path="dece" element={<Navigate to="/panel/dece" replace />} />
        <Route path="simuladores" element={<Navigate to="/panel/simuladores" replace />} />
        <Route path="portal/*" element={<ModuleGate moduleName="portal"><SiteApp /></ModuleGate>} />
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
