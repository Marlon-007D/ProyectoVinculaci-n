import { isDemoMode, demoInstitution } from "../lib/demo";
import { publicSupabase } from "../../../core/supabase/publicClient";
import { toServiceError } from "../lib/errors";
import type { Institution } from "../types/institution";

export async function getActiveInstitutions(): Promise<Institution[]> {
  if (isDemoMode()) return [demoInstitution];
  const { data, error } = await publicSupabase
    .from("institutions")
    .select("institution_id, name, slug, domain, is_active")
    .eq("is_active", true)
    .order("name");
  if (error) throw toServiceError(error, "No se pudieron cargar las instituciones.");
  return (data ?? []) as Institution[];
}

export async function getInstitutionById(institutionId: string): Promise<Institution | null> {
  if (isDemoMode()) return demoInstitution.institution_id === institutionId ? demoInstitution : null;
  const { data, error } = await publicSupabase
    .from("institutions")
    .select("institution_id, name, slug, domain, is_active")
    .eq("institution_id", institutionId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw toServiceError(error, "No se pudo cargar la institucion.");
  return (data as Institution | null) ?? null;
}

export async function getInstitutionBySlug(slug: string): Promise<Institution | null> {
  if (isDemoMode()) return demoInstitution;
  const { data, error } = await publicSupabase
    .from("institutions")
    .select("institution_id, name, slug, domain, is_active")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw toServiceError(error, "No se pudo cargar la institución.");
  return (data as Institution | null) ?? null;
}
