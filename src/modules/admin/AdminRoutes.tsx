import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/AuthContext';
import { useTenant } from '../../core/TenantContext';
import { MfaEnrollment } from './mfa/MfaEnrollment';
import { SuperAdminPanel } from './superadmin/SuperAdminPanel';
import { UserManagement } from './userManagement/UserManagement';
import styles from './AdminRoutes.module.css';

export default function AdminRoutes({ superadminOnly = false }: { superadminOnly?: boolean }) {
  const { user, role, roleError, loading, login, logout, mfaRequired, mfaEnrollmentRequired, completeMfaEnrollment, verifyMfa, mfaChallengeReady } = useAuth();
  const { activeInstitution, loadingTenant } = useTenant();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !role || loading || mfaRequired || mfaEnrollmentRequired || loadingTenant) return;
    if (role === 'super_admin') {
      if (location.pathname !== '/panel/superadmin') navigate('/panel/superadmin', { replace: true });
      return;
    }
    if (role === 'institution_admin') {
      if (location.pathname === '/panel/superadmin' || location.pathname === '/system-admin')
        navigate('/panel/admin', { replace: true });
      return;
    }
    if (!activeInstitution) return;
    const institution = activeInstitution;
    let destination = '';
    if (role === 'dece_staff') destination = '/panel/dece';
    else if (role === 'student') destination = '/' + institution.slug + '/mi-ficha';
    else if (role === 'project_manager') destination = '/panel/proyectos?institution=' + encodeURIComponent(institution.institution_id);
    else if (role === 'editor') destination = '/panel/portal?institution=' + encodeURIComponent(institution.institution_id);
    else if (role === 'viewer') destination = '/proyectos?transparency=1&institution=' + encodeURIComponent(institution.slug);
    if (destination && location.pathname.startsWith('/panel/')) navigate(destination, { replace: true });
  }, [activeInstitution, loading, loadingTenant, mfaEnrollmentRequired, mfaRequired, role, location.pathname, navigate, user]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const result = await login(email.trim(), password);
      if (result.error) setError('No se pudo iniciar sesión. Revisa tu correo y contraseña.');
    } catch { setError('No fue posible conectar con el servicio de autenticación.'); }
    finally { setBusy(false); }
  }

  if (loading) return <main className={styles.page} role="status">Cargando tu acceso…</main>;
  if (!user) return <main className={styles.page}><section className={styles.card}>
    <div className={styles.top}><span className={styles.brand}>UE</span><span className={styles.secure}><i /> Conexión protegida</span></div>
    <p className={styles.eyebrow}>PORTAL INSTITUCIONAL</p><h1>Ingreso a la Plataforma Institucional</h1>
    <p className={styles.help}>Inicia sesión con tu correo institucional. Te dirigiremos al espacio que corresponde a tu rol.</p>
    <form onSubmit={submit} className={styles.form}>
      <label htmlFor="admin-email">Correo electrónico</label><input id="admin-email" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
      <label htmlFor="admin-password">Contraseña</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
      {error && <p className={styles.error} role="alert">{error}</p>}
      <button disabled={busy}>{busy ? 'Ingresando…' : 'Iniciar sesión'}</button>
    </form>
  </section></main>;

  if (mfaEnrollmentRequired) return <MfaEnrollment onEnrolled={completeMfaEnrollment} />;
  if (mfaRequired) return <main className={styles.page}><section className={styles.card}><p className={styles.eyebrow}>VERIFICACIÓN DE CUENTA</p><h1>Confirma tu identidad</h1><p className={styles.help}>Ingresa el código temporal de seis dígitos de tu aplicación autenticadora.</p>{mfaChallengeReady ? <form className={styles.form} onSubmit={async event => { event.preventDefault(); setBusy(true); const result = await verifyMfa(code); setBusy(false); if (result.error) setError('El código no es válido o venció.'); }}><label htmlFor="mfa-code">Código de verificación</label><input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required />{error && <p role="alert" className={styles.error}>{error}</p>}<button disabled={busy || code.length !== 6}>{busy ? 'Verificando…' : 'Verificar y continuar'}</button></form> : <p role="alert">No se pudo iniciar la verificación. Cierra sesión e inténtalo de nuevo.</p>}<button onClick={() => void logout()}>Cerrar sesión</button></section></main>;
  if (!role) return <main className={styles.page}><section className={styles.card}><p role="alert">{roleError ?? 'No se pudo verificar el rol de esta cuenta.'}</p><button onClick={() => void logout()}>Cerrar sesión</button></section></main>;
  if (superadminOnly && role !== 'super_admin') return <Navigate to="/panel/admin" replace />;
  if (role === 'super_admin') return <main className={styles.admin}><header><strong>Administración global</strong><button onClick={() => void logout()}>Cerrar sesión</button></header><SuperAdminPanel /><UserManagement /></main>;
  if (role === 'institution_admin') return <main className={styles.admin}><header><strong>Administración institucional</strong><button onClick={() => void logout()}>Cerrar sesión</button></header><UserManagement /></main>;
  return <main className={styles.page}><section className={styles.card}><h1>Acceso restringido</h1><p>Tu cuenta aún no tiene un rol administrativo asignado.</p><button onClick={() => void logout()}>Cerrar sesión</button></section></main>;
}
