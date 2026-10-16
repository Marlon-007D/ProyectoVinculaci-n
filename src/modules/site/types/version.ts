import type { Json } from "./common";

export interface PublicationVersion {
  publication_version_id: string;
  page_id: string;
  version_number: number;
  content_snapshot: Json;
  published_by: string | null;
  created_at: string;
}

export interface NewPublicationVersionInput {
  page_id: string;
  content_snapshot: Json;
  published_by: string | null;
}
