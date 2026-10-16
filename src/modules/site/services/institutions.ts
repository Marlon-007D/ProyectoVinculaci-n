import { getSupabase } from "../lib/supabase";
import { toServiceError } from "../lib/errors";
import type { Institution } from "../types/institution";

export async function getInstitutionBySlug(slug: string): Promise<Institution | null> {
  const { data, error } = await getSupabase()
    .from("institutions")
    .select("institution_id, name, slug, domain, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw toServiceError(error, "No se pudo cargar la institución.");
  return (data as Institution | null) ?? null;
}
