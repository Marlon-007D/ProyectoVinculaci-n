/** UI theme values corresponding to the public.themes record, without DB concerns. */
export type InstitutionTheme = {
  primary_color?: string | null
  secondary_color?: string | null
  tertiary_color?: string | null
  font_family?: string | null
  base_font_size?: number | string | null
  heading_1_size?: number | string | null
  heading_2_size?: number | string | null
  heading_3_size?: number | string | null
  visual_scale?: number | string | null
  appearance_config?: Record<string, unknown> | null
}

export type ThemeReader = () => Promise<InstitutionTheme | null>
