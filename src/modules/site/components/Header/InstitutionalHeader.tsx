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
  const { activeInstitution, hasModuleAccess } = useTenant();
  const showNavigation = !location.pathname.startsWith('/panel');
  const showAccount = showNavigation || !user;
  const links = (role === "super_admin" ? [] : moduleLinks).filter(link => hasModuleAccess(link.module));
  const roleLabel = role?.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase()) || "Usuario";

  if (location.pathname.startsWith('/panel') && user) return null;

  async function signOut() {
    await logout();
    navigate("/panel/admin", { replace: true });
  }

  return (
    <header className={styles.header}>
      <div className={styles.topbar}>
        <span>Plataforma Institucional Educativa</span>
        <span>{activeInstitution?.name || "Sede Educativa"}</span>
      </div>
      {(showNavigation || showAccount) && <div className={styles.mainRow}>
        {showNavigation && <nav className={styles.desktopNav} aria-label="Navegación institucional">
          {links.map(link => <Link key={link.path} to={link.path} aria-current={link.active(location.pathname) ? "page" : undefined} className={link.active(location.pathname) ? styles.activeLink : undefined}>{link.label}</Link>)}
        </nav>}
        {showAccount && (user ? <div className={styles.account}>
          <Link to="/panel/admin" className={styles.identity} title="Ver perfil administrativo">
            <span className={styles.avatar}>{user.email?.charAt(0).toUpperCase() || "U"}</span>
            <span className={styles.identityText}><strong>{user.email}</strong><small>{roleLabel}</small></span>
          </Link>
          <button type="button" className={styles.signOut} onClick={() => void signOut()}>Salir</button>
        </div> : <Link to="/panel/admin" className={styles.access}>Acceso Institucional</Link>)}
        {showNavigation && <button type="button" className={styles.menuButton} aria-expanded={mobileOpen} aria-controls="institutional-mobile-nav" onClick={() => setMobileOpen(value => !value)}>{mobileOpen ? "Cerrar" : "Menú"}</button>}
      </div>}
      {showNavigation && mobileOpen && <div className={styles.mobilePanel} id="institutional-mobile-nav">
        <nav aria-label="Navegación institucional móvil">
          {links.map(link => <Link key={link.path} to={link.path} onClick={() => setMobileOpen(false)} aria-current={link.active(location.pathname) ? "page" : undefined}>{link.label}</Link>)}
        </nav>
        {user && <div className={styles.mobileIdentity}><span><strong>{user.email}</strong><small>{roleLabel}</small></span><button type="button" onClick={() => void signOut()}>Salir</button></div>}
      </div>}
    </header>
  );
}
