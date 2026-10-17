import { demoEvents, demoHonors, demoNews, demoStaff, demoTheme, isDemoMode } from "../lib/demo";
import { getSupabase } from "../lib/supabase";
import { toServiceError } from "../lib/errors";
import type { EventItem, Honor, NewsItem, StaffMember, ThemeRow } from "../types/content";

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

export async function getStaff(institutionId: string): Promise<StaffMember[]> {
  if (isDemoMode()) return demoStaff;
  const { data, error } = await getSupabase()
    .from("staff")
    .select("staff_id, institution_id, full_name, position, photo_url, bio, position_order")
    .eq("institution_id", institutionId)
    .eq("is_public", true)
    .order("position_order", { ascending: true });
  if (error) throw toServiceError(error, "No se pudo cargar el personal.");
  return (data ?? []) as StaffMember[];
}

export async function getHonors(institutionId: string, limit = 12): Promise<Honor[]> {
  if (isDemoMode()) return demoHonors.slice(0, limit);
  const { data, error } = await getSupabase()
    .from("public_honors")
    .select("honor_id, institution_id, achievement, score, photo_url, student_name, grade_level")
    .eq("institution_id", institutionId)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw toServiceError(error, "No se pudo cargar el cuadro de honor.");
  return (data ?? []) as Honor[];
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
