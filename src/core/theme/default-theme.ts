import type { InstitutionTheme } from './theme.types'

/** Neutral application fallback used until an institution theme is available. */
export const defaultTheme: Required<InstitutionTheme> = {
  primary_color: '#6656a5',
  secondary_color: '#8c82a8',
  tertiary_color: '#5483a0',
  font_family: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  base_font_size: 16,
  heading_1_size: 27,
  heading_2_size: 16,
  heading_3_size: 13,
  visual_scale: 1,
  appearance_config: {},
}
