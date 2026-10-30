import type { AccessScope } from './accessPolicy.ts';

export function logoutDestination(scope: AccessScope, institutionId: string | null): string {
  const params = new URLSearchParams();
  const institution = institutionId || scope.institution?.trim();
  if (institution) params.set('institution', institution);
  return '/' + (params.size ? '?' + params.toString() : '');
}

/** Where a tab goes when its session ended in another tab; null for public pages, which need no redirect. */
export function remoteSignOutTarget(origin: string, pathname: string, institution: string | null): string | null {
  const privateArea = /^\/panel(?:\/|$)/.test(pathname) || /^\/[^/]+\/(?:dece|mi-ficha|admin|sin-modulos)(?:\/|$)/.test(pathname);
  if (!privateArea) return null;
  return origin + '/' + (institution ? '?institution=' + encodeURIComponent(institution) : '');
}

export async function logoutToPublicInstitution(
  signOut: () => Promise<{ error: Error | null }>, destination: string,
  cleanup: () => void, replace: (destination: string) => void,
): Promise<void> {
  const { error } = await signOut();
  if (error) throw error;
  cleanup();
  // Shared Auth coordinates this destination with awaiting sidebar handlers.
  replace(destination);
}
