import type { ReactNode } from "react";
import type { AsyncState } from "../../types/common";
import type { MenuNode } from "../../types/menu";
import type { SiteConfig } from "../../types/site";
import { useSearchParams } from "react-router-dom";
import { Footer } from "../Footer/Footer";
import { Header } from "../Header/Header";
import { PublicSidebar } from "../Navigation/PublicSidebar";
import "../../styles/layout.css";

interface Props {
  config: SiteConfig;
  menu: { state: AsyncState<MenuNode[]>; reload: () => void };
  homeUrl?: string;
  header?: ReactNode;
  hideFooter?: boolean;
  showPublicSidebar?: boolean;
  preview?: boolean;
  children: ReactNode;
}

export function SiteFrame({ config, menu, homeUrl, header, hideFooter = false, showPublicSidebar = false, preview = false, children }: Props) {
  const [params] = useSearchParams();
  const isStandaloneSimulator = Boolean(params.get("simulator"));
  const isStandaloneCourse = params.get("courses") === "1" && Boolean(params.get("course"));
  const hideSiteChrome = isStandaloneCourse;
  return (
    <div className={`site-root${isStandaloneSimulator ? " site-root--simulator" : ""}${isStandaloneCourse ? " site-root--course" : ""}`} style={config.themeVars}>
      {!hideSiteChrome && <a className="site-skip" href="#contenido">Saltar al contenido</a>}
      {!hideSiteChrome && (header ?? <Header config={config} menu={menu} homeUrl={homeUrl} preview={preview} />)}
      {showPublicSidebar && !hideSiteChrome ? (
        <div className="site-page-layout">
          {menu.state.status === "success" && <PublicSidebar config={config} tree={menu.state.data} />}
          <div className="site-page-content">
            <main id="contenido" tabIndex={-1} className="site-main">{children}</main>
            {!hideFooter && !isStandaloneCourse && <Footer config={config} tree={menu.state.status === "success" ? menu.state.data : []} />}
          </div>
        </div>
      ) : (
        <>
          <main id="contenido" tabIndex={-1} className={`site-main${isStandaloneSimulator ? " site-main--simulator" : ""}${isStandaloneCourse ? " site-main--course" : ""}`}>
            {children}
          </main>
          {!hideSiteChrome && !hideFooter && !isStandaloneCourse && <Footer config={config} tree={menu.state.status === "success" ? menu.state.data : []} />}
        </>
      )}
    </div>
  );
}
