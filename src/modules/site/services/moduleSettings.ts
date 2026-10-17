import { getSupabase } from "../lib/supabase";

export type ExternalModule = "projects" | "dece" | "simuladores";

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
