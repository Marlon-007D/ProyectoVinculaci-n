import { useState } from 'react'
import { AppRouter } from './router/AppRouter'
import { useThemeUser } from '../features/themeUser/hooks/useThemeUser'
import './App.css'

export default function App() {
  const themeUser = useThemeUser()
  const [collapsed, setCollapsed] = useState(() => {
    const savedState = localStorage.getItem('sidebar-collapsed')
    return savedState === null ? window.matchMedia('(max-width: 620px)').matches : savedState === 'true'
  })
  const toggleSidebar = () => setCollapsed(current => {
    localStorage.setItem('sidebar-collapsed', String(!current))
    return !current
  })
  return <div className={collapsed ? 'app-shell is-collapsed' : 'app-shell'} data-theme={themeUser.theme}><AppRouter collapsed={collapsed} theme={themeUser.theme} onThemeChange={themeUser.setTheme} onToggleSidebar={toggleSidebar} /></div>
}
