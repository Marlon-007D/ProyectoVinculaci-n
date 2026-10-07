import { useEffect, useState } from 'react'
import type { ThemeName } from '../types/themeUser.types'

const storageKey = 'simulaedu.theme'
const validThemes: ThemeName[] = ['purple', 'green', 'sky', 'pink', 'blue', 'teal', 'mint', 'yellow', 'orange', 'coral', 'red', 'lavender', 'indigo', 'cyan', 'peach', 'slate']

function getInitialTheme(): ThemeName {
  try {
    const savedTheme = localStorage.getItem(storageKey)
    return validThemes.includes(savedTheme as ThemeName) ? savedTheme as ThemeName : 'purple'
  } catch {
    return 'purple'
  }
}

export function useThemeUser() {
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(storageKey, theme)
    } catch {
      // El tema sigue activo durante esta sesión aunque el almacenamiento esté bloqueado.
    }
  }, [theme])

  return { theme, setTheme }
}
