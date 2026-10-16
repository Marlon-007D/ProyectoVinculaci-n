import { useState } from "react";
import { Link } from "react-router-dom";
import type { AsyncState } from "../../types/common";
import type { MenuNode } from "../../types/menu";
import type { SiteConfig } from "../../types/site";
import { AsyncView } from "../states/AsyncView";
import { MobileNavigation } from "../Navigation/MobileNavigation";
import { Navigation } from "../Navigation/Navigation";

interface Props {
  config: SiteConfig;
  menu: { state: AsyncState<MenuNode[]>; reload: () => void };
  homeUrl?: string;
}

export function Header({ config, menu, homeUrl = "/" }: Props) {
  const [logoFailed, setLogoFailed] = useState(false);
  return (
    <header className="site-header">
      <div className="site-container site-header__inner">
        <Link to={homeUrl} className="site-brand">
          {config.logoUrl && !logoFailed && (
            <img className="site-brand__logo" src={config.logoUrl} alt="" width={48} height={48} onError={() => setLogoFailed(true)} />
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
  );
}
