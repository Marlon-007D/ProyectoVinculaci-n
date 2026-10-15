import { Outlet } from "react-router-dom";
import { useInstitution } from "../../context/InstitutionContext";
import { useMenus } from "../../hooks/useMenus";
import { useSite } from "../../hooks/useSite";
import { SiteFrame } from "./SiteFrame";

export function SiteLayout() {
  const menu = useMenus();
  const { config } = useSite();
  const { basePath } = useInstitution();
  return (
    <SiteFrame config={config} menu={menu} homeUrl={basePath || "/"}>
      <Outlet />
    </SiteFrame>
  );
}
