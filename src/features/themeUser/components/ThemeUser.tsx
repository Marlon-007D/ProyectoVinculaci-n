import { Check, ChevronDown, Palette } from 'lucide-react'
import { themeOptions } from '../mocks/themeOptions'
import type { ThemeName } from '../types/themeUser.types'
import './ThemeUser.css'

interface Props { theme: ThemeName; collapsed: boolean; open: boolean; onChange: (theme: ThemeName) => void; onToggle: () => void }

export function ThemeUser({ theme, collapsed, open, onChange, onToggle }: Props) {
  return <div className={`theme-user${open ? ' is-open' : ''}${collapsed ? ' is-collapsed' : ''}`}>
    <button className="theme-trigger" type="button" aria-expanded={open} aria-controls="theme-user-options" onClick={onToggle}>
      <Palette size={19} />
      {!collapsed && <><span>Tema</span><ChevronDown className="theme-chevron" size={16} /></>}
      <span className="theme-trigger-swatch" style={{ backgroundColor: themeOptions.find(option => option.id === theme)?.swatch }} aria-hidden="true" />
    </button>
    {open && <div className="theme-options" id="theme-user-options" role="group" aria-label="Selecciona un tema">
      {themeOptions.map(option => <button className="theme-option" type="button" key={option.id} aria-label={option.label} aria-pressed={theme === option.id} onClick={() => onChange(option.id)}>
        <span className="theme-option-swatch" style={{ backgroundColor: option.swatch }} aria-hidden="true" />
        {theme === option.id && <Check size={16} aria-hidden="true" />}
      </button>)}
    </div>}
  </div>
}
