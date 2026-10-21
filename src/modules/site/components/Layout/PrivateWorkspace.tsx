import { useState, type ReactNode } from 'react';
import { Award, BookOpenText, Building2, Calculator, CalendarDays, ChevronDown, FolderKanban, HeartHandshake, Home, Layers3, Newspaper, PanelTop, ShieldCheck } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../core/AuthContext';
import { useTenant, type InstitutionModuleName } from '../../../../core/TenantContext';
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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const { activeInstitution, institutions, setActiveInstitution, hasModuleAccess } = useTenant();
  const isDeceStaff = role === 'dece_staff';
  const links = role === 'super_admin' ? [] : workspaceLinks.filter(item => {
    if (!item.module) return true;
    if (isDeceStaff) return item.module === 'dece' && hasModuleAccess(item.module);
    return hasModuleAccess(item.module);
  });
  const canManageAcademicContent = role === 'super_admin' || role === 'institution_admin';
  const coursesActive = pathname.startsWith('/panel/cursos');
  const publicationsActive = pathname.startsWith('/panel/publicaciones');
  const [coursesOpen, setCoursesOpen] = useState(true);
  const [publicationsOpen, setPublicationsOpen] = useState(true);

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

  return <div className={styles.workspace}>
    <aside className={styles.aside} aria-label="Navegación del área privada">
      {role === 'super_admin' && institutions.length > 1 && <label className={styles.institutionPicker}>
        <span className={styles.pickerLabel}><Building2 size={14} aria-hidden="true" />Institución activa</span>
        <span className={styles.selectControl}><Building2 size={17} aria-hidden="true" /><select value={activeInstitution?.institution_id ?? ''} onChange={event => {
          const selected = institutions.find(item => item.institution_id === event.target.value);
          if (selected) setActiveInstitution(selected);
        }}>
          {institutions.map(item => <option key={item.institution_id} value={item.institution_id}>{item.name}</option>)}
        </select></span>
      </label>}
      <nav className={styles.nav}>
        {role === 'super_admin' ? <>
          <Link data-tone="institutions" to="/panel/superadmin" aria-current={pathname === '/panel/superadmin' ? 'page' : undefined}><Building2 size={20} aria-hidden="true" />Instituciones educativas</Link>
          <Link data-tone="admin" to="/panel/admin" aria-current={pathname === '/panel/admin' ? 'page' : undefined}><ShieldCheck size={20} aria-hidden="true" />Seguridad y usuarios</Link>
        </> : <>
          {links.map(item => { const Icon = item.icon; return <Link data-tone={toneFor(item.path)} key={item.path} to={item.path} aria-current={pathname === item.path || pathname.startsWith(`${item.path}/`) ? 'page' : undefined}><Icon size={20} aria-hidden="true" />{item.label}</Link>; })}
          {!isDeceStaff && <Link data-tone="admin" to="/panel/admin" aria-current={pathname === '/panel/admin' ? 'page' : undefined}><ShieldCheck size={20} aria-hidden="true" />Administración</Link>}
        </>}
        {canManageAcademicContent && <>
          <section className={`${styles.navGroup} ${coursesOpen ? '' : styles.collapsed}`}>
            <button type="button" className={coursesActive ? styles.groupButtonActive : styles.groupButton} aria-expanded={coursesOpen} onClick={() => setCoursesOpen(value => !value)}><BookOpenText size={20} aria-hidden="true" /><span>Cursos</span><ChevronDown size={18} aria-hidden="true" /></button>
            <div className={styles.subnav}>
              <Link to="/panel/cursos/categorias" aria-current={pathname === '/panel/cursos/categorias' ? 'page' : undefined}><FolderKanban size={18} aria-hidden="true" />Categorías</Link>
              <Link to="/panel/cursos/modulos" aria-current={pathname === '/panel/cursos/modulos' ? 'page' : undefined}><Layers3 size={18} aria-hidden="true" />Módulos</Link>
            </div>
          </section>
          <section className={`${styles.navGroup} ${publicationsOpen ? '' : styles.collapsed}`}>
            <button type="button" className={publicationsActive ? styles.groupButtonActive : styles.groupButton} aria-expanded={publicationsOpen} onClick={() => setPublicationsOpen(value => !value)}><Newspaper size={20} aria-hidden="true" /><span>Publicaciones</span><ChevronDown size={18} aria-hidden="true" /></button>
            <div className={styles.subnav}>
              <Link to="/panel/publicaciones/noticias" aria-current={pathname === '/panel/publicaciones/noticias' ? 'page' : undefined}><Newspaper size={18} aria-hidden="true" />Noticias</Link>
              <Link to="/panel/publicaciones/eventos" aria-current={pathname === '/panel/publicaciones/eventos' ? 'page' : undefined}><CalendarDays size={18} aria-hidden="true" />Eventos</Link>
              <Link to="/panel/publicaciones/cuadro-de-honor" aria-current={pathname === '/panel/publicaciones/cuadro-de-honor' ? 'page' : undefined}><Award size={18} aria-hidden="true" />Cuadro de honor</Link>
            </div>
          </section>
        </>}
      </nav>
      {user && <div className={styles.account}>
        <Link className={styles.identity} to={isDeceStaff ? '/panel/dece' : '/panel/admin'} title="Abrir administración de cuenta">
          <span className={styles.avatar}>{user.email?.charAt(0).toUpperCase() || 'U'}</span>
          <span><strong>{user.email}</strong><small>{roleLabel}</small></span>
        </Link>
        <button type="button" onClick={() => void signOut()}>Salir</button>
      </div>}
    </aside>
    <div className={styles.content}>{children}</div>
  </div>;
}
