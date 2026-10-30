import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import { Award, BookOpenText, Building2, Calculator, CalendarDays, ChevronDown, FileText, FolderKanban, HeartHandshake, Home, Inbox, Layers3, LogOut, Menu, Newspaper, PanelLeftClose, PanelLeftOpen, PanelTop, ShieldCheck, Users } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../core/AuthContext';
import { useTenant, type InstitutionModuleName } from '../../../../core/TenantContext';
import { institutionSearch } from '../../../../features/auth/utils/googleOAuth';
import { roleCanOpenModule } from '../../../../modules/admin/auth/roleModules';
import { notify } from '../../../../shared/components/Toaster/notify';
import { confirmAction } from '../../../../shared/components/ConfirmDialog/confirm';
import styles from './PrivateWorkspace.module.css';

type LinkItem = { label: string; path: string; icon: typeof Home; module?: InstitutionModuleName };

const workspaceLinks: LinkItem[] = [
  { label: 'Inicio', path: '/panel', icon: Home },
  { label: 'Proyectos', path: '/panel/proyectos', icon: FolderKanban, module: 'projects' },
  { label: 'DECE', path: '/panel/dece', icon: HeartHandshake, module: 'dece' },
  { label: 'Simuladores', path: '/panel/simuladores', icon: Calculator, module: 'simuladores' },
  { label: 'Portal Web', path: '/panel/portal', icon: PanelTop, module: 'portal' },
];

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
  const links = role === 'super_admin' ? [] : workspaceLinks.filter(item => {
    if (!item.module) return true;
    if (isDeceStaff) return item.module === 'dece' && hasModuleAccess(item.module);
    return hasModuleAccess(item.module) && roleCanOpenModule(role, item.module);
  });
  const canManageAcademicContent = role === 'super_admin' || role === 'institution_admin';
  const coursesActive = pathname.startsWith('/panel/cursos');
  const publicationsActive = pathname.startsWith('/panel/publicaciones');
  const [openGroup, setOpenGroup] = useState<'courses' | 'publications' | null>(null);
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

  useEffect(() => {
    if (coursesActive) setOpenGroup('courses');
    if (publicationsActive) setOpenGroup('publications');
  }, [coursesActive, publicationsActive]);

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

  const toneFor = (path: string) => path.includes('proyectos') ? 'projects'
    : path.includes('dece') ? 'dece'
      : path.includes('simuladores') ? 'simulators'
        : path.includes('portal') ? 'portal'
          : path.includes('superadmin') ? 'institutions'
            : path.includes('admin') ? 'admin' : 'home';
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
  const deceSections = [
    { label: 'Inicio DECE', path: '/panel/dece', icon: Home },
    { label: 'Estudiantes', path: '/panel/dece/estudiantes', icon: Users },
    { label: 'Casos', path: '/panel/dece/casos', icon: HeartHandshake },
    { label: 'Plantillas de fichas', path: '/panel/dece/plantillas', icon: FileText },
    { label: 'Revisión de fichas', path: '/panel/dece/envios', icon: Inbox },
  ];
  function deceGroup(item: LinkItem) {
    return <section className={`${styles.navGroup} ${styles.alwaysOpen}`} key={item.path} aria-label="DECE">
      <div className={styles.groupLabel} title="DECE: atención y acompañamiento estudiantil"><HeartHandshake size={20} aria-hidden="true" /><span>DECE</span></div>
      <div className={styles.subnav}>
        {deceSections.map(({ label, path, icon: Icon }) => <Link key={path} title={label} to={scopedPath(path)} aria-current={pathname === path || (path !== '/panel/dece' && pathname.startsWith(path + '/')) ? 'page' : undefined}><Icon size={18} aria-hidden="true" /><span>{label}</span></Link>)}
      </div>
    </section>;
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
        <button className={styles.sidebarToggle} type="button" onClick={() => { window.clearTimeout(hoverTimer.current); setSidebar(current => current === 'open' ? 'collapsed' : 'open'); setOpenGroup(null); }} aria-expanded={sidebar === 'open'} aria-label={sidebar === 'open' ? 'Contraer menú' : 'Fijar menú abierto'} title={sidebar === 'open' ? 'Contraer menú' : 'Fijar menú abierto'}>
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
        {role === 'super_admin' ? <>
          <Link data-tone="institutions" to={scopedPath("/panel/superadmin")} title="Instituciones educativas: gestiona las instituciones del sistema" aria-current={pathname === '/panel/superadmin' ? 'page' : undefined}><Building2 size={20} aria-hidden="true" /><span>Instituciones educativas</span></Link>
          <Link data-tone="admin" to={scopedPath("/panel/admin")} title="Seguridad y usuarios: administra cuentas y permisos" aria-current={pathname === '/panel/admin' ? 'page' : undefined}><ShieldCheck size={20} aria-hidden="true" /><span>Seguridad y usuarios</span></Link>
        </> : <>
          {links.map(item => { if (item.module === 'dece') return deceGroup(item); const Icon = item.icon; const descriptions: Record<string, string> = { Inicio: 'Resumen del panel institucional', Proyectos: 'Gestiona proyectos de vinculación', DECE: 'Atención y acompañamiento estudiantil', Simuladores: 'Herramientas académicas de cálculo', 'Portal Web': 'Administra el contenido del sitio institucional' }; return <Link data-tone={toneFor(item.path)} key={item.path} to={scopedPath(item.path)} title={`${item.label}: ${descriptions[item.label]}`} aria-current={pathname === item.path || pathname.startsWith(`${item.path}/`) ? 'page' : undefined}><Icon size={20} aria-hidden="true" /><span>{item.label}</span></Link>; })}
          {!isDeceStaff && <Link data-tone="admin" to={scopedPath("/panel/admin")} title="Administración: consulta cuentas, accesos y permisos" aria-current={pathname === '/panel/admin' ? 'page' : undefined}><ShieldCheck size={20} aria-hidden="true" /><span>Administración</span></Link>}
        </>}
        {canManageAcademicContent && <>
          <section className={`${styles.navGroup} ${openGroup === 'courses' ? '' : styles.collapsed}`}>
            <button type="button" title="Cursos: organiza categorías y módulos académicos" className={coursesActive ? styles.groupButtonActive : styles.groupButton} aria-expanded={openGroup === 'courses'} onClick={() => { if (sidebarCollapsed) setSidebar('open'); setOpenGroup(value => value === 'courses' && !sidebarCollapsed ? null : 'courses'); }}><BookOpenText size={20} aria-hidden="true" /><span>Cursos</span><ChevronDown size={18} aria-hidden="true" /></button>
            <div className={styles.subnav}>
              <Link title="Categorías: clasifica la oferta de cursos" to={scopedPath("/panel/cursos/categorias")} aria-current={pathname === '/panel/cursos/categorias' ? 'page' : undefined}><FolderKanban size={18} aria-hidden="true" /><span>Categorías</span></Link>
              <Link title="Módulos: administra los contenidos de los cursos" to={scopedPath("/panel/cursos/modulos")} aria-current={pathname === '/panel/cursos/modulos' ? 'page' : undefined}><Layers3 size={18} aria-hidden="true" /><span>Módulos</span></Link>
            </div>
          </section>
          <section className={`${styles.navGroup} ${openGroup === 'publications' ? '' : styles.collapsed}`}>
            <button type="button" title="Publicaciones: gestiona noticias, eventos y reconocimientos" className={publicationsActive ? styles.groupButtonActive : styles.groupButton} aria-expanded={openGroup === 'publications'} onClick={() => { if (sidebarCollapsed) setSidebar('open'); setOpenGroup(value => value === 'publications' && !sidebarCollapsed ? null : 'publications'); }}><Newspaper size={20} aria-hidden="true" /><span>Publicaciones</span><ChevronDown size={18} aria-hidden="true" /></button>
            <div className={styles.subnav}>
              <Link title="Noticias: publica novedades institucionales" to={scopedPath("/panel/publicaciones/noticias")} aria-current={pathname === '/panel/publicaciones/noticias' ? 'page' : undefined}><Newspaper size={18} aria-hidden="true" /><span>Noticias</span></Link>
              <Link title="Eventos: publica actividades y fechas institucionales" to={scopedPath("/panel/publicaciones/eventos")} aria-current={pathname === '/panel/publicaciones/eventos' ? 'page' : undefined}><CalendarDays size={18} aria-hidden="true" /><span>Eventos</span></Link>
              <Link title="Cuadro de honor: administra reconocimientos estudiantiles" to={scopedPath("/panel/publicaciones/cuadro-de-honor")} aria-current={pathname === '/panel/publicaciones/cuadro-de-honor' ? 'page' : undefined}><Award size={18} aria-hidden="true" /><span>Cuadro de honor</span></Link>
            </div>
          </section>
        </>}
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
