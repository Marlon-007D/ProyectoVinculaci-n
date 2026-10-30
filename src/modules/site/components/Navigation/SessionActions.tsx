import { Link } from "react-router-dom";
import { useAuth } from "../../../../core/AuthContext";
import { notify } from "../../../../shared/components/Toaster/notify";
import { useInstitution } from "../../context/InstitutionContext";
import { publicSessionActions } from "../../utils/sessionActions";
import { NavigationIcon } from "./NavigationIcon";

/** Login, or panel and sign-out when a session exists. `variant` picks the desktop or mobile menu classes. */
export function SessionActions({ variant, onNavigate }: { variant: "desktop" | "mobile"; onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const { institution } = useInstitution();
  const itemClass = variant === "desktop" ? "site-nav__item" : undefined;
  const linkClass = variant === "desktop" ? "site-nav__link" : "site-mnav__link";
  const signOut = async () => {
    onNavigate?.();
    try { await logout(); } catch { notify.error("No se pudo cerrar la sesión. Revisa tu conexión e intenta nuevamente."); }
  };
  return <>
    {publicSessionActions(Boolean(user), institution ?? undefined).map(action => <li key={action.kind} className={itemClass}>
      {action.kind === "logout"
        ? <button type="button" className={`${linkClass} site-session-button`} onClick={() => void signOut()}><NavigationIcon label={action.label} /><span>{action.label}</span></button>
        : <Link to={action.to} className={linkClass} onClick={onNavigate}><NavigationIcon label={action.label} /><span>{action.label}</span></Link>}
    </li>)}
  </>;
}
