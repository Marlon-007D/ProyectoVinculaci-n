export type ThemeName = 'purple' | 'green' | 'sky' | 'pink' | 'blue' | 'teal' | 'mint' | 'yellow' | 'orange' | 'coral' | 'red' | 'lavender' | 'indigo' | 'cyan' | 'peach' | 'slate'

export interface ThemeOption {
  id: ThemeName
  label: string
  swatch: string
}
