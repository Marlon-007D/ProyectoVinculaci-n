import { getSupabase } from "../lib/supabase";
import { toServiceError } from "../lib/errors";
import type { MediaAsset } from "../types/media";

export interface ListMediaOptions {
  publicOnly?: boolean;
}

export async function getMediaList(
  institutionId: string,
  { publicOnly = true }: ListMediaOptions = {},
): Promise<MediaAsset[]> {
  let query = getSupabase()
    .from("media_assets")
    .select("*")
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false });
  if (publicOnly) query = query.eq("is_public", true);
  const { data, error } = await query;
  if (error) throw toServiceError(error, "No se pudieron cargar los archivos.");
  return (data ?? []) as MediaAsset[];
}

export async function getMedia(mediaAssetId: string): Promise<MediaAsset | null> {
  const { data, error } = await getSupabase()
    .from("media_assets")
    .select("*")
    .eq("media_asset_id", mediaAssetId)
    .maybeSingle();
  if (error) throw toServiceError(error, "No se pudo cargar el archivo.");
  return (data as MediaAsset | null) ?? null;
}
