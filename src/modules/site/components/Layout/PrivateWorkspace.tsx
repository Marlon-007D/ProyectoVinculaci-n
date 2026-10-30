import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Building2, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../core/AuthContext';
import { useTenant } from '../../../../core/TenantContext';
import { institutionSearch } from '../../../../features/auth/utils/googleOAuth';
import { visibleNavItems } from './navItems';
import { useBrowserPathname } from '../../hooks/useBrowserPathname';
import { notify } from '../../../../shared/components/Toaster/notify';
import { confirmAction } from '../../../../shared/components/ConfirmDialog/confirm';
import styles from './PrivateWorkspace.module.css';

export function PrivateWorkspace({ children }: { children: ReactNode }) {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const contextSearch = institutionSearch(search);
  const scopedPath = (path: string) => path + contextSearch;
  useEffect(() => {
    if (search !== contextSearch) navigate({ pathname, search: contextSearch, hash }, { replace: true });
  }, [pathname, search, contextSearch, hash, navigate]);
  const { user, role, logout, loading: loadingAuth } = useAuth();
  const { activeInstitution, institutions, setActiveInstitution, hasModuleAccess, loadingTenant } = useTenant();
  const sidebarLoading = loadingAuth || loadingTenant;
  const isDeceStaff = role === 'dece_staff';
  const navItems = visibleNavItems(role, hasModuleAccess);
  // Follows pushState too, so DECE pages that navigate on their own keep the right item active.
  const currentPath = useBrowserPathname();
  const exactOnly = new Set(['/panel', '/panel/dece', '/panel/admin']);
  const isActive = (path: string) => currentPath === path || (!exactOnly.has(path) && currentPath.startsWith(path + '/'));
  // collapsed: icon rail. peek: widened while the pointer rests on it. open: pinned with the toggle.
  // Both expanded states dim the page behind. The rail always starts collapsed.
  const [sidebar, setSidebar] = useState<'collapsed' | 'peek' | 'open'>('collapsed');
  const sidebarCollapsed = sidebar === 'collapsed';
  const hoverTimer = useRef(0);
  const canHover = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function hoverSidebar(entering: boolean) {
    window.clearTimeout(hoverTimer.current);
    if (!canHover()) return;
    // A short intent delay keeps the menu still when the pointer only crosses the rail.
    hoverTimer.current = window.setTimeout(() => setSidebar(current => entering
      ? (current === 'collapsed' ? 'peek' : current)
      : (current === 'peek' ? 'collapsed' : current)), entering ? 180 : 120);
  }
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  useEffect(() => { setSidebar('collapsed'); }, [pathname]);

  useEffect(() => {
    if (sidebarCollapsed) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSidebar('collapsed'); };
    // Leaving the tab closes the floating menu so the page is never found covered on return.
    const hide = () => { if (document.visibilityState === 'hidden') setSidebar('collapsed'); };
    window.addEventListener('keydown', close);
    document.addEventListener('visibilitychange', hide);
    return () => { window.removeEventListener('keydown', close); document.removeEventListener('visibilitychange', hide); };
  }, [sidebarCollapsed]);

  const roleLabel = role?.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) || 'Usuario';

  // The portal editor cancels this event while it has unsaved changes.
  const editorHasChanges = () => !window.dispatchEvent(new Event('portal-editor-before-leave', {cancelable:true}));
  const confirmLeave = () => confirmAction({ title: '¿Salir del editor?', message: 'Tienes cambios sin guardar en el portal. Si sales ahora, se perderán.', confirmLabel: 'Salir sin guardar', cancelLabel: 'Seguir editando', tone: 'danger' });
  function guardNavigation(event: MouseEvent<HTMLElement>) {
    const link = (event.target as HTMLElement).closest('a');
    if (!link || !editorHasChanges()) return;
    event.preventDefault(); event.stopPropagation();
    const target = link.getAttribute('href');
    void confirmLeave().then(accepted => { if (accepted && target) navigate(target); });
  }
  async function signOut() {
    if (editorHasChanges() && !await confirmLeave()) return;
    // AuthContext.logout owns the destination; navigating here would race with it.
    try { await logout(); } catch { notify.error('No se pudo cerrar la sesión. Revisa tu conexión e intenta nuevamente.'); }
  }

  const isMobile = () => window.matchMedia('(max-width: 760px)').matches;
  const sidebarId = useId();
  const asideRef = useRef<HTMLElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    // Mobile drawer: focus moves in when it opens and returns to the menu button when it closes.
    if (!isMobile()) return;
    if (!sidebarCollapsed) asideRef.current?.querySelector<HTMLElement>('button, a')?.focus();
    else if (asideRef.current?.contains(document.activeElement)) menuButton.current?.focus();
  }, [sidebarCollapsed]);
  function trapFocus(event: ReactKeyboardEvent<HTMLElement>) {
    if (event.key !== 'Tab' || sidebarCollapsed || !isMobile()) return;
    const focusable = [...(asideRef.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), select') ?? [])];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
  return <div className={`${styles.workspace} ${sidebarCollapsed ? styles.workspaceCollapsed : styles.workspaceExpanded}`}>
    <button ref={menuButton} type="button" className={styles.mobileMenu} aria-label="Abrir menú de navegación" aria-expanded={!sidebarCollapsed} aria-controls={sidebarId} onClick={() => setSidebar('open')}><Menu size={22} aria-hidden="true" /></button>
    {!sidebarCollapsed && <div className={styles.scrim} aria-hidden="true" onClick={() => setSidebar('collapsed')} />}
    <aside id={sidebarId} ref={asideRef} onKeyDown={trapFocus} className={styles.aside} aria-label="Navegación del área privada" aria-busy={sidebarLoading} onMouseEnter={() => hoverSidebar(true)} onMouseLeave={() => hoverSidebar(false)}>
      {sidebarLoading ? <div className={`${styles.sidebarSkeleton} ${sidebarCollapsed ? styles.sidebarSkeletonCollapsed : ''}`} role="status" aria-label="Cargando navegación">
        <div className={styles.skeletonTop}><span className={`${styles.skeletonBlock} ${styles.skeletonToggle}`} /><span className={`${styles.skeletonBlock} ${styles.skeletonInstitution}`} /></div>
        <div className={styles.skeletonNav}>{[0, 1, 2, 3, 4].map(item => <div className={styles.skeletonItem} key={item}><span className={`${styles.skeletonBlock} ${styles.skeletonIcon}`} /><span className={`${styles.skeletonBlock} ${styles.skeletonLabel}`} /></div>)}</div>
        <div className={styles.skeletonAccount}><span className={`${styles.skeletonBlock} ${styles.skeletonAvatar}`} /><span className={styles.skeletonAccountText}><i className={styles.skeletonBlock} /><i className={styles.skeletonBlock} /></span><span className={`${styles.skeletonBlock} ${styles.skeletonExit}`} /></div>
      </div> : <>
      <div className={styles.sidebarTop}>
        <button className={styles.sidebarToggle} type="button" onClick={() => { window.clearTimeout(hoverTimer.current); setSidebar(current => current === 'open' ? 'collapsed' : 'open'); }} aria-expanded={sidebar === 'open'} aria-label={sidebar === 'open' ? 'Contraer menú' : 'Fijar menú abierto'} title={sidebar === 'open' ? 'Contraer menú' : 'Fijar menú abierto'}>
          {sidebar === 'open' ? <PanelLeftClose size={20} aria-hidden="true" /> : <PanelLeftOpen size={20} aria-hidden="true" />}
        </button>
        {!sidebarCollapsed && (role === 'super_admin' || role === 'institution_admin') && institutions.length > 1 && <label className={styles.institutionPicker}>
        <span className={styles.selectControl}><Building2 size={17} aria-hidden="true" /><select value={activeInstitution?.institution_id ?? ''} onChange={event => {
          const selected = institutions.find(item => item.institution_id === event.target.value);
          if (selected) {
            setActiveInstitution(selected);
            navigate(pathname + '?' + new URLSearchParams({ institution: selected.institution_id, slug: selected.slug }).toString());
          }
        }}>
          {institutions.map(item => <option key={item.institution_id} value={item.institution_id}>{item.name}</option>)}
        </select></span>
      </label>}
      </div>
      <nav className={styles.nav} onClickCapture={guardNavigation}>
        {navItems.map(({ label, path, icon: Icon, tone, description }) => <Link data-tone={tone} key={path + label} to={scopedPath(path)} title={`${label}: ${description}`} aria-current={isActive(path) ? 'page' : undefined}><Icon size={20} aria-hidden="true" /><span>{label}</span></Link>)}
      </nav>
      {user && <div className={styles.account}>
        <Link className={styles.identity} onClickCapture={guardNavigation} to={scopedPath(isDeceStaff ? '/panel/dece' : '/panel/admin')} title="Abrir administración de cuenta">
          <span className={styles.avatar}>{user.email?.charAt(0).toUpperCase() || 'U'}</span>
          <span><strong>{user.email}</strong><small>{roleLabel}</small></span>
        </Link>
        <button className={styles.signOut} type="button" onClick={() => void signOut()} aria-label="Salir de la cuenta" title="Salir"><LogOut size={18} aria-hidden="true" /><span>Salir</span></button>
      </div>}
      </>}
    </aside>
    <div className={styles.content}>{children}</div>
  </div>;
}
