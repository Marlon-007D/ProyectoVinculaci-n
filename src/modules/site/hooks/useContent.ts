import { useAsync } from "./useAsync";
import { useInstitution } from "../context/InstitutionContext";
import { getEvents, getHonors, getNews, getStaff } from "../services/content";

export function useNews(limit?: number) {
  const { institutionId } = useInstitution();
  return useAsync(() => getNews(institutionId, limit), [institutionId, limit]);
}

export function useStaff() {
  const { institutionId } = useInstitution();
  return useAsync(() => getStaff(institutionId), [institutionId]);
}

export function useHonors(limit?: number) {
  const { institutionId } = useInstitution();
  return useAsync(() => getHonors(institutionId, limit), [institutionId, limit]);
}

export function useEvents(limit?: number) {
  const { institutionId } = useInstitution();
  return useAsync(() => getEvents(institutionId, limit), [institutionId, limit]);
}
