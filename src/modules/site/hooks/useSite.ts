import { useCallback, useMemo } from "react";
import { useAsync } from "./useAsync";
import { useInstitution } from "../context/InstitutionContext";
import { getTheme } from "../services/content";
import { getSiteSettings } from "../services/siteSettings";
import { buildSiteConfig } from "../utils/siteConfig";
import { buildThemeVars } from "../utils/theme";

export function useSite() {
  const { institutionId, institution } = useInstitution();
  const settings = useAsync(() => getSiteSettings(institutionId), [institutionId], undefined, { keepPrevious: true });
  const row = settings.state.status === "success" ? settings.state.data : null;
  const themeId = row?.theme_id ?? null;
  const theme = useAsync(() => getTheme(themeId), [themeId]);
  const themeRow = theme.state.status === "success" ? theme.state.data : null;
  const config = useMemo(
    () => ({ ...buildSiteConfig(institution, row), themeVars: buildThemeVars(themeRow) }),
    [institution, row, themeRow],
  );
  const refresh = useCallback(() => { settings.refresh(); theme.refresh(); }, [settings.refresh, theme.refresh]);
  return { config, refresh };
}
