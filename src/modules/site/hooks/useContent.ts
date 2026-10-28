import { useEffect } from "react";
import { useAsync } from "./useAsync";
import { usePortalUpdates } from './usePortalUpdates';
import { useInstitution } from "../context/InstitutionContext";
import { getEventEntry, getEvents, getHonors, getNews, getNewsEntry, getStaff } from "../services/content";

export function useNews(limit?: number) {
  const { institutionId } = useInstitution();
  const result = useAsync(() => getNews(institutionId, limit), [institutionId, limit]);
  usePortalUpdates(result.refresh);
  useEffect(() => {
    const reload = () => result.reload();
    window.addEventListener("storage", reload);
    window.addEventListener("academic-content-updated", reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("academic-content-updated", reload);
    };
  }, [result.reload]);
  return result;
}

export function useNewsArticle(newsId: string | null) {
  const { institutionId } = useInstitution();
  return useAsync(
    () => newsId ? getNewsEntry(institutionId, newsId) : Promise.resolve(null),
    [institutionId, newsId],
  );
}

export function useStaff(position?: string) {
  const { institutionId } = useInstitution();
  const result = useAsync(() => getStaff(institutionId, position), [institutionId, position]);
  usePortalUpdates(result.refresh);
  return result;
}

export function useHonors(limit?: number) {
  const { institutionId } = useInstitution();
  const result = useAsync(() => getHonors(institutionId, limit), [institutionId, limit]);
  usePortalUpdates(result.refresh);
  useEffect(() => {
    const reload = () => result.reload();
    window.addEventListener("storage", reload);
    window.addEventListener("academic-content-updated", reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("academic-content-updated", reload);
    };
  }, [result.reload]);
  return result;
}

export function useEvents(limit?: number) {
  const { institutionId } = useInstitution();
  const result = useAsync(() => getEvents(institutionId, limit), [institutionId, limit]);
  usePortalUpdates(result.refresh);
  useEffect(() => {
    const reload = () => result.reload();
    window.addEventListener("storage", reload);
    window.addEventListener("academic-content-updated", reload);
    return () => {
      window.removeEventListener("storage", reload);
      window.removeEventListener("academic-content-updated", reload);
    };
  }, [result.reload]);
  return result;
}

export function useEventArticle(eventId: string | null) {
  const { institutionId } = useInstitution();
  return useAsync(
    () => eventId ? getEventEntry(institutionId, eventId) : Promise.resolve(null),
    [institutionId, eventId],
  );
}
