import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useInstitution } from "../../context/InstitutionContext";
import { useMenus } from "../../hooks/useMenus";
import { useSite } from "../../hooks/useSite";
import { InstitutionalHeader } from "../Header/InstitutionalHeader";
import { SiteFrame } from "./SiteFrame";

export function InstitutionSessionLayout({ children }: { children: ReactNode }) {
  const menu = useMenus();
  const { config } = useSite();
  const { basePath } = useInstitution();
  const { search } = useLocation();
  const institutionId = new URLSearchParams(search).get("institution");
  const homeUrl = (basePath || "/") + (institutionId ? `?institution=${encodeURIComponent(institutionId)}` : "");

  return (
    <SiteFrame config={config} menu={menu} homeUrl={homeUrl} header={<InstitutionalHeader />}>
      {children}
    </SiteFrame>
  );
}
