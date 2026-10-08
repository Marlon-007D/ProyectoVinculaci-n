import { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { AppRouter } from './router/AppRouter'
import { useThemeUser } from '../features/themeUser/hooks/useThemeUser'
import type { ThemeName } from '../features/themeUser/types/themeUser.types'
import './App.css'

export default function App() {
  const themeUser = useThemeUser()
  const [collapsed, setCollapsed] = useState(() => {
    const savedState = localStorage.getItem('sidebar-collapsed')
    return savedState === null ? window.matchMedia('(max-width: 620px)').matches : savedState === 'true'
  })
  const themeTransitionId = useRef(0)
  const toggleSidebar = () => setCollapsed(current => {
    localStorage.setItem('sidebar-collapsed', String(!current))
    return !current
  })
  const changeTheme = (nextTheme: ThemeName, origin: { x: number; y: number }) => {
    if (nextTheme === themeUser.theme) return

    const root = document.documentElement
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const viewTransitionDocument = document as Document & {
      startViewTransition?: (update: () => void) => { finished: Promise<void> }
    }
    const startViewTransition = viewTransitionDocument.startViewTransition

    if (prefersReducedMotion || !startViewTransition) {
      themeUser.setTheme(nextTheme)
      return
    }

    const farthestX = Math.max(origin.x, window.innerWidth - origin.x)
    const farthestY = Math.max(origin.y, window.innerHeight - origin.y)
    root.style.setProperty('--theme-reveal-x', `${origin.x}px`)
    root.style.setProperty('--theme-reveal-y', `${origin.y}px`)
    root.style.setProperty('--theme-reveal-radius', `${Math.ceil(Math.hypot(farthestX, farthestY))}px`)
    themeTransitionId.current += 1
    const transitionId = themeTransitionId.current

    const transition = startViewTransition.call(viewTransitionDocument, () => {
      root.dataset.theme = nextTheme
      flushSync(() => themeUser.setTheme(nextTheme))
    })
    const clearRevealPosition = () => {
      if (transitionId !== themeTransitionId.current) return
      root.style.removeProperty('--theme-reveal-x')
      root.style.removeProperty('--theme-reveal-y')
      root.style.removeProperty('--theme-reveal-radius')
    }
    void transition.finished.then(clearRevealPosition, clearRevealPosition)
  }
  return <div className={collapsed ? 'app-shell is-collapsed' : 'app-shell'} data-theme={themeUser.theme}><AppRouter collapsed={collapsed} theme={themeUser.theme} onThemeChange={changeTheme} onToggleSidebar={toggleSidebar} /></div>
}
