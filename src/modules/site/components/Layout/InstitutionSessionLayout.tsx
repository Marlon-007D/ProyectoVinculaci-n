import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../../../core/AuthContext";
import { useInstitution } from "../../context/InstitutionContext";
import { useMenus } from "../../hooks/useMenus";
import { useSite } from "../../hooks/useSite";
import { InstitutionalHeader } from "../Header/InstitutionalHeader";
import { SiteFrame } from "./SiteFrame";

export function InstitutionSessionLayout({ children }: { children: ReactNode }) {
  const menu = useMenus();
  const { config } = useSite();
  const { basePath } = useInstitution();
  const { pathname, search } = useLocation();
  const { user } = useAuth();
  const institutionId = new URLSearchParams(search).get("institution");
  const homeUrl = (basePath || "/") + (institutionId ? `?institution=${encodeURIComponent(institutionId)}` : "");
  const isAdminOrDeceLogin = !user && /^\/[^/]+\/(?:admin|dece)(?:\/|$)/.test(pathname);

  return (
    <SiteFrame config={config} menu={menu} homeUrl={homeUrl} header={<InstitutionalHeader />} hideFooter={isAdminOrDeceLogin}>
      {children}
    </SiteFrame>
  );
}
