export type PageStatus = "draft" | "published" | "archived";

export interface Page {
  page_id: string;
  institution_id: string;
  slug: string;
  title: string;
  status: PageStatus;
  is_homepage: boolean;
}

export interface PageSection {
  id: string;
  type: string;
  position: number;
  is_visible: boolean;
  properties: Record<string, unknown>;
}

export interface PageSnapshot {
  title?: string;
  sections: PageSection[];
}
