// Query parameters that select a public portal page ("/?honores=1", "/?noticia=…"). The slug parameter is excluded
// on purpose: it also names the institution, and a page slug never matches an institution.
const PUBLIC_PAGE_PARAMS = ['honores', 'noticia', 'evento', 'simulator', 'courses', 'module', 'course', 'transparency'] as const;

/** True when the URL asks for a public page, so a signed-in visitor must stay on it instead of being sent to the panel. */
export function isPublicPortalSearch(search: string): boolean {
  const params = new URLSearchParams(search);
  return PUBLIC_PAGE_PARAMS.some(key => params.has(key));
}
