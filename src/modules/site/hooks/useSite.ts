import { useMemo } from "react";
import { useAsync } from "./useAsync";
import { useInstitution } from "../context/InstitutionContext";
import { getSiteSettings } from "../services/siteSettings";
import { getTheme } from "../services/theme";
import { buildSiteConfig } from "../utils/siteConfig";
import { themeToStyle } from "../utils/theme";

export function useSite() {
  const { institutionId, institution } = useInstitution();
  const settings = useAsync(() => getSiteSettings(institutionId), [institutionId]);
  const row = settings.state.status === "success" ? settings.state.data : null;
  const themeId = row?.theme_id ?? null;
  const theme = useAsync(() => (themeId ? getTheme(themeId) : Promise.resolve(null)), [themeId]);
  const themeRow = theme.state.status === "success" ? theme.state.data : null;

  const config = useMemo(() => buildSiteConfig(institution, row), [institution, row]);
  const style = useMemo(() => themeToStyle(themeRow), [themeRow]);
  return { config, style };
}
