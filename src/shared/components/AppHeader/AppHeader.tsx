import { ChevronRight, WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { ThemeUser } from '../../../features/themeUser/components/ThemeUser'
import type { ThemeName } from '../../../features/themeUser/types/themeUser.types'
import './AppHeader.css'

export interface BreadcrumbItem { label: string; onClick?: () => void }
interface Props { breadcrumbs?: BreadcrumbItem[]; navigation?: ReactNode; mobileVisible?: boolean; theme: ThemeName; onThemeChange: (theme: ThemeName, origin: { x: number; y: number }) => void }

export function AppHeader({ breadcrumbs = [], navigation, mobileVisible = true, theme, onThemeChange }: Props) {
  const [themeOpen, setThemeOpen] = useState(false)
  const [connection, setConnection] = useState<'checking' | 'online' | 'offline'>(() => navigator.onLine ? 'checking' : 'offline')
  useEffect(() => {
    let disposed = false
    let checkInProgress = false
    const checkConnectivity = async () => {
      if (checkInProgress) return
      if (!navigator.onLine) { setConnection('offline'); return }
      checkInProgress = true
      let timeoutId = 0
      try {
        const reachable = await new Promise<boolean>(resolve => {
          const probe = new Image()
          let settled = false
          const finish = (result: boolean) => {
            if (settled) return
            settled = true
            window.clearTimeout(timeoutId)
            probe.onload = null
            probe.onerror = null
            resolve(result)
          }
          timeoutId = window.setTimeout(() => finish(false), 1200)
          probe.onload = () => finish(true)
          probe.onerror = () => finish(false)
          probe.src = `https://www.gstatic.com/images/branding/googlelogo/1x/googlelogo_color_74x24dp.png?connectivity=${Date.now()}`
        })
        if (!disposed) setConnection(reachable && navigator.onLine ? 'online' : 'offline')
      } finally {
        window.clearTimeout(timeoutId)
        checkInProgress = false
      }
    }
    const updateOnline = () => { if (!navigator.onLine) setConnection('offline'); else { setConnection('checking'); void checkConnectivity() } }
    void checkConnectivity()
    const intervalId = window.setInterval(() => { void checkConnectivity() }, 2000)
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    return () => {
      disposed = true
      window.clearInterval(intervalId)
      window.removeEventListener('online', updateOnline)
      window.removeEventListener('offline', updateOnline)
    }
  }, [])
  return <header className={`topbar${mobileVisible ? '' : ' is-hidden-mobile'}`}>
    {breadcrumbs.length > 0 && <nav className="topbar-breadcrumbs" aria-label="Migas de pan">{breadcrumbs.map((item, index) => <span className="topbar-breadcrumb-item" key={`${item.label}-${index}`}>{index > 0 && <ChevronRight size={15} aria-hidden="true" />}{item.onClick ? <button type="button" onClick={item.onClick}>{item.label}</button> : <span aria-current="page">{item.label}</span>}</span>)}</nav>}
    {navigation}
    {connection === 'offline' && <span className="connection-indicator is-offline" role="status" aria-label="Sin conexión a internet"><WifiOff size={16} aria-hidden="true" /><span>Offline</span></span>}
    <ThemeUser placement="topbar" theme={theme} collapsed={false} open={themeOpen} onChange={(nextTheme, origin) => { onThemeChange(nextTheme, origin); setThemeOpen(false) }} onToggle={() => setThemeOpen(open => !open)} />
  </header>
}
