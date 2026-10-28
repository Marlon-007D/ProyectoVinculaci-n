const completedSessions = new Set<string>();

export function markInvitationSession(userId: string, institutionId: string): void {
  completedSessions.add(JSON.stringify([userId, institutionId]));
}

export function consumeInvitationSession(userId: string, institutionId: string): boolean {
  return completedSessions.delete(JSON.stringify([userId, institutionId]));
}

/** Retain only the verified tenant; callback tokens and acceptance flags are discarded. */
export function invitationCompletionDestination(institutionId: string, slug: string): string {
  const search = new URLSearchParams({ institution: institutionId, slug });
  return `/panel/admin?${search}`;
}

export function replaceInvitationHistory(history: Pick<History, 'state' | 'replaceState'>,
  institutionId: string, slug: string): string {
  const destination = invitationCompletionDestination(institutionId, slug);
  history.replaceState(history.state, '', destination);
  return destination;
}
