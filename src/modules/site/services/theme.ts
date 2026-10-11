import { getSupabase } from "../lib/supabase";
import { toServiceError } from "../lib/errors";
import type { ThemeRow } from "../types/site";

export async function getTheme(themeId: string): Promise<ThemeRow | null> {
  const { data, error } = await getSupabase()
    .from("themes")
    .select("*")
    .eq("theme_id", themeId)
    .maybeSingle();
  if (error) throw toServiceError(error, "No se pudo cargar el tema visual.");
  return (data as ThemeRow | null) ?? null;
}
