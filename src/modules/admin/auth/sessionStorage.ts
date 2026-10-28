export function readSessionValue(key: string): string | null {
  try { return sessionStorage.getItem(key); } catch { return null; }
}

export function writeSessionValue(key: string, value: string | null): void {
  try {
    if (value === null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, value);
  } catch {
    // Optional preferences never block an authenticated session.
  }
}
