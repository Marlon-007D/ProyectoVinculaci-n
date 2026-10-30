import { useAsync } from "./useAsync";
import { useInstitution } from "../context/InstitutionContext";
import { getEventEntry, getEvents, getHonors, getNews, getNewsEntry, getStaff } from "../services/content";

export function useNews(limit?: number) {
  const { institutionId } = useInstitution();
  return useAsync(() => getNews(institutionId, limit), [institutionId, limit], undefined, { keepPrevious: true });
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
  return useAsync(() => getStaff(institutionId, position), [institutionId, position], undefined, { keepPrevious: true });
}

export function useHonors(limit?: number) {
  const { institutionId } = useInstitution();
  return useAsync(() => getHonors(institutionId, limit), [institutionId, limit], undefined, { keepPrevious: true });
}

export function useEvents(limit?: number) {
  const { institutionId } = useInstitution();
  return useAsync(() => getEvents(institutionId, limit), [institutionId, limit], undefined, { keepPrevious: true });
}

export function useEventArticle(eventId: string | null) {
  const { institutionId } = useInstitution();
  return useAsync(
    () => eventId ? getEventEntry(institutionId, eventId) : Promise.resolve(null),
    [institutionId, eventId],
  );
}
