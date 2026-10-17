import type { CSSProperties } from "react";
import type { ThemeRow } from "../types/content";

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const FONT = /^[\w\s,'"-]{1,120}$/;

function luminance(hex: string): number {
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function buildThemeVars(theme: ThemeRow | null): CSSProperties | undefined {
  if (!theme) return undefined;
  const v: Record<string, string> = {
    "--site-ink": "#1f2933", "--site-muted": "#52606d", "--site-paper": "#ffffff",
    "--site-surface": "#f3f5f7", "--site-line": "#d5dbe1",
  };
  if (HEX.test(theme.primary_color)) {
    v["--site-accent"] = theme.primary_color;
    v["--site-accent-ink"] = luminance(theme.primary_color) > 0.179 ? "#111827" : "#ffffff";
  }
  if (HEX.test(theme.secondary_color)) v["--site-secondary"] = theme.secondary_color;
  if (FONT.test(theme.font_family)) v["--site-font"] = theme.font_family;
  const size = Number(theme.base_font_size);
  if (Number.isFinite(size) && size >= 12 && size <= 22) v.fontSize = `${size}px`;
  return v as CSSProperties;
}
