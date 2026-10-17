export function isSafeExternalUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return ["http:", "https:", "mailto:", "tel:"].includes(u.protocol);
  } catch {
    return false;
  }
}

export function keepInstitution(path: string, currentSearch: string): string {
  const keep = new URLSearchParams(currentSearch).get("institution");
  if (!keep) return path;
  const u = new URL(path, "http://x");
  if (!u.searchParams.has("institution")) u.searchParams.set("institution", keep);
  return u.pathname + u.search + u.hash;
}
