import { getSupabase } from "../lib/supabase";
import { toServiceError } from "../lib/errors";
import type { Page } from "../types/page";

const COLUMNS = "page_id, institution_id, slug, title, status, is_homepage";

export async function getPageBySlug(institutionId: string, slug: string): Promise<Page | null> {
  const { data, error } = await getSupabase()
    .from("pages")
    .select(COLUMNS)
    .eq("institution_id", institutionId)
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw toServiceError(error, "No se pudo cargar la página.");
  return (data as Page | null) ?? null;
}

export async function getHomePage(institutionId: string): Promise<Page | null> {
  const { data, error } = await getSupabase()
    .from("pages")
    .select(COLUMNS)
    .eq("institution_id", institutionId)
    .eq("is_homepage", true)
    .eq("status", "published")
    .limit(1)
    .maybeSingle();
  if (error) throw toServiceError(error, "No se pudo cargar la página de inicio.");
  return (data as Page | null) ?? null;
}
