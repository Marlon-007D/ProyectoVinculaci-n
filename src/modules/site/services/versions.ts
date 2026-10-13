import { getSupabase } from "../lib/supabase";
import { toServiceError } from "../lib/errors";
import type { NewPublicationVersionInput, PublicationVersion } from "../types/version";

const TABLE = "publication_versions";

export async function getVersions(pageId: string): Promise<PublicationVersion[]> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("page_id", pageId)
    .order("version_number", { ascending: false });
  if (error) throw toServiceError(error, "No se pudieron cargar las versiones de la página.");
  return (data ?? []) as PublicationVersion[];
}

export async function getLastVersion(pageId: string): Promise<PublicationVersion | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("page_id", pageId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw toServiceError(error, "No se pudo cargar la versión publicada.");
  return (data as PublicationVersion | null) ?? null;
}

export async function getVersion(pageId: string, versionNumber: number): Promise<PublicationVersion | null> {
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("page_id", pageId)
    .eq("version_number", versionNumber)
    .maybeSingle();
  if (error) throw toServiceError(error, "No se pudo cargar la versión solicitada.");
  return (data as PublicationVersion | null) ?? null;
}

export async function createVersion(input: NewPublicationVersionInput): Promise<PublicationVersion> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const latest = await getLastVersion(input.page_id);
    const { data, error } = await getSupabase()
      .from(TABLE)
      .insert({
        page_id: input.page_id,
        version_number: (latest?.version_number ?? 0) + 1,
        content_snapshot: input.content_snapshot,
        published_by: input.published_by,
      })
      .select()
      .single();
    if (!error) return data as PublicationVersion;
    if (error.code !== "23505" || attempt === 1)
      throw toServiceError(error, "No se pudo crear la nueva versión.");
  }
  throw toServiceError(null, "No se pudo crear la nueva versión.");
}
