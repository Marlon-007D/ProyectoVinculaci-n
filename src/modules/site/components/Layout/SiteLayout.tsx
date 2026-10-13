import { Outlet } from "react-router-dom";
import { useMenus } from "../../hooks/useMenus";
import { useSite } from "../../hooks/useSite";
import { SiteFrame } from "./SiteFrame";

export function SiteLayout() {
  const menu = useMenus();
  const { config, style } = useSite();
  return (
    <SiteFrame config={config} menu={menu} style={style}>
      <Outlet />
    </SiteFrame>
  );
}
