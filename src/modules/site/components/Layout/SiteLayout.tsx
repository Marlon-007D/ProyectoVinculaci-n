import { Outlet, useLocation } from "react-router-dom";
import { useInstitution } from "../../context/InstitutionContext";
import { useMenus } from "../../hooks/useMenus";
import { useSite } from "../../hooks/useSite";
import { SiteFrame } from "./SiteFrame";

export function SiteLayout() {
  const menu = useMenus();
  const { config } = useSite();
  const { basePath } = useInstitution();
  const { search } = useLocation();
  const institutionSlug = new URLSearchParams(search).get("institution");
  const homeUrl = (basePath || "/") + (institutionSlug ? "?institution=" + encodeURIComponent(institutionSlug) : "");
  return (
    <SiteFrame config={config} menu={menu} homeUrl={homeUrl}>
      <Outlet />
    </SiteFrame>
  );
}
