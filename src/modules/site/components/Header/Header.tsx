import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AsyncState } from "../../types/common";
import type { MenuNode } from "../../types/menu";
import type { SiteConfig } from "../../types/site";
import { useInstitution } from "../../context/InstitutionContext";
import { AccessibilityControls } from "../Accessibility/AccessibilityControls";
import { institutionalNavigation } from "../../utils/institutionalNavigation";
import styles from "./Header.module.css";
import { MobileNavigation } from "../Navigation/MobileNavigation";
import { Navigation } from "../Navigation/Navigation";

interface Props {
  config: SiteConfig;
  menu: { state: AsyncState<MenuNode[]>; reload: () => void };
  homeUrl?: string;
  preview?: boolean;
}

function ShieldMark({ letter }: { letter: string }) {
  return (
    <svg className="site-brand__mark" viewBox="0 0 40 46" aria-hidden="true" focusable="false">
      <path d="M20 1 L38 7 V23 C38 34 30 41 20 45 C10 41 2 34 2 23 V7 Z" fill="var(--site-accent)" />
      <text x="20" y="30" textAnchor="middle" fontSize="20" fontWeight="700" fill="#ffffff" fontFamily="var(--site-font)">
        {letter}
      </text>
    </svg>
  );
}

export function Header({ config, homeUrl = "/", preview = false }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  useEffect(() => setLogoFailed(false), [config.logoUrl]);
  const letter = config.name.trim().charAt(0).toUpperCase() || "I";
  const { institution } = useInstitution();
  const tree = institutionalNavigation(institution?.institution_id);
  const loginUrl = institution
    ? `/${institution.slug}/login?institution=${encodeURIComponent(institution.institution_id)}`
    : undefined;

  return (
    <header className={`site-header ${styles.fixedHeader}`}>
      <div className="site-container site-header__inner">
        <Link to={homeUrl} className="site-brand" aria-label={`Inicio: ${config.name}`}>
          {config.logoUrl && !logoFailed ? (
            <img className="site-brand__logo" src={config.logoUrl} alt="" width={48} height={48} onError={() => setLogoFailed(true)} />
          ) : (
            <ShieldMark letter={letter} />
          )}
          <span className="site-brand__name" title={config.name}>{config.name}</span>
        </Link>
              <div className="site-header__desktop"><Navigation tree={tree} loginUrl={loginUrl} /></div>
              <div className="site-header__mobile"><MobileNavigation tree={tree} loginUrl={loginUrl} /></div>
        {!preview && <AccessibilityControls />}
      </div>
    </header>
  );
}
