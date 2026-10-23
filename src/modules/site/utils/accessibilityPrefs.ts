export type AccessibilityColorMode =
  | "normal"
  | "monochrome"
  | "dark-high-contrast"
  | "bright-high-contrast"
  | "low-saturation"
  | "high-saturation"
  | "contrast";

export type CustomColorTarget = "background" | "headings" | "contents";

export interface AccessibilityPrefs {
  colorMode: AccessibilityColorMode;
  customColors: Record<CustomColorTarget, string | null>;
  textScale: 0 | 1 | 2 | 3 | 4;
  lineSpacing: 0 | 1 | 2 | 3;
  wordSpacing: 0 | 1 | 2 | 3;
  letterSpacing: 0 | 1 | 2 | 3;
  readingGuide: boolean;
}

export const DEFAULT_PREFS: AccessibilityPrefs = {
  colorMode: "normal",
  customColors: { background: null, headings: null, contents: null },
  textScale: 0,
  lineSpacing: 0,
  wordSpacing: 0,
  letterSpacing: 0,
  readingGuide: false,
};

const STORAGE_KEY = "site-a11y-prefs";
const SCALE_VALUES = ["1", "1.25", "1.5", "1.75", "2"] as const;
const COLOR_MODES: AccessibilityColorMode[] = ["normal", "monochrome", "dark-high-contrast", "bright-high-contrast", "low-saturation", "high-saturation", "contrast"];
const COLOR_PATTERN = /^#[\da-f]{6}$/i;

export function sanitizePrefs(value: unknown): AccessibilityPrefs {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_PREFS, customColors: { ...DEFAULT_PREFS.customColors } };
  const v = value as Record<string, unknown>;
  const colors = typeof v.customColors === "object" && v.customColors !== null ? v.customColors as Record<string, unknown> : {};
  const scale = Number(v.textScale);
  const spacing = (input: unknown): 0 | 1 | 2 | 3 => input === 1 || input === 2 || input === 3 ? input : 0;
  const migratedMode: AccessibilityColorMode = v.darkMode === true
    ? "dark-high-contrast"
    : v.highContrast === true
      ? "bright-high-contrast"
      : v.grayscale === true
        ? "monochrome"
        : v.reducedColor === true ? "low-saturation" : "normal";
  const colorMode = COLOR_MODES.includes(v.colorMode as AccessibilityColorMode) ? v.colorMode as AccessibilityColorMode : migratedMode;
  const customColor = (key: CustomColorTarget) => typeof colors[key] === "string" && COLOR_PATTERN.test(colors[key] as string) ? colors[key] as string : null;
  return {
    colorMode,
    customColors: { background: customColor("background"), headings: customColor("headings"), contents: customColor("contents") },
    textScale: scale >= 1 && scale <= 4 ? scale as AccessibilityPrefs["textScale"] : 0,
    lineSpacing: spacing(v.lineSpacing),
    wordSpacing: spacing(v.wordSpacing),
    letterSpacing: spacing(v.letterSpacing),
    readingGuide: v.readingGuide === true,
  };
}

export function loadPrefs(): AccessibilityPrefs {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? sanitizePrefs(JSON.parse(raw)) : { ...DEFAULT_PREFS, customColors: { ...DEFAULT_PREFS.customColors } };
  } catch {
    return { ...DEFAULT_PREFS, customColors: { ...DEFAULT_PREFS.customColors } };
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
  siteRoot.style.setProperty("--a11y-line-spacing", ["1.6", "1.8", "2", "2.2"][prefs.lineSpacing]);
  siteRoot.style.setProperty("--a11y-word-spacing", ["0em", ".12em", ".24em", ".36em"][prefs.wordSpacing]);
  siteRoot.style.setProperty("--a11y-letter-spacing", ["0em", ".04em", ".08em", ".12em"][prefs.letterSpacing]);

  const dark = prefs.colorMode === "dark-high-contrast";
  const highContrast = prefs.colorMode === "dark-high-contrast" || prefs.colorMode === "bright-high-contrast" || prefs.colorMode === "contrast";
  const colorFilter: Partial<Record<AccessibilityColorMode, string>> = {
    monochrome: "grayscale(1)",
    "low-saturation": "saturate(.35)",
    "high-saturation": "saturate(1.8)",
    contrast: "contrast(1.45)",
  };
  if (dark) siteRoot.setAttribute("data-a11y-theme", "dark");
  else siteRoot.removeAttribute("data-a11y-theme");
  if (highContrast) siteRoot.setAttribute("data-a11y-contrast", "high");
  else siteRoot.removeAttribute("data-a11y-contrast");
  const filter = colorFilter[prefs.colorMode];
  if (filter) {
    siteRoot.style.setProperty("filter", filter);
  } else {
    siteRoot.style.removeProperty("filter");
  }
  siteRoot.setAttribute("data-a11y-color-mode", prefs.colorMode);

  for (const key of ["background", "headings", "contents"] as const) {
    const value = prefs.customColors[key];
    const attribute = `data-a11y-custom-${key}`;
    const variable = `--a11y-custom-${key}`;
    if (value) {
      siteRoot.setAttribute(attribute, "true");
      siteRoot.style.setProperty(variable, value);
    } else {
      siteRoot.removeAttribute(attribute);
      siteRoot.style.removeProperty(variable);
    }
  }

  if (prefs.lineSpacing || prefs.wordSpacing || prefs.letterSpacing) siteRoot.setAttribute("data-a11y-spacing", "custom");
  else siteRoot.removeAttribute("data-a11y-spacing");
}
