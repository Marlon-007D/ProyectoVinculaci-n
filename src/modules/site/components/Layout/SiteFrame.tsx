import type { ReactNode } from "react";
import type { AsyncState } from "../../types/common";
import type { MenuNode } from "../../types/menu";
import type { SiteConfig } from "../../types/site";
import { Footer } from "../Footer/Footer";
import { Header } from "../Header/Header";
import "../../styles/layout.css";

interface Props {
  config: SiteConfig;
  menu: { state: AsyncState<MenuNode[]>; reload: () => void };
  homeUrl?: string;
  children: ReactNode;
}

export function SiteFrame({ config, menu, homeUrl, children }: Props) {
  return (
    <div className="site-root" style={config.themeVars}>
      <a className="site-skip" href="#contenido">Saltar al contenido</a>
      <Header config={config} menu={menu} homeUrl={homeUrl} />
      <main id="contenido" tabIndex={-1} className="site-main">
        {children}
      </main>
      <Footer config={config} tree={menu.state.status === "success" ? menu.state.data : []} />
    </div>
  );
}
