import type { AccessScope } from './accessPolicy.ts';

export function logoutDestination(scope: AccessScope, institutionId: string | null): string {
  const params = new URLSearchParams();
  const institution = institutionId || scope.institution?.trim();
  if (institution) params.set('institution', institution);
  return '/' + (params.size ? '?' + params.toString() : '');
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
