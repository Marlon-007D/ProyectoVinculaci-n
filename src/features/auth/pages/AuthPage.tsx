import { authenticatedDestination } from '../../../modules/admin/auth/authenticatedDestination';
import { LoadingState } from '../../../modules/site/components/states/LoadingState';
import { resolveLoginIssue } from '../utils/adminAccess';
import { useTenant } from '../../../core/TenantContext';
import { useToast, useToastMessage } from '../../../modules/admin/auth/Toast/Toast';
import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../core/AuthContext';
import { GoogleButton } from '../components/GoogleButton';
import { authFormReducer } from '../utils/authFormState';
import { institutionContextFromSearch, institutionSearch } from '../utils/googleOAuth';
import { MembershipRequestPanel } from '../../../modules/admin/userManagement/MembershipRequestPanel';
import type { AccessRequestService } from '../../../modules/admin/userManagement/membershipRequestService';
import styles from './AuthPage.module.css';
import { PasswordField } from '../../../modules/admin/auth/PasswordField';
import { InvitationLinkBoundary } from '../../../modules/admin/auth/InvitationLinkBoundary';
import { InstitutionalLogin } from '../../../modules/admin';
import { resolveReturnTo, safeReturnTo } from '../../../modules/admin/auth/returnTo';
import { readSessionValue, writeSessionValue } from '../../../modules/admin/auth/sessionStorage';

// Same limits as the register-institution-user Edge Function.
const REGISTRATION_PASSWORD_MIN = 12;
const REGISTRATION_PASSWORD_MAX = 128;
const SIGN_IN_PASSWORD_MIN = 6;
const RETURN_TO_KEY = 'auth-return-to';

export function AuthPage({ mode = 'login', requestService }: { mode?: 'login' | 'register'; requestService: AccessRequestService }) {
  return <InvitationLinkBoundary><AuthPageContent mode={mode} requestService={requestService} /></InvitationLinkBoundary>;
}

function AuthPageContent({ mode, requestService }: { mode: 'login' | 'register'; requestService: AccessRequestService }) {
  const { login, register, loginWithGoogle, user, role, roleIssue, institutionId: authInstitutionId, loading, mfaRequired, mfaEnrollmentRequired, logout, requestPasswordReset } = useAuth();
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const { activeInstitution, loadingTenant, tenantError } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(authFormReducer, { status: 'idle' });
  const pendingRef = useRef(false);
  const notify = useToast();
  const params = new URLSearchParams(location.search);
  const context = institutionContextFromSearch(location.search);
  const portalParams = new URLSearchParams();
  if (context.institution) portalParams.set('institution', context.institution);
  if (context.slug) portalParams.set('slug', context.slug);
  const portalSearch = portalParams.size ? '?' + portalParams.toString() : '';
  const effectiveRole = role && activeInstitution ? activeInstitution.role : role;
  // authenticate() clears the router state, so the requested page is kept in session storage meanwhile.
  const stateReturnTo = safeReturnTo((location.state as { returnTo?: unknown } | null)?.returnTo);
  const returnTo = stateReturnTo ?? safeReturnTo(readSessionValue(RETURN_TO_KEY));
  useEffect(() => { writeSessionValue(RETURN_TO_KEY, stateReturnTo); }, []);
  const busy = state.status === 'pending';
  const registering = mode === 'register';
  const destination = '/panel/admin' + institutionSearch(location.search);
  const oauthError = params.has('error') || new URLSearchParams(location.hash.slice(1)).has('error');
  const accessIssue = resolveLoginIssue({ hasUser: Boolean(user), role: effectiveRole, roleIssue,
    mfaPending: mfaRequired || mfaEnrollmentRequired, loadingTenant,
    hasInstitution: Boolean(activeInstitution), tenantError });
  const blockedAccess = accessIssue === 'membership-required' || accessIssue === 'verification-failed';

  useToastMessage(state.status === 'error' ? state.message : null);
  useToastMessage(oauthError && !user ? 'No se completó el acceso con Google. Intenta nuevamente.' : null);
  useToastMessage(state.status === 'registered' ? state.message : null, 'success');
  const accessMessage = accessIssue === 'membership-required'
    ? 'Tu cuenta requiere una membresía activa en la institución seleccionada.'
    : 'No se pudo verificar tu acceso. Intenta nuevamente.';
  useToastMessage(!loading && !loadingTenant && blockedAccess ? accessMessage : null);

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
    if (pendingRef.current || busy) return;
    const form = event.currentTarget;
    const values = new FormData(form);
    const email = String(values.get('email') ?? '').trim();
    const password = String(values.get('password') ?? '');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      notify('Por favor, ingresa un correo electrónico válido.');
      form.querySelector<HTMLInputElement>('#auth-email')?.focus();
      return;
    }
    const minimumPassword = registering ? REGISTRATION_PASSWORD_MIN : SIGN_IN_PASSWORD_MIN;
    if (!password.trim() || password.length < minimumPassword || (registering && password.length > REGISTRATION_PASSWORD_MAX)) {
      notify(registering
        ? `Usa una contraseña de ${REGISTRATION_PASSWORD_MIN} a ${REGISTRATION_PASSWORD_MAX} caracteres.`
        : `Ingresa una contraseña de al menos ${SIGN_IN_PASSWORD_MIN} caracteres.`);
      form.querySelector<HTMLInputElement>('#auth-password')?.focus();
      return;
    }
    if (registering && (!String(values.get('firstName') ?? '').trim() || !String(values.get('lastName') ?? '').trim())) {
      notify('Completa todos los campos obligatorios.');
      return;
    }
    void authenticate('credentials', form);
  }

  if (loading || (user && loadingTenant)) return <main className={styles.page}><LoadingState variant="page" pageKind="content" label="Preparando la página" /></main>;

  if (user && (mfaRequired || mfaEnrollmentRequired)) return <Navigate to={destination} replace />;
  if (user && activeInstitution && effectiveRole && !blockedAccess && !(registering && busy)) {
    const target = authenticatedDestination(activeInstitution, authInstitutionId, role, location.search);
    if (target) return <Navigate to={resolveReturnTo(returnTo, target)} replace />;
  }
  if (user && !registering && !blockedAccess) return <main className={styles.page}>
    <div className={styles.layout}>
      <section className={styles.content} aria-labelledby="auth-title">
        <h1 id="auth-title">Ya iniciaste sesión</h1>
        <p className={styles.help} role="status">No pudimos determinar a qué módulo llevarte con esta cuenta. Puedes ir al panel o cerrar sesión para usar otra cuenta.</p>
        <Link className={styles.submit} to={{ pathname: '/panel', search: portalSearch }}>Ir al panel</Link>
        <button type="button" className={styles.submit} disabled={busy} onClick={() => void logout()}>Cerrar sesión</button>
      </section>
    </div>
  </main>;

  if (!registering && !user) return <InstitutionalLogin email={loginEmail} password={loginPassword}
    onEmailChange={setLoginEmail} onPasswordChange={setLoginPassword} busy={busy}
    error={state.status === 'error' ? state.message : ''} onSubmit={submit} requestPasswordReset={requestPasswordReset}>
    <GoogleButton disabled={busy} pending={busy && state.method === 'google'} onClick={() => void authenticate('google')} />
  </InstitutionalLogin>;

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
        {blockedAccess && <div>
          {user && <button type="button" className={styles.submit} disabled={busy} onClick={() => void logout()}>Cerrar sesión para usar otra cuenta</button>}
        </div>}
        {user && !effectiveRole && !loadingTenant && accessIssue === 'membership-required' && (context.institution || context.slug) && <MembershipRequestPanel
          key={`${user.id}:${context.institution}:${context.slug}`} institution={context.institution || context.slug!}
          slug={context.slug} service={requestService} onContinue={() => window.location.assign(destination)} />}
        {state.status !== 'registered' && <>
          <GoogleButton disabled={busy} pending={state.status === 'pending' && state.method === 'google'} onClick={() => void authenticate('google')} />
          <div className={styles.separator}>O entra con</div>
          <form noValidate onSubmit={submit} className={styles.form} aria-busy={busy}>
            <fieldset disabled={busy} className={styles.fields}>
              {registering && <>
                <label htmlFor="auth-first-name">Nombres</label><input id="auth-first-name" name="firstName" autoComplete="given-name" required />
                <label htmlFor="auth-last-name">Apellidos</label><input id="auth-last-name" name="lastName" autoComplete="family-name" required />
              </>}
              <label htmlFor="auth-email">Correo electrónico</label><input id="auth-email" name="email" type="email" autoComplete="username" required />
              <PasswordField label="Contraseña" id="auth-password" name="password" autoComplete={registering ? 'new-password' : 'current-password'} minLength={registering ? REGISTRATION_PASSWORD_MIN : undefined} maxLength={registering ? REGISTRATION_PASSWORD_MAX : undefined} disabled={busy} required />
              <button className={styles.submit} type="submit">{busy ? 'Procesando…' : registering ? 'Crear cuenta' : 'Iniciar sesión'}</button>
            </fieldset>
          </form>
        </>}
        <p className={styles.switchLink}>{registering ? '¿Ya tienes una cuenta?' : '¿No tienes una cuenta?'} <Link to={{ pathname: registering ? '/login' : '/register', search: location.search }} aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }}>{registering ? 'Iniciar sesión' : 'Crear cuenta'}</Link></p>
      </section>
    </div>
  </main>;
}
