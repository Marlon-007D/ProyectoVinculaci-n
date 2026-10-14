import { useMemo } from "react";
import { useAsync } from "./useAsync";
import { useInstitution } from "../context/InstitutionContext";
import { getSiteSettings } from "../services/siteSettings";
import { buildSiteConfig } from "../utils/siteConfig";

export function useSite() {
  const { institutionId, institution } = useInstitution();
  const settings = useAsync(() => getSiteSettings(institutionId), [institutionId]);
  const row = settings.state.status === "success" ? settings.state.data : null;
  const config = useMemo(() => buildSiteConfig(institution, row), [institution, row]);
  return { config };
}
