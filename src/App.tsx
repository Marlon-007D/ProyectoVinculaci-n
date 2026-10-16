import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './core/AuthContext';
import { TenantProvider, useTenant } from './core/TenantContext';
import { ModuleGate } from './core/ModuleGate';
import { SessionProvider } from './core/auth/session';
import { supabase } from './core/supabaseClient';
import { MfaEnrollment, SuperAdminPanel, UserManagement } from './modules/admin';
import { ProjectsWorkspace } from './modules/projects/ProjectsWorkspace';
import { DeceApp, DeceDataProvider } from './modules/dece';
import { PortalEditor } from './modules/portal-editor/PortalEditor';
import { PublishedPortal } from './modules/portal-editor/PublishedPortal';
import { PublicLearning } from './modules/portal-editor/PublicLearning';
import { PublicProjects } from './modules/projects/PublicProjects';
import { SimuladoresApp } from './app/SimuladoresApp';
import { InstitutionalLayout } from './components/layout/InstitutionalLayout';
import { InstitutionalPanel } from './pages/InstitutionalPanel';
import { NotFoundPage } from './pages/NotFoundPage';
import './App.css';

function AccessScreen() {
  const { login, register, requestLoginLink, requestPasswordReset } = useAuth();
  const [accessType, setAccessType] = useState<'superadmin' | 'institutional'>('institutional');
  const [loginMethod, setLoginMethod] = useState<'password' | 'email_totp'>('password');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [loginLinkSent, setLoginLinkSent] = useState(false);
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
      if (!registerMode && loginMethod === 'email_totp') {
        const result = await requestLoginLink(email.trim().toLowerCase());
        if (result.error) setError(`No se pudo enviar el enlace de acceso: ${result.error.message}`);
        else setLoginLinkSent(true);
        return;
      }
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
    <main className="relative isolate grid min-h-[82vh] place-items-center overflow-hidden bg-[radial-gradient(ellipse_at_18%_12%,#dff0ee_0,transparent_34%),radial-gradient(ellipse_at_88%_84%,#e4edfa_0,transparent_32%),#f4f7f9] px-4 py-8 sm:px-6 lg:py-12">
      <div aria-hidden="true" className="pointer-events-none absolute -left-20 top-1/3 size-64 rounded-full bg-[#62b8a8]/10 blur-3xl" />
      <div className="relative mx-auto grid w-full max-w-6xl overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_32px_100px_rgba(10,35,63,0.14)] lg:min-h-[690px] lg:grid-cols-[0.92fr_1.08fr]">
      <aside className="relative hidden overflow-hidden bg-[linear-gradient(145deg,#0a233f_0%,#103d5d_58%,#14665f_130%)] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-12">
        <div aria-hidden="true" className="absolute -right-24 -top-24 size-80 rounded-full border border-white/10" />
        <div aria-hidden="true" className="absolute -bottom-36 -left-28 size-96 rounded-full border border-white/10" />
        <div className="relative">
          <div className="mb-12 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl border border-white/15 bg-white/10 text-sm font-black tracking-wide shadow-lg">UE</div>
            <div><p className="text-sm font-bold tracking-wide">Plataforma Institucional</p><p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-sky-200">Educación · Vinculación</p></div>
          </div>
          <p className="mb-4 text-[10px] font-bold tracking-[0.2em] text-teal-200">UN ESPACIO, CADA INSTITUCIÓN</p>
          <h2 className="max-w-md text-4xl font-semibold leading-[1.12] tracking-tight xl:text-[42px]">Conecta la gestión educativa con cada comunidad.</h2>
          <p className="mt-5 max-w-md text-sm leading-7 text-slate-300">Accede a las herramientas de tu institución con permisos claros, una experiencia unificada y protección para cada cuenta.</p>
        </div>
        <div className="relative mt-10 rounded-2xl border border-white/10 bg-white/[0.07] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.12)] backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-teal-300/15 text-teal-200">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3 19 6v5c0 4.8-3 8.2-7 10-4-1.8-7-5.2-7-10V6l7-3Z"/><path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4"/></svg>
            </div>
            <div><p className="text-sm font-semibold">Acceso protegido por roles</p><p className="mt-1 text-xs leading-5 text-slate-300">Cada cuenta entra únicamente a las funciones que tiene asignadas.</p></div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
            {['Proyectos', 'DECE', 'Simuladores', 'Portal web'].map(item => <span key={item} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-medium text-slate-200">{item}</span>)}
          </div>
        </div>
        <p className="relative mt-8 text-[10px] tracking-wide text-slate-400">PLATAFORMA INSTITUCIONAL EDUCATIVA</p>
      </aside>
      <section className="relative w-full bg-white p-6 sm:p-10 lg:px-12 lg:py-11">
        <div className="mb-7 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="grid size-10 place-items-center rounded-xl bg-[#0a233f] text-xs font-black text-white">UE</div>
            <div><p className="text-xs font-bold text-[#173247]">Plataforma Institucional</p><p className="text-[9px] uppercase tracking-[0.14em] text-[#78909a]">Acceso seguro</p></div>
          </div>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[#dcebe5] bg-[#f3faf6] px-3 py-1.5 text-[10px] font-semibold text-[#31735e]">
            <span className="size-1.5 rounded-full bg-[#48a77c]" /> Conexión protegida
          </span>
        </div>
        <div className="mb-6">
          <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#398278]">PORTAL INSTITUCIONAL</p>
          <h1 className="font-sans text-[27px] font-semibold leading-tight tracking-[-0.035em] text-[#102d42] sm:text-[30px]">{registerMode ? 'Crea tu cuenta' : accessType === 'superadmin' ? 'Ingreso de superadministrador' : 'Bienvenido de nuevo'}</h1>
          <p className="mt-2 max-w-md text-[13px] leading-6 text-[#73848d]">{registerMode ? 'Registra tus datos; los permisos se habilitan cuando te asignen un rol.' : accessType === 'superadmin' ? 'Administra instituciones y asigna roles desde el acceso global.' : 'Ingresa de forma segura al espacio y las herramientas de tu institución.'}</p>
        </div>
        <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl bg-[#f3f7f8] p-1.5">
          <button type="button" aria-pressed={accessType === 'superadmin'} onClick={() => { setAccessType('superadmin'); setRegisterMode(false); setError(''); }} className={`rounded-lg px-3 py-3 text-left transition ${accessType === 'superadmin' ? 'bg-white text-[#0a233f] shadow-sm ring-1 ring-[#dce6ea]' : 'text-[#657981] hover:bg-white/70'}`}>
            <span className="block text-xs font-bold">Superadministrador</span>
            <span className="mt-1 block text-[10px] leading-relaxed">Acceso global</span>
          </button>
          <button type="button" aria-pressed={accessType === 'institutional'} onClick={() => { setAccessType('institutional'); setError(''); }} className={`rounded-lg px-3 py-3 text-left transition ${accessType === 'institutional' ? 'bg-white text-[#0a233f] shadow-sm ring-1 ring-[#dce6ea]' : 'text-[#657981] hover:bg-white/70'}`}>
            <span className="block text-xs font-bold">Acceso institucional</span>
            <span className="mt-1 block text-[10px] leading-relaxed">Ingreso por rol asignado</span>
          </button>
        </div>
        {!registerMode && <>
          <p className="mb-2 text-[10px] font-bold tracking-[0.12em] text-[#647b84]">ELIGE CÓMO INICIAR SESIÓN</p>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={loginMethod === 'password'} onClick={() => { setLoginMethod('password'); setLoginLinkSent(false); setError(''); }} className={`rounded-xl border p-3 text-left transition ${loginMethod === 'password' ? 'border-[#6a91b5] bg-[#f3f8fc] text-[#0a233f] shadow-[0_4px_14px_rgba(10,35,63,0.06)]' : 'border-[#dce6ea] text-[#657981] hover:bg-[#f8fafb]'}`}>
              <span className="block text-xs font-bold">Contraseña</span><span className="mt-1 block text-[10px] leading-4 opacity-75">Ingreso directo</span>
            </button>
            <button type="button" aria-pressed={loginMethod === 'email_totp'} onClick={() => { setLoginMethod('email_totp'); setLoginLinkSent(false); setError(''); }} className={`rounded-xl border p-3 text-left transition ${loginMethod === 'email_totp' ? 'border-[#6a91b5] bg-[#f3f8fc] text-[#0a233f] shadow-[0_4px_14px_rgba(10,35,63,0.06)]' : 'border-[#dce6ea] text-[#657981] hover:bg-[#f8fafb]'}`}>
              <span className="block text-xs font-bold">Correo + TOTP</span><span className="mt-1 block text-[10px] leading-4 opacity-75">Enlace seguro y app</span>
            </button>
          </div>
          {loginMethod === 'email_totp' && <p className="mb-3 rounded-lg border border-[#d5e2ee] bg-[#f4f8fc] px-3 py-2.5 text-xs leading-relaxed text-[#526b82]">Te enviaremos un enlace al correo. Al abrirlo, confirmarás el primer paso y luego ingresarás el código de tu app autenticadora.</p>}
        </>}
        <form onSubmit={registerMode ? submitRegistration : submit} className="flex flex-col gap-2">
          {registerMode && <>
            <label htmlFor="register-first-name" className="mt-2 text-[13px] font-semibold text-[#314953]">Nombres</label>
            <input id="register-first-name" type="text" autoComplete="given-name" value={firstName} onChange={event => setFirstName(event.target.value)} required className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46]" placeholder="Nombres" />
            <label htmlFor="register-last-name" className="mt-2 text-[13px] font-semibold text-[#314953]">Apellidos</label>
            <input id="register-last-name" type="text" autoComplete="family-name" value={lastName} onChange={event => setLastName(event.target.value)} required className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46]" placeholder="Apellidos" />
          </>}
          <label htmlFor="email" className="mt-2 text-[13px] font-semibold text-[#314953]">Correo electrónico</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46] focus-visible:outline" placeholder="admin@institucion.edu.ec" />
          {(registerMode || loginMethod === 'password') && <>
          <label htmlFor="password" className="mt-2 text-[13px] font-semibold text-[#314953]">Contraseña</label>
          <div className="relative">
            <input id="password" type={showPassword ? 'text' : 'password'} autoComplete={registerMode ? 'new-password' : 'current-password'} minLength={registerMode ? 8 : undefined} value={password} onChange={event => setPassword(event.target.value)} required className="h-11 w-full rounded-lg border border-[#d8e1e4] bg-white px-3 pr-12 text-[#243c46]" placeholder="••••••••" />
            <button type="button" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)} className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#647b84] hover:text-[#0a233f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#398278]">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.6"/><path strokeLinecap="round" d="m4 4 16 16" className={showPassword ? 'hidden' : ''}/></svg>
            </button>
          </div>
          </>}
          {registerMode && <>
            <label htmlFor="confirm-register-password" className="mt-2 text-[13px] font-semibold text-[#314953]">Confirmar contraseña</label>
            <input id="confirm-register-password" type="password" autoComplete="new-password" minLength={8} value={confirmation} onChange={event => setConfirmation(event.target.value)} required className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46]" />
          </>}
          {error && <p role="alert" className="rounded-lg border border-[#f2d1ce] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#9b3838]">{error}</p>}
          {expiredAuthLink && <p role="alert" className="rounded-lg border border-[#f2d1ce] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#9b3838]">Ese enlace vencio o ya se uso. Solicita uno nuevo desde Recuperar contrasena.</p>}
          {resetSent && <p role="status" className="rounded-lg border border-[#cce7df] bg-[#f0faf6] px-4 py-3 text-[13px] text-[#286b58]">Si la cuenta existe, recibiras un enlace para crear una contrasena nueva. Revisa tambien spam; los enlaces anteriores pueden vencer al solicitar otro.</p>}
          {registered && <p role="status" className="rounded-lg border border-[#d5e2ee] bg-[#f3f8fc] px-4 py-3 text-[13px] text-[#245b88]">{registrationNotice}</p>}
          {loginLinkSent && <p role="status" className="rounded-lg border border-[#cce7df] bg-[#f0faf6] px-4 py-3 text-[13px] text-[#286b58]">Enlace enviado. Revisa tu correo y abre el enlace en este navegador; después escribe el código actual de tu app autenticadora.</p>}
          <button disabled={busy} className="mt-1 h-[45px] rounded-lg bg-brand font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-wait disabled:opacity-65">
            {busy ? 'Procesando…' : registerMode ? 'Crear cuenta' : loginMethod === 'email_totp' ? 'Enviar enlace de acceso' : 'Iniciar sesión'}
          </button>
        </form>
        {!registerMode && <button type="button" disabled={busy} onClick={() => void sendResetLink()} className="mt-4 w-full text-center text-sm font-semibold text-brand underline-offset-4 hover:underline disabled:opacity-60">¿Olvidaste tu contraseña? Recuperar por correo</button>}
        {accessType === 'institutional' && <button type="button" disabled={busy} onClick={() => { setRegisterMode(value => !value); setLoginMethod('password'); setLoginLinkSent(false); setError(''); setRegistered(false); setResetSent(false); setConfirmation(''); }} className="mt-3 w-full text-center text-sm font-semibold text-brand underline-offset-4 hover:underline disabled:opacity-60">
          {registerMode ? 'Ya tengo cuenta; iniciar sesión' : '¿Aún no tienes cuenta? Regístrate'}
        </button>}
        {accessType === 'institutional' && <p className="mb-0 mt-5 text-center text-[11px] text-[#8b989d]">El registro no asigna permisos automáticamente.</p>}
      </section>
      </div>
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
      <Route path="portal/*" element={<PublishedPortal />} />
      <Route path="proyectos" element={<PublicProjects />} />
      <Route path="simuladores" element={<PublicLearning />} />
      <Route element={<InstitutionalLayout />}>
        <Route index element={<Navigate to="/panel" replace />} />
        <Route path="inicio" element={<Navigate to="/panel" replace />} />
        <Route path="panel" element={<ModuleGate moduleName="inicio"><InstitutionalPanel /></ModuleGate>} />
        <Route path="panel/proyectos" element={<ModuleGate moduleName="projects"><ProjectsPageWrapper /></ModuleGate>} />
        <Route path="panel/dece" element={<ModuleGate moduleName="dece"><DecePageWrapper /></ModuleGate>} />
        <Route path="panel/simuladores" element={<ModuleGate moduleName="simuladores"><SimuladoresApp /></ModuleGate>} />
        <Route path="panel/portal/*" element={<ModuleGate moduleName="portal"><PortalEditor /></ModuleGate>} />
        <Route path="panel/admin" element={<AdminWorkspace />} />
        <Route path="dece" element={<Navigate to="/panel/dece" replace />} />
        <Route path="admin" element={<Navigate to="/panel/admin" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ApplicationRoutes />
    </BrowserRouter>
  );
}

const RESERVED_TOP_LEVEL_SEGMENTS = new Set([
  'admin', 'panel', 'inicio', 'proyectos', 'dece', 'simuladores', 'portal',
]);
const SLUG_SESSION_SEGMENTS = new Set(['login', 'dece', 'mi-ficha', 'admin', 'sin-modulos']);

function ApplicationRoutes() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);
  const [firstSegment, secondSegment] = segments;
  const hasSlugSessionRoute = Boolean(
    firstSegment
    && secondSegment
    && !RESERVED_TOP_LEVEL_SEGMENTS.has(firstSegment.toLowerCase())
    && SLUG_SESSION_SEGMENTS.has(secondSegment.toLowerCase())
    && (['dece', 'mi-ficha', 'admin'].includes(secondSegment.toLowerCase())
      || segments.length === 2),
  );

  return (
    <AuthProvider>
      <TenantProvider>
        {hasSlugSessionRoute
          ? <InstitutionalLayout><SessionProvider /></InstitutionalLayout>
          : <AppRoutes />}
      </TenantProvider>
    </AuthProvider>
  );
}
