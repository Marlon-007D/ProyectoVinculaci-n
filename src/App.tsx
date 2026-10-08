import { useState, type FormEvent } from 'react';
import { AuthProvider, useAuth } from './core/AuthContext';
import { TenantProvider } from './core/TenantContext';
import { MfaEnrollment, SuperAdminPanel, UserManagement } from './modules/admin';

function AccessScreen() {
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
        setError('No se pudo iniciar sesión. Verifica tus datos e inténtalo de nuevo.');
      }
    } catch {
      setError('No fue posible conectar con el servicio. Inténtalo nuevamente más tarde.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_50%_20%,#e6f1ef_0,transparent_55%),#f4f7f9] p-6">
      <section className="w-full max-w-[430px] rounded-[18px] border border-[#e4ebed] bg-white p-7 shadow-[0_16px_50px_#18384412] sm:p-[38px]">
        <div aria-hidden="true" className="mb-6 grid size-12 place-items-center rounded-[15px] bg-brand font-bold text-white shadow-[0_6px_16px_#145b5825]">V</div>
        <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#398278]">PLATAFORMA INSTITUCIONAL</p>
        <h1 className="mb-2 font-sans text-[25px] font-bold leading-tight tracking-tight text-ink">Gestión de Vinculación</h1>
        <p className="mb-6 text-sm leading-relaxed text-muted">Ingresa con las credenciales de tu cuenta institucional.</p>
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="email" className="mt-2 text-[13px] font-semibold text-[#314953]">Correo electrónico</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} required className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46] focus-visible:outline" />
          <label htmlFor="password" className="mt-2 text-[13px] font-semibold text-[#314953]">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required className="h-11 rounded-lg border border-[#d8e1e4] bg-white px-3 text-[#243c46]" />
          {error && <p role="alert" className="rounded-lg border border-[#f2d1ce] bg-[#fff1f0] px-4 py-3 text-[13px] text-[#9b3838]">{error}</p>}
          <button disabled={busy} className="mt-3 h-[45px] rounded-lg bg-brand font-bold text-white transition-colors hover:bg-brand-dark disabled:cursor-wait disabled:opacity-65">
            {busy ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>
        <p className="mb-0 mt-[22px] text-center text-[11px] text-[#8b989d]">Acceso exclusivo para personal autorizado</p>
      </section>
    </main>
  );
}

function Workspace() {
  const { user, role, roleError, loading, logout } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center gap-3 text-sm text-[#53656e]">
        <span className="size-[17px] animate-spin rounded-full border-2 border-[#dce7e7] border-t-[#398278]" />
        Comprobando sesión…
      </main>
    );
  }

  if (!user) return <AccessScreen />;

  return (
    <main className="mx-auto max-w-[1180px] px-4 pb-6 sm:px-[30px]">
      <header className="flex h-[66px] items-center justify-between border-b border-line sm:h-[76px]">
        <div className="flex items-center gap-3 font-bold text-[#163a43]">
          <span className="grid size-[38px] place-items-center rounded-xl bg-brand text-lg font-bold text-white shadow-[0_6px_16px_#145b5825]">V</span>
          <span>Vinculación<small className="block text-[11px] font-medium tracking-normal text-[#71818a]">Gestión institucional</small></span>
        </div>
        <div className="flex items-center gap-2 sm:gap-[18px]">
          <span className="hidden text-[13px] text-[#53656e] sm:inline">{user.email}</span>
          <button onClick={() => void logout()} className="rounded-lg border border-[#d8e1e4] bg-white px-3 py-2 text-sm font-semibold text-[#314953]">Cerrar sesión</button>
        </div>
      </header>

      <section className="py-[26px] sm:pb-[18px] sm:pt-[34px]">
        <p className="mb-2 text-[10px] font-bold tracking-[0.16em] text-[#398278]">ESPACIO DE ADMINISTRACIÓN</p>
        <h1 className="mb-2 text-[26px] font-bold tracking-tight text-ink sm:text-3xl">Panel de gestión</h1>
        <p className="mb-0 text-sm text-muted">Administra las instituciones, los accesos y la seguridad de la plataforma.</p>
      </section>

      {role === 'super_admin' ? (
        <><SuperAdminPanel /><UserManagement /><MfaEnrollment /></>
      ) : (
        <section className="mt-4 rounded-lg border border-[#eadfc4] bg-white p-4 text-[13px] text-[#65573c]">
          <strong>Acceso restringido</strong>
          <p className="my-1 text-sm">{roleError ?? 'Tu cuenta no tiene permisos de superadministración. Si necesitas acceso, comunícate con el responsable de la plataforma.'}</p>
          <span className="text-xs text-[#827657]">Rol asignado: {role || 'sin asignar'}</span>
        </section>
      )}

      <footer className="mt-7 border-t border-line pt-5 text-xs text-[#819098]">
        Plataforma de Gestión de Vinculación <span className="px-1 text-[#48a294]">·</span> Acceso seguro
      </footer>
    </main>
  );
}

function App() {
  return <AuthProvider><TenantProvider><Workspace /></TenantProvider></AuthProvider>;
}

export default App;
