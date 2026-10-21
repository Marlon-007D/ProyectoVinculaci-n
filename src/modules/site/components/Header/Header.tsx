import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import type { AsyncState } from "../../types/common";
import type { MenuNode } from "../../types/menu";
import type { SiteConfig } from "../../types/site";
import type { Institution } from "../../types/institution";
import { useInstitution } from "../../context/InstitutionContext";
import { getActiveInstitutions } from "../../services/institutions";
import { AccessibilityControls } from "../Accessibility/AccessibilityControls";
import { AsyncView } from "../states/AsyncView";
import { MobileNavigation } from "../Navigation/MobileNavigation";
import { Navigation } from "../Navigation/Navigation";
import styles from "./Header.module.css";

interface Props {
  config: SiteConfig;
  menu: { state: AsyncState<MenuNode[]>; reload: () => void };
  homeUrl?: string;
}

function ShieldMark({ letter }: { letter: string }) {
  return (
    <svg className="site-brand__mark" viewBox="0 0 40 46" aria-hidden="true" focusable="false">
      <path d="M20 1 L38 7 V23 C38 34 30 41 20 45 C10 41 2 34 2 23 V7 Z" fill="var(--site-accent)" />
      <text x="20" y="30" textAnchor="middle" fontSize="20" fontWeight="700" fill="#ffffff" fontFamily="var(--site-serif)">
        {letter}
      </text>
    </svg>
  );
}

export function Header({ config, menu, homeUrl = "/" }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  const letter = config.name.trim().charAt(0).toUpperCase() || "I";
  const contact = [config.email, config.phone].filter(Boolean).join("  ·  ");
  const { institution } = useInstitution();
  const location = useLocation();
  const navigate = useNavigate();
  const [institutions, setInstitutions] = useState<Institution[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getActiveInstitutions()
      .then((items) => { if (!cancelled) setInstitutions(items); })
      .catch(() => { if (!cancelled) setInstitutions([]); });
    return () => { cancelled = true; };
  }, []);

  const institutionOptions = institution
    ? [institution, ...institutions.filter((item) => item.institution_id !== institution.institution_id)]
    : institutions;
  function changeInstitution(slug: string) {
    const params = new URLSearchParams(location.search);
    params.set("institution", slug);
    const query = params.toString();
    navigate({ pathname: "/", search: query ? "?" + query : "" });
  }
  return (
    <>
      <div className="site-topbar">
        <div className="site-container site-topbar__inner">
          <span>Portal institucional</span>
          <div className="site-topbar__end">
            {institution && <label className={styles.institutionPicker}>
              <span>Institución</span>
              <select
                aria-label="Seleccionar institución"
                value={institution.slug}
                onChange={(event) => changeInstitution(event.target.value)}
              >
                {institutionOptions.map((item) => <option key={item.institution_id} value={item.slug}>{item.name}</option>)}
              </select>
            </label>}
            {institution && <Link
              className={styles.loginLink}
              to={{ pathname: "/" + institution.slug + "/login", search: "?institution=" + encodeURIComponent(institution.institution_id) }}
            >
              Iniciar sesión
            </Link>}
            {contact && <span>{contact}</span>}
            <AccessibilityControls />
          </div>
        </div>
      </div>
      <header className="site-header">
        <div className="site-container site-header__inner">
          <Link to={homeUrl} className="site-brand">
            {config.logoUrl && !logoFailed ? (
              <img className="site-brand__logo" src={config.logoUrl} alt="" width={48} height={48} onError={() => setLogoFailed(true)} />
            ) : (
              <ShieldMark letter={letter} />
            )}
            <span className="site-brand__name">{config.name}</span>
          </Link>
          <AsyncView state={menu.state} onRetry={menu.reload} inline loadingLabel="Cargando menú…" errorTitle="Menú no disponible" emptyFallback={null}>
            {(tree) => (
              <>
                <div className="site-header__desktop"><Navigation tree={tree} /></div>
                <div className="site-header__mobile"><MobileNavigation tree={tree} /></div>
              </>
            )}
          </AsyncView>
        </div>
      </header>
    </>
  );
}
