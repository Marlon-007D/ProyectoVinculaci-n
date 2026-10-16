import type { Json } from "../types/common";
import type { PageSection, PageSnapshot } from "../types/page";

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export function parseSnapshot(snapshot: Json | null | undefined): PageSnapshot {
  if (!isObj(snapshot)) return { sections: [] };
  const raw = Array.isArray(snapshot.sections) ? snapshot.sections : [];
  const sections: PageSection[] = [];
  raw.forEach((s, i) => {
    if (!isObj(s) || typeof s.type !== "string") return;
    const id = typeof s.page_section_id === "string" ? s.page_section_id : typeof s.id === "string" ? s.id : `section-${i}`;
    sections.push({
      id,
      type: s.type,
      position: typeof s.position === "number" ? s.position : i,
      is_visible: typeof s.is_visible === "boolean" ? s.is_visible : true,
      properties: isObj(s.properties) ? s.properties : {},
    });
  });
  return { title: typeof snapshot.title === "string" ? snapshot.title : undefined, sections };
}

export const asString = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v : undefined;
