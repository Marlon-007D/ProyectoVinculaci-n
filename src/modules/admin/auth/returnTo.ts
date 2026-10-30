const BASE = 'http://return-to.invalid';

interface LocationLike { pathname: string; search: string; hash: string }

/** Only internal panel paths may be resumed after login; anything else is dropped. */
export function safeReturnTo(value: unknown): string | null {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return null;
  let url: URL;
  try { url = new URL(value, BASE); } catch { return null; }
  if (url.origin !== BASE || !/^\/panel(?:\/|$)/.test(url.pathname)) return null;
  return url.pathname + url.search + url.hash;
}

export function returnToFromLocation(location: LocationLike): string | null {
  return safeReturnTo(location.pathname + location.search + location.hash);
}

/**
 * Resumes the page the user was trying to open, keeping the institution already verified in `target`.
 * A returnTo that names a different institution falls back to `target`.
 */
export function resolveReturnTo(returnTo: unknown, target: string): string {
  const safe = safeReturnTo(returnTo);
  if (!safe) return target;
  const wanted = new URL(safe, BASE);
  const verified = new URL(target, BASE);
  for (const key of ['institution', 'slug']) {
    const requested = wanted.searchParams.get(key);
    const allowed = verified.searchParams.get(key);
    if (requested && requested !== allowed) return target;
    if (allowed) wanted.searchParams.set(key, allowed);
  }
  return wanted.pathname + wanted.search + wanted.hash;
}
