import { defaultTheme } from './default-theme'
import type { InstitutionTheme, ThemeReader } from './theme.types'

const cssProperties = {
  primary_color: '--color-primary',
  secondary_color: '--color-secondary',
  tertiary_color: '--color-tertiary',
  font_family: '--font-family',
  base_font_size: '--font-size-base',
  heading_1_size: '--font-size-h1',
  heading_2_size: '--font-size-h2',
  heading_3_size: '--font-size-h3',
  visual_scale: '--visual-scale',
} as const

function validColor(value: unknown): value is string {
  return typeof value === 'string' && CSS.supports('color', value)
}

function validFontFamily(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function validPositiveNumber(value: unknown): value is number | string {
  const number = Number(value)
  return Number.isFinite(number) && number > 0
}

function applyTheme(theme: InstitutionTheme) {
  const root = document.documentElement
  const colors = ['primary_color', 'secondary_color', 'tertiary_color'] as const
  for (const key of colors) {
    if (validColor(theme[key])) root.style.setProperty(cssProperties[key], theme[key])
  }
  if (validFontFamily(theme.font_family)) {
    root.style.setProperty(cssProperties.font_family, theme.font_family)
  }

  const sizes = ['base_font_size', 'heading_1_size', 'heading_2_size', 'heading_3_size'] as const
  for (const key of sizes) {
    if (validPositiveNumber(theme[key])) {
      root.style.setProperty(cssProperties[key], `${Number(theme[key])}px`)
    }
  }
  if (validPositiveNumber(theme.visual_scale)) {
    root.style.setProperty(cssProperties.visual_scale, String(Number(theme.visual_scale)))
  }

  // appearance_config is intentionally preserved as data until its contract is defined.
}

/** Loads a theme through an injected reader; a missing reader or failure keeps the defaults. */
export async function initializeTheme(readTheme?: ThemeReader): Promise<void> {
  applyTheme(defaultTheme)
  if (!readTheme) return

  try {
    const theme = await readTheme()
    if (theme) applyTheme(theme)
  } catch {
    // Theme loading is non-blocking: the app remains usable with its default theme.
  }
}
