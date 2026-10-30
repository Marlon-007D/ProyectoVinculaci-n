import { parseMfaEnabled } from './mfaPolicy';

/**
 * Single switch for the second authentication factor (TOTP). Off by default (demo mode):
 * no sign-in method asks for a code or enrollment. Set VITE_MFA_ENABLED=true to restore the full flow.
 */
export const MFA_ENABLED = parseMfaEnabled(import.meta.env.VITE_MFA_ENABLED);
