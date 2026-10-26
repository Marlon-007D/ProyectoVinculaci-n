import { useLayoutEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useInstitution } from "../../context/InstitutionContext";
import { useMenus } from "../../hooks/useMenus";
import { useSite } from "../../hooks/useSite";
import { standardizePublicMenu } from "../../utils/menuTree";
import { SiteFrame } from "./SiteFrame";

export function SiteLayout() {
  const menu = useMenus();
  const { config } = useSite();
  const { basePath } = useInstitution();
  const { pathname, search } = useLocation();
  const searchParams = new URLSearchParams(search);
  const institutionSlug = searchParams.get("institution");
  const pageKey = ["slug", "noticia", "evento", "honores"].map((key) => searchParams.get(key) ?? "").join(":");
  const homeUrl = (basePath || "/") + (institutionSlug ? "?institution=" + encodeURIComponent(institutionSlug) : "");
  const publicMenu = menu.state.status === "success"
    ? { ...menu, state: { ...menu.state, data: standardizePublicMenu(menu.state.data) } }
    : menu;

  useLayoutEffect(() => {
    const previousRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => { window.history.scrollRestoration = previousRestoration; };
  }, []);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, pageKey]);

  return (
    <SiteFrame config={config} menu={publicMenu} homeUrl={homeUrl}>
      <Outlet />
    </SiteFrame>
  );
}
