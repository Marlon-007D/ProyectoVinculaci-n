import { useAsync } from "./useAsync";
import { useInstitution } from "../context/InstitutionContext";
import { getHomePage, getPageBySlug } from "../services/pages";

export function usePage(slug?: string) {
  const { institutionId } = useInstitution();
  return useAsync(
    () => (slug ? getPageBySlug(institutionId, slug) : getHomePage(institutionId)),
    [institutionId, slug],
  );
}
