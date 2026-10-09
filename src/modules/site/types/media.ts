export interface MediaAsset {
  media_asset_id: string;
  institution_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  is_public: boolean;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
}

export type MediaKind = "image" | "video" | "audio" | "document" | "other";
