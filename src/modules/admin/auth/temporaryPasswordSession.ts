interface SessionRefresh { error: { message: string } | null }
interface SessionPreference { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const refreshes = new WeakMap<SessionPreference, Promise<void>>();

/** Temporary Admin policy: reuse AuthContext's existing password-session flow.
 * Does not issue tokens or bypass server AAL/RLS requirements.
 */
export function resumePasswordSession(refresh: () => Promise<SessionRefresh>, preference: SessionPreference): Promise<void> {
  const pending = refreshes.get(preference);
  if (pending) return pending;
  const operation = refreshPasswordSession(refresh, preference).finally(() => refreshes.delete(preference));
  refreshes.set(preference, operation);
  return operation;
}

async function refreshPasswordSession(refresh: () => Promise<SessionRefresh>, preference: SessionPreference): Promise<void> {
  const key = 'auth-login-method';
  const previous = preference.getItem(key);
  preference.setItem(key, 'password');
  try {
    const result = await refresh();
    if (result.error) throw new Error(result.error.message);
  } catch (cause: unknown) {
    if (previous === null) preference.removeItem(key);
    else preference.setItem(key, previous);
    throw cause;
  }
}
