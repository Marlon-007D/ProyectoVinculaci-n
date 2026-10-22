import { useEffect, useState, type ReactNode } from 'react';
import { Award, BookOpenText, Building2, Calculator, CalendarDays, ChevronDown, FolderKanban, HeartHandshake, Home, Layers3, LogOut, Newspaper, PanelLeftClose, PanelLeftOpen, PanelTop, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../core/AuthContext';
import { useTenant, type InstitutionModuleName } from '../../../../core/TenantContext';
import styles from './PrivateWorkspace.module.css';

type LinkItem = { label: string; path: string; icon: typeof Home; module?: InstitutionModuleName };
const SIDEBAR_PREFERENCE_KEY = 'institutional-panel-sidebar-collapsed';

function readSidebarPreference() {
  try {
    return window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === 'true';
  } catch {
    return false;
  }
}

const workspaceLinks: LinkItem[] = [
  { label: 'Inicio', path: '/panel', icon: Home },
  { label: 'Proyectos', path: '/panel/proyectos', icon: FolderKanban, module: 'projects' },
  { label: 'DECE', path: '/panel/dece', icon: HeartHandshake, module: 'dece' },
  { label: 'Simuladores', path: '/panel/simuladores', icon: Calculator, module: 'simuladores' },
  { label: 'Portal Web', path: '/panel/portal', icon: PanelTop, module: 'portal' },
];

export function PrivateWorkspace({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, role, logout, loading: loadingAuth } = useAuth();
  const { activeInstitution, institutions, setActiveInstitution, hasModuleAccess, loadingTenant } = useTenant();
  const sidebarLoading = loadingAuth || loadingTenant;
  const isDeceStaff = role === 'dece_staff';
  const links = role === 'super_admin' ? [] : workspaceLinks.filter(item => {
    if (!item.module) return true;
    if (isDeceStaff) return item.module === 'dece' && hasModuleAccess(item.module);
    return hasModuleAccess(item.module);
  });
  const canManageAcademicContent = role === 'super_admin' || role === 'institution_admin';
  const coursesActive = pathname.startsWith('/panel/cursos');
  const publicationsActive = pathname.startsWith('/panel/publicaciones');
  const [openGroup, setOpenGroup] = useState<'courses' | 'publications' | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarPreference);

  useEffect(() => {
    if (coursesActive) setOpenGroup('courses');
    if (publicationsActive) setOpenGroup('publications');
  }, [coursesActive, publicationsActive]);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(sidebarCollapsed));
    } catch {
      // Keep the current session preference when browser storage is unavailable.
    }
  }, [sidebarCollapsed]);

  const toneFor = (path: string) => path.includes('proyectos') ? 'projects'
    : path.includes('dece') ? 'dece'
      : path.includes('simuladores') ? 'simulators'
        : path.includes('portal') ? 'portal'
          : path.includes('superadmin') ? 'institutions'
            : path.includes('admin') ? 'admin' : 'home';
  const roleLabel = role?.replaceAll('_', ' ').replace(/\b\w/g, letter => letter.toUpperCase()) || 'Usuario';

  async function signOut() {
    await logout();
    navigate('/panel/admin', { replace: true });
  }

  return <div className={`${styles.workspace} ${sidebarCollapsed ? styles.workspaceCollapsed : ''}`}>
    <aside className={styles.aside} aria-label="Navegación del área privada" aria-busy={sidebarLoading}>
      {sidebarLoading ? <div className={`${styles.sidebarSkeleton} ${sidebarCollapsed ? styles.sidebarSkeletonCollapsed : ''}`} role="status" aria-label="Cargando navegación">
        <div className={styles.skeletonTop}><span className={`${styles.skeletonBlock} ${styles.skeletonToggle}`} /><span className={`${styles.skeletonBlock} ${styles.skeletonInstitution}`} /></div>
        <div className={styles.skeletonNav}>{[0, 1, 2, 3, 4].map(item => <div className={styles.skeletonItem} key={item}><span className={`${styles.skeletonBlock} ${styles.skeletonIcon}`} /><span className={`${styles.skeletonBlock} ${styles.skeletonLabel}`} /></div>)}</div>
        <div className={styles.skeletonAccount}><span className={`${styles.skeletonBlock} ${styles.skeletonAvatar}`} /><span className={styles.skeletonAccountText}><i className={styles.skeletonBlock} /><i className={styles.skeletonBlock} /></span><span className={`${styles.skeletonBlock} ${styles.skeletonExit}`} /></div>
      </div> : <>
      <div className={styles.sidebarTop}>
        <button className={styles.sidebarToggle} type="button" onClick={() => { setSidebarCollapsed(value => !value); setOpenGroup(null); }} aria-label={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'} title={sidebarCollapsed ? 'Expandir menú' : 'Contraer menú'}>
          {sidebarCollapsed ? <PanelLeftOpen size={20} aria-hidden="true" /> : <PanelLeftClose size={20} aria-hidden="true" />}
        </button>
        {!sidebarCollapsed && role === 'super_admin' && institutions.length > 1 && <label className={styles.institutionPicker}>
        <span className={styles.selectControl}><Building2 size={17} aria-hidden="true" /><select value={activeInstitution?.institution_id ?? ''} onChange={event => {
          const selected = institutions.find(item => item.institution_id === event.target.value);
          if (selected) setActiveInstitution(selected);
        }}>
          {institutions.map(item => <option key={item.institution_id} value={item.institution_id}>{item.name}</option>)}
        </select></span>
      </label>}
      </div>
      <nav className={styles.nav}>
        {role === 'super_admin' ? <>
          <Link data-tone="institutions" to="/panel/superadmin" title="Instituciones educativas: gestiona las instituciones del sistema" aria-current={pathname === '/panel/superadmin' ? 'page' : undefined}><Building2 size={20} aria-hidden="true" /><span>Instituciones educativas</span></Link>
          <Link data-tone="admin" to="/panel/admin" title="Seguridad y usuarios: administra cuentas y permisos" aria-current={pathname === '/panel/admin' ? 'page' : undefined}><ShieldCheck size={20} aria-hidden="true" /><span>Seguridad y usuarios</span></Link>
        </> : <>
          {links.map(item => { const Icon = item.icon; const descriptions: Record<string, string> = { Inicio: 'Resumen del panel institucional', Proyectos: 'Gestiona proyectos de vinculación', DECE: 'Atención y acompañamiento estudiantil', Simuladores: 'Herramientas académicas de cálculo', 'Portal Web': 'Administra el contenido del sitio institucional' }; return <Link data-tone={toneFor(item.path)} key={item.path} to={item.path} title={`${item.label}: ${descriptions[item.label]}`} aria-current={pathname === item.path || pathname.startsWith(`${item.path}/`) ? 'page' : undefined}><Icon size={20} aria-hidden="true" /><span>{item.label}</span></Link>; })}
          {!isDeceStaff && <Link data-tone="admin" to="/panel/admin" title="Administración: consulta cuentas, accesos y permisos" aria-current={pathname === '/panel/admin' ? 'page' : undefined}><ShieldCheck size={20} aria-hidden="true" /><span>Administración</span></Link>}
        </>}
        {canManageAcademicContent && <>
          <section className={`${styles.navGroup} ${openGroup === 'courses' ? '' : styles.collapsed}`}>
            <button type="button" title="Cursos: organiza categorías y módulos académicos" className={coursesActive ? styles.groupButtonActive : styles.groupButton} aria-expanded={openGroup === 'courses'} onClick={() => { if (sidebarCollapsed) setSidebarCollapsed(false); setOpenGroup(value => value === 'courses' && !sidebarCollapsed ? null : 'courses'); }}><BookOpenText size={20} aria-hidden="true" /><span>Cursos</span><ChevronDown size={18} aria-hidden="true" /></button>
            <div className={styles.subnav}>
              <Link title="Categorías: clasifica la oferta de cursos" to="/panel/cursos/categorias" aria-current={pathname === '/panel/cursos/categorias' ? 'page' : undefined}><FolderKanban size={18} aria-hidden="true" /><span>Categorías</span></Link>
              <Link title="Módulos: administra los contenidos de los cursos" to="/panel/cursos/modulos" aria-current={pathname === '/panel/cursos/modulos' ? 'page' : undefined}><Layers3 size={18} aria-hidden="true" /><span>Módulos</span></Link>
            </div>
          </section>
          <section className={`${styles.navGroup} ${openGroup === 'publications' ? '' : styles.collapsed}`}>
            <button type="button" title="Publicaciones: gestiona noticias, eventos y reconocimientos" className={publicationsActive ? styles.groupButtonActive : styles.groupButton} aria-expanded={openGroup === 'publications'} onClick={() => { if (sidebarCollapsed) setSidebarCollapsed(false); setOpenGroup(value => value === 'publications' && !sidebarCollapsed ? null : 'publications'); }}><Newspaper size={20} aria-hidden="true" /><span>Publicaciones</span><ChevronDown size={18} aria-hidden="true" /></button>
            <div className={styles.subnav}>
              <Link title="Noticias: publica novedades institucionales" to="/panel/publicaciones/noticias" aria-current={pathname === '/panel/publicaciones/noticias' ? 'page' : undefined}><Newspaper size={18} aria-hidden="true" /><span>Noticias</span></Link>
              <Link title="Eventos: publica actividades y fechas institucionales" to="/panel/publicaciones/eventos" aria-current={pathname === '/panel/publicaciones/eventos' ? 'page' : undefined}><CalendarDays size={18} aria-hidden="true" /><span>Eventos</span></Link>
              <Link title="Cuadro de honor: administra reconocimientos estudiantiles" to="/panel/publicaciones/cuadro-de-honor" aria-current={pathname === '/panel/publicaciones/cuadro-de-honor' ? 'page' : undefined}><Award size={18} aria-hidden="true" /><span>Cuadro de honor</span></Link>
            </div>
          </section>
        </>}
      </nav>
      {user && <div className={styles.account}>
        <Link className={styles.identity} to={isDeceStaff ? '/panel/dece' : '/panel/admin'} title="Abrir administración de cuenta">
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
