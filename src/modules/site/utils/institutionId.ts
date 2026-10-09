export function getInstitutionId(): string | null {
  const fromQuery = new URLSearchParams(window.location.search).get("institution");
  const fromEnv = import.meta.env.VITE_INSTITUTION_ID as string | undefined;
  return fromQuery || fromEnv || null;
}
