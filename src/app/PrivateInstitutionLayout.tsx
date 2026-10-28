import { LogOut } from 'lucide-react';
import type { MouseEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../core/AuthContext';
import { useTenant } from '../core/TenantContext';
import styles from './PrivateInstitutionLayout.module.css';

type NavigationItem = { label: string; to: string };

export function PrivateInstitutionLayout() {
  const { user, role: authRole, institutionId: authInstitutionId, logout } = useAuth();
  const { activeInstitution, institutions } = useTenant();
  const location = useLocation();
  const navigate = useNavigate();
  const firstSegment = location.pathname.split('/').filter(Boolean)[0] ?? '';
  const routeSlug = firstSegment && firstSegment !== 'panel' && firstSegment !== 'system-admin'
    ? firstSegment
    : null;
  const routeInstitution = routeSlug
    ? institutions.find((item) => item.slug === routeSlug) ?? null
    : activeInstitution;
  const role = routeSlug ? routeInstitution?.role ?? null : routeInstitution?.role ?? authRole;
  const institutionId = routeInstitution?.institution_id ?? (!routeSlug ? authInstitutionId : null);
  const institutionSlug = routeSlug ?? routeInstitution?.slug;
  const institutionName = routeInstitution?.name
    ?? (routeSlug ? routeSlug.replace(/-/g, ' ') : 'Portal institucional');
  const institutionRef = institutionSlug
    ?? new URLSearchParams(location.search).get('institution');
  const publicUrl = institutionRef
    ? '/?institution=' + encodeURIComponent(institutionRef)
    : '/';
  const institutionQuery = institutionId
    ? '?institution=' + encodeURIComponent(institutionId)
    : '';
  const modulePermissions = routeInstitution?.module_permissions;
  const navigation: NavigationItem[] = [{ label: 'Portal p\u00fablico', to: publicUrl }];

  if (user && (role === 'institution_admin' || role === 'super_admin')) {
    navigation.push({
      label: role === 'super_admin' ? 'Administraci\u00f3n global' : 'Administraci\u00f3n',
      to: (role === 'super_admin' ? '/panel/superadmin' : '/panel/admin') + institutionQuery,
    });
  }
  if (user && role === 'dece_staff' && institutionSlug) {
    navigation.push({ label: 'DECE', to: '/' + institutionSlug + '/dece' });
  }
  if (user && role === 'student' && institutionSlug) {
    navigation.push({ label: 'Mis fichas', to: '/' + institutionSlug + '/mi-ficha' });
  }
  if (user && institutionId && modulePermissions?.projects === true
    && ['institution_admin', 'super_admin', 'project_manager'].includes(role ?? '')) {
    navigation.push({ label: 'Proyectos', to: '/panel/proyectos' + institutionQuery });
  }
  if (user && institutionId && modulePermissions?.portal === true
    && ['institution_admin', 'super_admin', 'editor'].includes(role ?? '')) {
    navigation.push({ label: 'Editor del portal', to: '/panel/portal' + institutionQuery });
  }
  if (user && institutionId && modulePermissions?.simuladores === true) {
    navigation.push({ label: 'Simuladores', to: '/panel/simuladores' + institutionQuery });
  }

  const institutionInitial = institutionName.trim().charAt(0).toUpperCase() || 'I';
  function confirmLeave(event?: MouseEvent<HTMLAnchorElement>) {
    if (event && (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)) return true;
    const leaveEvent = new Event('portal-editor-before-leave', { cancelable: true });
    return window.dispatchEvent(leaveEvent)
      || window.confirm('Hay cambios sin guardar. \u00bfSalir de esta secci\u00f3n?');
  }

  async function signOut() {
    if (!confirmLeave()) return;
    await logout();
    navigate(publicUrl, { replace: true });
  }

  return (
    <div className={styles.shell}>
      <a className={styles.skipLink} href="#private-content">Saltar al contenido</a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link className={styles.brand} to={publicUrl} aria-label={'Portal p\u00fablico de ' + institutionName}>
            <span className={styles.brandMark} aria-hidden="true">{institutionInitial}</span>
            <span className={styles.brandText}>
              <strong>{institutionName}</strong>
              <small>Espacio privado institucional</small>
            </span>
          </Link>
          <div className={styles.account}>
            {user?.email && <span className={styles.email}>{user.email}</span>}
            {user && <button className={styles.signOut} type="button" onClick={() => void signOut()}>
              <LogOut size={17} aria-hidden="true" />
              Cerrar sesi\u00f3n
            </button>}
          </div>
        </div>
      </header>
      <nav className={styles.navigation} aria-label="Secciones institucionales">
        <div className={styles.navigationInner}>
          {navigation.map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.label === 'Portal p\u00fablico'}
              className={({ isActive }) => isActive ? styles.navigationLinkActive : styles.navigationLink}
              onClick={(event) => { if (!confirmLeave(event)) event.preventDefault(); }}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
      <div id="private-content" className={styles.content} tabIndex={-1}>
        <Outlet />
      </div>
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <span>{'\u00a9'} {new Date().getFullYear()} {institutionName} {'\u00b7'} Plataforma institucional</span>
          <Link to={publicUrl}>Volver al portal p\u00fablico</Link>
        </div>
      </footer>
    </div>
  );
}
