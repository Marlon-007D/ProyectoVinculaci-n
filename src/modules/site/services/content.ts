import { demoEvents, demoHonors, demoNews, demoStaff, demoTheme, isDemoMode } from "../lib/demo";
import { getSupabase } from "../lib/supabase";
import { toServiceError } from "../lib/errors";
import type { EventItem, Honor, NewsItem, StaffMember, ThemeRow } from "../types/content";
import type { AcademicContentEntry } from "../../../features/academic-content/types/academicContent.types";

export async function getTheme(themeId: string | null): Promise<ThemeRow | null> {
  if (isDemoMode()) return demoTheme;
  if (!themeId) return null;
  const { data, error } = await getSupabase().from("themes").select("*").eq("theme_id", themeId).maybeSingle();
  if (error) throw toServiceError(error, "No se pudo cargar el tema visual.");
  return (data as ThemeRow | null) ?? null;
}

export async function getNews(institutionId: string, limit = 6): Promise<NewsItem[]> {
  if (isDemoMode()) return [...demoNews].sort((a, b) => (b.published_at ?? "").localeCompare(a.published_at ?? "")).slice(0, limit);
  const { data, error } = await getSupabase()
    .from("news")
    .select("news_id, institution_id, title, slug, summary, content, cover_image_url, published_at")
    .eq("institution_id", institutionId)
    .eq("is_published", true)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw toServiceError(error, "No se pudieron cargar las noticias.");
  return (data ?? []) as NewsItem[];
}

export async function getNewsEntry(institutionId: string, newsId: string): Promise<AcademicContentEntry | null> {
  const news = (await getNews(institutionId, 100)).find((item) => item.news_id === newsId || item.slug === newsId);
  if (!news) return null;
  const paragraphs = news.content.split(/\n{2,}/).map((text) => text.trim()).filter(Boolean);
  return {
    id: news.news_id,
    institutionId,
    kind: "news",
    title: news.title,
    description: news.summary ?? "",
    periodId: "",
    status: "published",
    date: news.published_at?.slice(0, 10) ?? "",
    location: "",
    studentName: "",
    grade: "",
    distinction: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    imageUrl: news.cover_image_url ?? undefined,
    sections: [{
      id: `news-${news.news_id}`,
      title: "La noticia",
      blocks: paragraphs.map((text, index) => ({ id: `news-${news.news_id}-${index}`, type: "paragraph" as const, text })),
    }],
    updatedAt: news.published_at ?? new Date().toISOString(),
  };
}

export async function getStaff(institutionId: string, position?: string): Promise<StaffMember[]> {
  if (isDemoMode()) {
    const staff = demoStaff;
    const filter = position?.trim().toLowerCase();
    return filter ? staff.filter((member) => member.position.toLowerCase().includes(filter)) : staff;
  }
  const load = (includeEmail: boolean) => {
    const staffTable = getSupabase().from("staff");
    let query = (includeEmail
      ? staffTable.select("staff_id, institution_id, full_name, position, photo_url, bio, position_order, email")
      : staffTable.select("staff_id, institution_id, full_name, position, photo_url, bio, position_order"))
      .eq("institution_id", institutionId)
      .eq("is_public", true)
      .order("position_order", { ascending: true });
    if (position?.trim()) {
      const escaped = position.trim().replace(/[\\%,_(),]/g, "\\$&");
      query = query.ilike("position", `%${escaped}%`);
    }
    return query;
  };
  let { data, error } = await load(true);
  if (error && /column .*email.* does not exist|could not find .*email.* column/i.test(error.message)) {
    ({ data, error } = await load(false));
  }
  if (error) throw toServiceError(error, "No se pudo cargar el personal.");
  return (data ?? []) as unknown as StaffMember[];
}

export async function getHonors(institutionId: string, limit = 12): Promise<Honor[]> {
  if (isDemoMode()) return demoHonors.slice(0, limit);
  const { data, error } = await getSupabase()
    .from("public_honors")
    .select("honor_id,institution_id,achievement,score,photo_url,student_name,grade_level,schedule,honor_category,official_order,modality,campus")
    .eq("institution_id", institutionId)
    .order("official_order", { ascending: true, nullsFirst: false })
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw toServiceError(error, "No se pudieron cargar las distinciones oficiales.");
  return (data ?? []) as unknown as Honor[];
}

export async function getEvents(institutionId: string, limit = 4): Promise<EventItem[]> {
  if (isDemoMode()) return demoEvents.slice(0, limit);
  const { data, error } = await getSupabase()
    .from("events")
    .select("event_id, institution_id, title, description, event_date, location")
    .eq("institution_id", institutionId)
    .gte("event_date", new Date().toISOString())
    .order("event_date", { ascending: true })
    .limit(limit);
  if (error) throw toServiceError(error, "No se pudieron cargar los eventos.");
  return (data ?? []) as EventItem[];
}

export async function getEventEntry(institutionId: string, eventId: string): Promise<AcademicContentEntry | null> {
  const event = (await getEvents(institutionId, 100)).find((item) => item.event_id === eventId);
  if (!event) return null;
  const description = event.description?.trim() ?? "";
  return {
    id: event.event_id,
    institutionId,
    kind: "event",
    title: event.title,
    description: "",
    periodId: "",
    status: "published",
    date: event.event_date.slice(0, 10),
    time: event.event_time ?? undefined,
    location: event.location ?? "",
    studentName: "",
    grade: "",
    distinction: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    sections: description ? [{
      id: `event-${event.event_id}`,
      title: "Detalles del evento",
      blocks: [{ id: `event-${event.event_id}-description`, type: "paragraph", text: description }],
    }] : [],
    updatedAt: event.event_date,
  };
}
