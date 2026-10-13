import type { CSSProperties } from "react";
import type { ThemeRow } from "../types/site";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const FONT = /^[\w\s,'"-]{1,100}$/;

function inkFor(hex: string): string {
  const full = hex.length === 4 ? "#" + [...hex.slice(1)].map((c) => c + c).join("") : hex;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(full.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#000000" : "#ffffff";
}

export function themeToStyle(theme: ThemeRow | null): CSSProperties | undefined {
  if (!theme) return undefined;
  const vars: Record<string, string> = {};
  if (HEX.test(theme.primary_color)) {
    vars["--site-accent"] = theme.primary_color;
    vars["--site-accent-ink"] = inkFor(theme.primary_color);
  }
  if (HEX.test(theme.secondary_color)) vars["--site-secondary"] = theme.secondary_color;
  if (FONT.test(theme.font_family)) vars["--site-font"] = `${theme.font_family}, system-ui, sans-serif`;
  return Object.keys(vars).length ? (vars as unknown as CSSProperties) : undefined;
}
