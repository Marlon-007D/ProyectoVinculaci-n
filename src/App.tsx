import { useState, type FormEvent } from 'react';
import { AuthProvider, useAuth } from './core/AuthContext';
import { TenantProvider } from './core/TenantContext';
import { MfaEnrollment, SuperAdminPanel, UserManagement } from './modules/admin';
import './App.css';

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
      if (result.error) setError('No se pudo iniciar sesión. Verifica tus datos e inténtalo de nuevo.');
    } catch {
      setError('No fue posible conectar con el servicio. Inténtalo nuevamente más tarde.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="access-page"><section className="access-card">
    <div className="brand-mark" aria-hidden="true">V</div>
    <p className="eyebrow">PLATAFORMA INSTITUCIONAL</p>
    <h1>Gestión de Vinculación</h1>
    <p className="access-copy">Ingresa con las credenciales de tu cuenta institucional.</p>
    <form onSubmit={submit} className="access-form">
      <label htmlFor="email">Correo electrónico</label>
      <input id="email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
      <label htmlFor="password">Contraseña</label>
      <input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
      {error && <p className="notice error" role="alert">{error}</p>}
      <button className="primary-button" disabled={busy}>{busy ? 'Ingresando…' : 'Iniciar sesión'}</button>
    </form>
    <p className="access-foot">Acceso exclusivo para personal autorizado</p>
  </section></main>;
}

function Workspace() {
  const { user, role, loading, logout } = useAuth();
  if (loading) return <main className="loading-screen"><span className="spinner" />Comprobando sesión…</main>;
  if (!user) return <AccessScreen />;
  return <main className="workspace">
    <header className="topbar"><a className="wordmark" href="#inicio"><span className="brand-mark small">V</span><span>Vinculación <small>Gestión institucional</small></span></a>
      <div className="account"><span className="account-email">{user.email}</span><button className="quiet-button" onClick={() => void logout()}>Cerrar sesión</button></div>
    </header>
    <section className="welcome" id="inicio"><p className="eyebrow">ESPACIO DE ADMINISTRACIÓN</p><h1>Panel de gestión</h1><p>Administra las instituciones, los accesos y la seguridad de la plataforma.</p></section>
    {role === 'superadmin' ? <><SuperAdminPanel /><UserManagement /><MfaEnrollment /></> : <section className="notice warning"><strong>Acceso restringido</strong><p>Tu cuenta no tiene permisos de superadministración. Si necesitas acceso, comunícate con el responsable de la plataforma.</p><span>Rol asignado: {role || 'sin asignar'}</span></section>}
    <footer className="footer">Plataforma de Gestión de Vinculación <span>·</span> Acceso seguro</footer>
  </main>;
}

function App() {
  return <AuthProvider><TenantProvider><Workspace /></TenantProvider></AuthProvider>;
}

export default App;
