export interface AccessibilityPrefs {
  highContrast: boolean;
  darkMode: boolean;
  textScale: 0 | 1 | 2 | 3;
}

export const DEFAULT_PREFS: AccessibilityPrefs = { highContrast: false, darkMode: false, textScale: 0 };
const STORAGE_KEY = "site-a11y-prefs";
const SCALE_VALUES = ["100%", "112.5%", "125%", "150%"] as const;

export function sanitizePrefs(value: unknown): AccessibilityPrefs {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_PREFS };
  const v = value as Record<string, unknown>;
  const scale = Number(v.textScale);
  return {
    highContrast: v.highContrast === true,
    darkMode: v.darkMode === true,
    textScale: scale === 1 || scale === 2 || scale === 3 ? scale : 0,
  };
}

export function loadPrefs(): AccessibilityPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizePrefs(JSON.parse(raw)) : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs: AccessibilityPrefs): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
  }
}

export function applyPrefs(prefs: AccessibilityPrefs, siteRoot: HTMLElement | null): void {
  const root = document.documentElement;
  root.style.fontSize = SCALE_VALUES[prefs.textScale];
  if (!siteRoot) return;
  if (prefs.darkMode) siteRoot.setAttribute("data-a11y-theme", "dark");
  else siteRoot.removeAttribute("data-a11y-theme");
  if (prefs.highContrast) siteRoot.setAttribute("data-a11y-contrast", "high");
  else siteRoot.removeAttribute("data-a11y-contrast");
}
