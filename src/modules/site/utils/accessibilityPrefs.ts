export interface AccessibilityPrefs {
  highContrast: boolean;
  darkMode: boolean;
  grayscale: boolean;
  reducedColor: boolean;
  distinguishColor: boolean;
  reduceMotion: boolean;
  textScale: 0 | 1 | 2 | 3;
}

export const DEFAULT_PREFS: AccessibilityPrefs = { highContrast: false, darkMode: false, grayscale: false, reducedColor: false, distinguishColor: false, reduceMotion: false, textScale: 0 };
const STORAGE_KEY = "site-a11y-prefs";
const SCALE_VALUES = ["1", "1.125", "1.25", "1.5"] as const;

export function sanitizePrefs(value: unknown): AccessibilityPrefs {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_PREFS };
  const v = value as Record<string, unknown>;
  const scale = Number(v.textScale);
  return {
    highContrast: v.highContrast === true,
    darkMode: v.darkMode === true,
    grayscale: v.grayscale === true,
    reducedColor: v.reducedColor === true,
    distinguishColor: v.distinguishColor === true,
    reduceMotion: v.reduceMotion === true,
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
  if (!siteRoot) return;
  siteRoot.style.setProperty("zoom", SCALE_VALUES[prefs.textScale]);
  if (prefs.darkMode) siteRoot.setAttribute("data-a11y-theme", "dark");
  else siteRoot.removeAttribute("data-a11y-theme");
  if (prefs.highContrast) siteRoot.setAttribute("data-a11y-contrast", "high");
  else siteRoot.removeAttribute("data-a11y-contrast");
  if (prefs.grayscale) siteRoot.setAttribute("data-a11y-color", "grayscale");
  else if (prefs.reducedColor) siteRoot.setAttribute("data-a11y-color", "reduced");
  else siteRoot.removeAttribute("data-a11y-color");
  if (prefs.distinguishColor) siteRoot.setAttribute("data-a11y-distinguish", "true");
  else siteRoot.removeAttribute("data-a11y-distinguish");
  if (prefs.reduceMotion) siteRoot.setAttribute("data-a11y-motion", "reduce");
  else siteRoot.removeAttribute("data-a11y-motion");
}
