import { getSupabase } from "../lib/supabase";
import { toServiceError } from "../lib/errors";
import type { SiteSettingsRow } from "../types/site";

export async function getSiteSettings(institutionId: string): Promise<SiteSettingsRow | null> {
  const { data, error } = await getSupabase()
    .from("site_settings")
    .select("*")
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (error) throw toServiceError(error, "No se pudo cargar la configuración del sitio.");
  return (data as SiteSettingsRow | null) ?? null;
}
