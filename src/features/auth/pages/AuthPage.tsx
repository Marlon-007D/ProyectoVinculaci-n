import { useReducer, useRef, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/AuthContext';
import { GoogleButton } from '../components/GoogleButton';
import { authFormReducer } from '../utils/authFormState';
import { institutionContextFromSearch } from '../utils/googleOAuth';
import { MembershipRequestPanel } from '../../../modules/admin/userManagement/MembershipRequestPanel';
import type { AccessRequestService } from '../../../modules/admin/userManagement/membershipRequestService';
import styles from './AuthPage.module.css';

export function AuthPage({ mode = 'login', requestService }: { mode?: 'login' | 'register'; requestService: AccessRequestService }) {
  const { login, register, loginWithGoogle, user, role, roleIssue, loading, mfaRequired, mfaEnrollmentRequired, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(authFormReducer, { status: 'idle' });
  const pendingRef = useRef(false);
  const params = new URLSearchParams(location.search);
  const context = institutionContextFromSearch(location.search);
  const portalParams = new URLSearchParams();
  params.forEach((value, key) => {
    if (key === 'institution' || key === 'slug') portalParams.append(key, value);
  });
  const portalSearch = portalParams.size ? '?' + portalParams.toString() : '';
  const busy = state.status === 'pending';
  const registering = mode === 'register';
  const destination = '/panel/admin' + location.search;
  const oauthError = params.has('error') || new URLSearchParams(location.hash.slice(1)).has('error');
  const accessIssue = roleIssue ?? location.state?.accessIssue;
  const blockedAccess = accessIssue === 'membership-required' || accessIssue === 'verification-failed';

  async function authenticate(method: 'google' | 'credentials', form?: HTMLFormElement) {
    if (pendingRef.current || state.status === 'pending' || state.status === 'registered') return;
    pendingRef.current = true;
    navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: null });
    dispatch({ type: 'start', method });
    try {
      if (method === 'google') {
        const result = await loginWithGoogle(context);
        if (result.error) throw result.error;
        // The successful terminal state remains pending while the browser redirects.
        return;
      }
      const values = new FormData(form);
      const email = String(values.get('email')).trim();
      const password = String(values.get('password'));
      if (registering) {
        const result = await register(email, password, String(values.get('firstName')), String(values.get('lastName')), context.institution || '');
        if (result.error) throw result.error;
        dispatch({ type: 'registered', message: 'Tu solicitud de registro fue enviada. Tu institución debe aprobar el acceso.' });
      } else {
        const result = await login(email, password);
        if (result.error) throw result.error;
        dispatch({ type: 'authenticated' });
      }
    } catch {
      dispatch({ type: 'failed', message: method === 'google' ? 'No se pudo conectar con Google. Intenta nuevamente.' : registering ? 'No se pudo crear la cuenta. Revisa tus datos e intenta nuevamente.' : 'No se pudo iniciar sesión. Revisa tu correo y contraseña.' });
    } finally {
      pendingRef.current = false;
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void authenticate('credentials', event.currentTarget);
  }

  if (loading) return <main className={styles.page} role="status">Cargando tu acceso…</main>;
  if (user && (role || mfaRequired || mfaEnrollmentRequired) && !blockedAccess && !(registering && busy)) return <Navigate to={destination} replace />;

  return <main className={styles.page}>
    <div className={styles.layout}>
      <aside className={styles.panel}>
        <span className={styles.brand}>Portal institucional</span>
        <div><h2>Tu comunidad educativa</h2><p>Accede a los servicios y recursos de tu institución desde una sola cuenta.</p></div>
        {(context.slug || context.institution) && <p>Institución: {context.slug || context.institution}</p>}
      </aside>
      <section className={styles.content} aria-labelledby="auth-title">
        <Link className={styles.backLink} to={{ pathname: '/', search: portalSearch }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m7.825 13 5.6 5.6L12 20l-8-8 8-8 1.425 1.4-5.6 5.6H20v2Z" /></svg>Regresar a Unidades Educativas
        </Link>
        <h1 id="auth-title">{registering ? 'Crear cuenta' : 'Iniciar sesión'}</h1>
        <p className={styles.help}>{registering ? 'Registra tus datos para comenzar.' : 'Ingresa con tu cuenta para continuar.'}</p>
        {blockedAccess && <div role="alert" className={styles.error}>
          <p>{accessIssue === 'membership-required'
            ? 'Esta cuenta requiere la asignación previa de una membresía y un rol en la institución seleccionada. Contacta a su administrador.'
            : 'No se pudo verificar tu acceso a la institución. Intenta iniciar sesión nuevamente.'}</p>
          {user && <button type="button" className={styles.submit} disabled={busy} onClick={() => void logout()}>Cerrar sesión para usar otra cuenta</button>}
        </div>}
        {user && accessIssue === 'membership-required' && (context.institution || context.slug) && <MembershipRequestPanel
          key={`${user.id}:${context.institution}:${context.slug}`} institution={context.institution || context.slug!}
          slug={context.slug} service={requestService} onContinue={() => window.location.assign(destination)} />}
        {oauthError && state.status === 'idle' && <p role="alert" className={styles.error}>No se completó el acceso con Google. Puedes intentarlo de nuevo.</p>}
        {state.status === 'registered' ? <p role="status">{state.message}</p> : <>
          <GoogleButton disabled={busy} pending={state.status === 'pending' && state.method === 'google'} onClick={() => void authenticate('google')} />
          <div className={styles.separator}>O entra con</div>
          {state.status === 'error' && <p role="alert" className={styles.error}>{state.message}</p>}
          <form onSubmit={submit} className={styles.form} aria-busy={busy}>
            <fieldset disabled={busy} className={styles.fields}>
              {registering && <>
                <label htmlFor="auth-first-name">Nombres</label><input id="auth-first-name" name="firstName" autoComplete="given-name" required />
                <label htmlFor="auth-last-name">Apellidos</label><input id="auth-last-name" name="lastName" autoComplete="family-name" required />
              </>}
              <label htmlFor="auth-email">Correo electrónico</label><input id="auth-email" name="email" type="email" autoComplete="username" required />
              <label htmlFor="auth-password">Contraseña</label><input id="auth-password" name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? 8 : undefined} required />
              <button className={styles.submit} type="submit">{busy ? 'Procesando…' : registering ? 'Crear cuenta' : 'Iniciar sesión'}</button>
            </fieldset>
          </form>
        </>}
        <p className={styles.switchLink}>{registering ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'} <Link to={{ pathname: registering ? '/login' : '/register', search: location.search }} aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }}>{registering ? 'Iniciar sesión' : 'Crear cuenta'}</Link></p>
      </section>
    </div>
  </main>;
}
