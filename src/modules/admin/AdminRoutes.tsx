import { useInitialPrivateLoad } from './userManagement/useInitialPrivateLoad';
import { AdminSkeleton, AssignedModulesSkeleton } from './userManagement/AdminSkeleton';
import { AdminForm } from './auth/AdminForm';
import { createTenantAdminService } from './userManagement/tenantAdminService';
import { supabase } from '../../core/supabaseClient';
import { adminDestination } from './auth/institutionNavigation';
import { ToastBoundary, useToast, useToastMessage } from './auth/Toast/Toast';
import { canonicalTenantRole, isTenantAdmin, isTenantSuperAdmin as isSuperAdmin } from './auth/accessPolicy';
import { useEffect, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/AuthContext';
import { useTenant } from '../../core/TenantContext';
import { MfaEnrollment } from './mfa/MfaEnrollment';
import { SuperAdminPanel } from './superadmin/SuperAdminPanel';
import { TenantSelector } from './superadmin/TenantSelector';
import { tenantSelectionDestination } from './superadmin/tenantSelection';
import { UserManagement } from './userManagement/UserManagement';
import styles from './AdminRoutes.module.css';
import { resolveAdminAccess } from './auth/adminAccess';
import { AssignedModulesPanel } from './auth/AssignedModulesPanel';
import { TenantUrlBoundary } from './auth/TenantUrlBoundary';
import { returnToFromLocation } from './auth/returnTo';


import { AdminSessionPolicy } from './auth/AdminSessionPolicy';
import { AdminSessionFeedback } from './auth/AdminSessionFeedback';
import { PendingInvitationGate } from './auth/PendingInvitationGate';
import { InvitationLinkBoundary } from './auth/InvitationLinkBoundary';

const tenantAdminService = createTenantAdminService(supabase);


export default function AdminRoutes(props: { superadminOnly?: boolean }) {
  return <ToastBoundary><InvitationLinkBoundary><PendingInvitationGate><AdminSessionPolicy><AdminSessionFeedback><TenantUrlBoundary><AdminRoutesContent {...props} /></TenantUrlBoundary></AdminSessionFeedback></AdminSessionPolicy></PendingInvitationGate></InvitationLinkBoundary></ToastBoundary>;
}

function AdminRoutesContent({ superadminOnly = false }: { superadminOnly?: boolean }) {
  const { user, role, roleIssue, institutionId, loading, logout, mfaRequired, mfaEnrollmentRequired, completeMfaEnrollment, verifyMfa, mfaChallengeReady } = useAuth();
  const { activeInstitution, institutions, setActiveInstitution, loadingTenant, tenantError } = useTenant();
  const [error, setError] = useState('');
  useToastMessage(error);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');

  const notify = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const scopedSearch = new URL(adminDestination(location.pathname, location.search), window.location.origin).search;

  function selectInstitution(selectedId: string) {
    if (selectedId === activeInstitution?.institution_id) return;
    const destination = tenantSelectionDestination(institutions, selectedId, location.search, location.hash);
    const selected = institutions.find(item => item.institution_id === selectedId);
    if (!destination || !selected) return;
    setActiveInstitution(selected);
    navigate(destination);
    notify(`Unidad educativa seleccionada: ${selected.name}.`, 'success');
  }

  async function signOut() {
    try {
      await logout();
    } catch {
      setError('No se pudo cerrar la sesión. Revisa tu conexión e intenta nuevamente.');
    }
  }

  async function submitMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !/^\d{6}$/.test(code)) return;
    setBusy(true);
    setError('');
    try {
      const result = await verifyMfa(code);
      if (result.error) setError('El código no es válido o venció.');
    } catch {
      setError('No se pudo verificar el código. Revisa tu conexión e intenta nuevamente.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!user || !role || loading || mfaRequired || mfaEnrollmentRequired || loadingTenant) return;
    if (user.user_metadata?.admin_tenant_onboarding === true) return;
    if (isSuperAdmin(role)) {
      return;
    }
    if (isTenantAdmin(role)) {
      if (location.pathname === '/panel/superadmin' || location.pathname === '/system-admin')
        navigate(adminDestination('/panel/admin', location.search), { replace: true });
      return;
    }
    if (!activeInstitution) return;
    if (location.pathname !== '/panel/admin') navigate(adminDestination('/panel/admin', location.search), { replace: true });
  }, [activeInstitution, loading, loadingTenant, mfaEnrollmentRequired, mfaRequired, role, location.pathname, location.search, navigate, user]);

  const access = resolveAdminAccess({ loading, hasUser: Boolean(user), role, roleIssue,
    mfaPending: mfaRequired || mfaEnrollmentRequired, loadingTenant,
    hasInstitution: Boolean(activeInstitution && activeInstitution.institution_id === institutionId && role && canonicalTenantRole(role) === canonicalTenantRole(activeInstitution.role)), tenantError });
  const showSkeleton = useInitialPrivateLoad(user ? `${user.id}:${user.last_sign_in_at ?? ''}` : undefined, 'panel', access.status === 'loading', Boolean(user && role && location.pathname.startsWith('/panel/') && !mfaRequired && !mfaEnrollmentRequired), loading);
  switch (access.status) {
    case 'loading': return <main className={styles.page} role="status" aria-live="polite" aria-busy="true">{showSkeleton ? (isTenantAdmin(role) || isSuperAdmin(role) ? <AdminSkeleton /> : <AssignedModulesSkeleton />) : access.message}</main>;
    case 'login': return <Navigate to={{ pathname: '/login', search: scopedSearch, hash: location.hash }} state={{ accessIssue: access.issue, returnTo: returnToFromLocation(location) }} replace />;
    case 'mfa':
    case 'authorized': break;
    default: { const exhaustive: never = access; return exhaustive; }
  }

  if (mfaEnrollmentRequired) return <MfaEnrollment onEnrolled={completeMfaEnrollment} />;
  if (mfaRequired) return <main className={styles.page}><section className={styles.card}><p className={styles.eyebrow}>VERIFICACIÓN DE CUENTA</p><h1>Confirma tu identidad</h1><p className={styles.help}>Ingresa el código temporal de seis dígitos de tu aplicación autenticadora.</p>{mfaChallengeReady ? <AdminForm className={styles.form} onSubmit={submitMfa}><label htmlFor="mfa-code">Código de verificación</label><input id="mfa-code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} required /><button disabled={busy}>{busy ? 'Verificando…' : 'Verificar y continuar'}</button></AdminForm> : <p role="alert">No se pudo iniciar la verificación. Cierra sesión e inténtalo de nuevo.</p>}<button onClick={() => void signOut()}>Cerrar sesión</button></section></main>;
  if (superadminOnly && !isSuperAdmin(role)) return <Navigate to={adminDestination('/panel/admin', location.search)} replace />;
  if (isSuperAdmin(role)) return <main className={styles.admin}><TenantSelector institutions={institutions} selectedId={activeInstitution?.institution_id ?? ''} onSelect={selectInstitution} />{superadminOnly ? <SuperAdminPanel service={tenantAdminService} /> : <UserManagement service={tenantAdminService} />}</main>;
  if (isTenantAdmin(role)) return <main className={styles.admin}><UserManagement service={tenantAdminService} /></main>;
  if (activeInstitution) return <main className={styles.admin}><AssignedModulesPanel institution={activeInstitution} /></main>;
  return <main className={styles.page}><section className={styles.card}><h1>Acceso restringido</h1><p>Tu cuenta aún no tiene un rol administrativo asignado.</p><button onClick={() => void signOut()}>Cerrar sesión</button></section></main>;
}
