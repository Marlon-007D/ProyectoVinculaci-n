import type { CSSProperties, ReactNode } from "react";
import type { AsyncState } from "../../types/common";
import type { MenuNode } from "../../types/menu";
import type { SiteConfig } from "../../types/site";
import { Footer } from "../Footer/Footer";
import { Header } from "../Header/Header";
import "../../styles/layout.css";

interface Props {
  config: SiteConfig;
  menu: { state: AsyncState<MenuNode[]>; reload: () => void };
  style?: CSSProperties;
  homeUrl?: string;
  children: ReactNode;
}

export function SiteFrame({ config, menu, style, homeUrl, children }: Props) {
  return (
    <div className="site-root" style={style}>
      <a className="site-skip" href="#contenido">Saltar al contenido</a>
      <Header config={config} menu={menu} homeUrl={homeUrl} />
      <main id="contenido" tabIndex={-1} className="site-main">
        {children}
      </main>
      <Footer config={config} tree={menu.state.status === "success" ? menu.state.data : []} />
    </div>
  );
}
