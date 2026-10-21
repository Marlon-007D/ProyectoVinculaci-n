import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../../core/AuthContext";
import { useTenant, type InstitutionModuleName } from "../../../../core/TenantContext";
import styles from "./InstitutionalHeader.module.css";

const moduleLinks: { label: string; path: string; module: InstitutionModuleName; active: (pathname: string) => boolean }[] = [
  { label: "Inicio", path: "/panel", module: "inicio", active: path => path === "/panel" || path === "/" || path === "/inicio" },
  { label: "Proyectos", path: "/panel/proyectos", module: "projects", active: path => path.startsWith("/panel/proyectos") || path === "/proyectos" },
  { label: "DECE", path: "/panel/dece", module: "dece", active: path => path.startsWith("/panel/dece") || path === "/dece" || /^\/[^/]+\/dece(?:\/|$)/.test(path) },
  { label: "Simuladores", path: "/panel/simuladores", module: "simuladores", active: path => path.startsWith("/panel/simuladores") || path === "/simuladores" },
  { label: "Portal Web", path: "/panel/portal", module: "portal", active: path => path.startsWith("/panel/portal") || path.startsWith("/portal") },
];

export function InstitutionalHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, role, logout } = useAuth();
  const { activeInstitution, institutions, setActiveInstitution, hasModuleAccess } = useTenant();
  const links = (role === "super_admin" ? [] : moduleLinks).filter(link => hasModuleAccess(link.module));
  const roleLabel = role?.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()) || "Usuario";

  async function signOut() {
    await logout();
    navigate("/panel/admin", { replace: true });
  }

  return (
    <header className={styles.header}>
      <div className={styles.topbar}>
        <span>Plataforma Institucional Educativa</span>
        {role === "super_admin" && institutions.length > 1 ? (
          <select aria-label="Seleccionar institución" value={activeInstitution?.institution_id ?? ""} onChange={event => {
            const selected = institutions.find(item => item.institution_id === event.target.value);
            if (selected) setActiveInstitution(selected);
          }}>
            {institutions.map(item => <option key={item.institution_id} value={item.institution_id}>{item.name}</option>)}
          </select>
        ) : <span>{activeInstitution?.name || "Sede Educativa"}</span>}
      </div>
      <div className={styles.mainRow}>
        <Link to="/panel" className={styles.brand} aria-label="Ir al panel institucional">
          <span className={styles.badge}>UE</span>
          <span className={styles.brandText}><strong>{activeInstitution?.name || "Plataforma Institucional"}</strong><small>PLATAFORMA INSTITUCIONAL</small></span>
        </Link>
        <nav className={styles.desktopNav} aria-label="Navegación institucional">
          {links.map(link => <Link key={link.path} to={link.path} aria-current={link.active(location.pathname) ? "page" : undefined} className={link.active(location.pathname) ? styles.activeLink : undefined}>{link.label}</Link>)}
        </nav>
        {user ? <div className={styles.account}>
          <Link to="/panel/admin" className={styles.identity} title="Ver perfil administrativo">
            <span className={styles.avatar}>{user.email?.charAt(0).toUpperCase() || "U"}</span>
            <span className={styles.identityText}><strong>{user.email}</strong><small>{roleLabel}</small></span>
          </Link>
          <button type="button" className={styles.signOut} onClick={() => void signOut()}>Salir</button>
        </div> : <Link to="/panel/admin" className={styles.access}>Acceso Institucional</Link>}
        <button type="button" className={styles.menuButton} aria-expanded={mobileOpen} aria-controls="institutional-mobile-nav" onClick={() => setMobileOpen(value => !value)}>{mobileOpen ? "Cerrar" : "Menú"}</button>
      </div>
      {mobileOpen && <div className={styles.mobilePanel} id="institutional-mobile-nav">
        <nav aria-label="Navegación institucional móvil">
          {links.map(link => <Link key={link.path} to={link.path} onClick={() => setMobileOpen(false)} aria-current={link.active(location.pathname) ? "page" : undefined}>{link.label}</Link>)}
        </nav>
        {user && <div className={styles.mobileIdentity}><span><strong>{user.email}</strong><small>{roleLabel}</small></span><button type="button" onClick={() => void signOut()}>Salir</button></div>}
      </div>}
    </header>
  );
}
