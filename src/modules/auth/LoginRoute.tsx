import { isSuperAdmin } from '../../core/auth/superAdmin';
import { institutionSearch } from '../../features/auth/utils/googleOAuth';
import { useState, type FormEvent } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../core/AuthContext';
import { useTenant } from '../../core/TenantContext';
import { loginDestination, resolveLoginAccess } from '../../core/auth/loginAccess';
import AdminRoutes from '../admin/AdminRoutes';
import { InstitutionalLogin } from '../admin/InstitutionalLogin';
import styles from './LoginRoute.module.css';

export function LoginRoute() {
  const { user, role, roleError, loading, login, requestPasswordReset, mfaRequired, mfaEnrollmentRequired, logout } = useAuth();
  const { institutions, loadingTenant, tenantError } = useTenant();
  const { slug = '' } = useParams<{ slug: string }>();
  const [params] = useSearchParams();
  const institutionReference = slug || params.get('institution');
  const adminParams = new URLSearchParams(params);
  if (institutionReference) adminParams.set('institution', institutionReference);
  if (slug) adminParams.set('slug', slug);
  const adminPath = '/panel/admin' + institutionSearch(adminParams.toString());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await login(email.trim().toLowerCase(), password);
      if (result.error) setError('No se pudo iniciar sesión. Revisa tu correo y contraseña.');
    } catch { setError('No fue posible conectar con el servicio de autenticación.'); }
    finally { setBusy(false); }
  }

  if (loading) return <main className={styles.page} role="status">Verificando tu acceso…</main>;
  if (!user) return <InstitutionalLogin email={email} password={password} error={error} busy={busy} onEmailChange={setEmail} onPasswordChange={setPassword} onSubmit={submit} requestPasswordReset={requestPasswordReset} />;
  if (mfaRequired || mfaEnrollmentRequired || isSuperAdmin(role) || roleError || !role)
    return <Navigate to={adminPath} replace />;
  if (loadingTenant) return <main className={styles.page} role="status">Consultando tus instituciones…</main>;

  const access = resolveLoginAccess(institutions, [slug, params.get('institution') || '']);
  switch (access.status) {
    case 'redirect': return <Navigate to={access.destination} replace />;
    case 'unassigned': return tenantError
      ? <main className={styles.page}><section className={styles.card}><p role="alert">{tenantError}</p><button onClick={() => void logout()}>Cerrar sesión</button></section></main>
      : <AdminRoutes />;
    case 'select': return <main className={styles.page}><section className={styles.card}><h1>Selecciona tu institución</h1><p>Elige una de las unidades educativas asignadas a tu cuenta.</p>{access.institutions.map(item => <Link reloadDocument key={item.institution_id} to={loginDestination(item)}>{item.name}</Link>)}<button onClick={() => void logout()}>Cerrar sesión</button></section></main>;
    default: { const exhaustive: never = access; return exhaustive; }
  }
}
