import { getSupabase } from "../lib/supabase";
import { getPublicEnabledModules } from "../../../core/supabase/publicClient";

export type ExternalModule = "projects" | "dece" | "simuladores";

export async function isPublicModuleEnabled(institutionSlug: string, module: ExternalModule): Promise<boolean> {
  const enabledModules = await getPublicEnabledModules(institutionSlug);
  return enabledModules.includes(module);
}

export async function isModuleEnabled(institutionId: string, module: ExternalModule): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from("module_settings")
    .select("is_enabled")
    .eq("institution_id", institutionId)
    .eq("module_name", module)
    .maybeSingle();
  if (error) return false;
  return data?.is_enabled === true;
}
