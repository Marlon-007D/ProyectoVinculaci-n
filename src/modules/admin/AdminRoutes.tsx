import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/AuthContext';
import { useTenant } from '../../core/TenantContext';
import { MfaEnrollment } from './mfa/MfaEnrollment';
import { SuperAdminPanel } from './superadmin/SuperAdminPanel';
import { UserManagement } from './userManagement/UserManagement';
import styles from './AdminRoutes.module.css';
import { resolveAdminAccess } from '../../features/auth/utils/adminAccess';
import { loginDestination } from '../../core/auth/loginAccess';

export default function AdminRoutes({ superadminOnly = false }: { superadminOnly?: boolean }) {
  const { user, role, roleIssue, loading, logout, mfaRequired, mfaEnrollmentRequired, completeMfaEnrollment, verifyMfa, mfaChallengeReady } = useAuth();
  const { activeInstitution, loadingTenant, tenantError } = useTenant();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !role || loading || mfaRequired || mfaEnrollmentRequired || loadingTenant) return;
    if (role === 'super_admin') {
      return;
    }
    if (role === 'institution_admin') {
      if (location.pathname === '/panel/superadmin' || location.pathname === '/system-admin')
        navigate('/panel/admin' + location.search, { replace: true });
      return;
    }
    if (!activeInstitution) return;
    const destination = new URL(loginDestination({ ...activeInstitution, role }), window.location.origin);
    const slug = new URLSearchParams(location.search).get('slug');
    if (slug) destination.searchParams.set('slug', slug);
    if (location.pathname.startsWith('/panel/')) navigate(destination.pathname + destination.search, { replace: true });
  }, [activeInstitution, loading, loadingTenant, mfaEnrollmentRequired, mfaRequired, role, location.pathname, location.search, navigate, user]);

  const access = resolveAdminAccess({ loading, hasUser: Boolean(user), role, roleIssue,
    mfaPending: mfaRequired || mfaEnrollmentRequired, loadingTenant,
    hasInstitution: Boolean(activeInstitution), tenantError });
  switch (access.status) {
    case 'loading': return <main className={styles.page} role="status" aria-live="polite" aria-busy="true">{access.message}</main>;
    case 'login': return <Navigate to={{ pathname: '/login', search: location.search, hash: location.hash }} state={{ accessIssue: access.issue }} replace />;
    case 'mfa':
    case 'authorized': break;
    default: { const exhaustive: never = access; return exhaustive; }
  }

  if (mfaEnrollmentRequired) return <MfaEnrollment onEnrolled={completeMfaEnrollment} />;
  if (mfaRequired) return <main className={styles.page}><section className={styles.card}><p className={styles.eyebrow}>VERIFICACIÓN DE CUENTA</p><h1>Confirma tu identidad</h1><p className={styles.help}>Ingresa el código temporal de seis dígitos de tu aplicación autenticadora.</p>{mfaChallengeReady ? <form className={styles.form} onSubmit={async event => { event.preventDefault(); setBusy(true); const result = await verifyMfa(code); setBusy(false); if (result.error) setError('El código no es válido o venció.'); }}><label htmlFor="mfa-code">Código de verificación</label><input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required />{error && <p role="alert" className={styles.error}>{error}</p>}<button disabled={busy || code.length !== 6}>{busy ? 'Verificando…' : 'Verificar y continuar'}</button></form> : <p role="alert">No se pudo iniciar la verificación. Cierra sesión e inténtalo de nuevo.</p>}<button onClick={() => void logout()}>Cerrar sesión</button></section></main>;
  if (superadminOnly && role !== 'super_admin') return <Navigate to={'/panel/admin' + location.search} replace />;
  if (role === 'super_admin') return <main className={styles.admin}>{superadminOnly ? <SuperAdminPanel /> : <UserManagement />}</main>;
  if (role === 'institution_admin') return <main className={styles.admin}><UserManagement /></main>;
  return <main className={styles.page}><section className={styles.card}><h1>Acceso restringido</h1><p>Tu cuenta aún no tiene un rol administrativo asignado.</p><button onClick={() => void logout()}>Cerrar sesión</button></section></main>;
}
