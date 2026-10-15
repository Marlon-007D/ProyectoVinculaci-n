import { getSupabase } from "../lib/supabase";
import type { MediaAsset, MediaKind } from "../types/media";

export const MEDIA_BUCKET: string =
  (import.meta.env.VITE_MEDIA_BUCKET as string | undefined) ?? "media";

export function getMediaKind(mime: string): MediaKind {
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (
    mime === "application/pdf" ||
    mime.startsWith("text/") ||
    mime.includes("word") ||
    mime.includes("excel") ||
    mime.includes("spreadsheet") ||
    mime.includes("presentation") ||
    mime.includes("powerpoint")
  )
    return "document";
  return "other";
}

export function getPublicUrlFromPath(filePath: string): string | null {
  try {
    return getSupabase().storage.from(MEDIA_BUCKET).getPublicUrl(filePath).data.publicUrl;
  } catch {
    return null;
  }
}

export function getPublicMediaUrl(asset: Pick<MediaAsset, "file_path" | "is_public">): string | null {
  return asset.is_public ? getPublicUrlFromPath(asset.file_path) : null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}
