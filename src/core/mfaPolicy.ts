/** Pure parsing, kept apart from mfaConfig.ts so Node tests can import it without Vite's import.meta.env. */
export function parseMfaEnabled(value: unknown): boolean {
  return value === true || (typeof value === 'string' && value.trim().toLowerCase() === 'true');
}
