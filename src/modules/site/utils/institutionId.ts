const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface InstitutionRef {
  id?: string;
  slug?: string;
}

export function getInstitutionRef(): InstitutionRef {
  const query = new URLSearchParams(window.location.search).get("institution");
  if (query) return UUID.test(query) ? { id: query } : { slug: query };
  const envId = import.meta.env.VITE_INSTITUTION_ID as string | undefined;
  if (envId) return { id: envId };
  const envSlug = import.meta.env.VITE_INSTITUTION_SLUG as string | undefined;
  const defaultSlug = import.meta.env.VITE_DEFAULT_INSTITUTION_SLUG as string | undefined;
  return { slug: envSlug || defaultSlug || "ue-luz-de-america" };
}
