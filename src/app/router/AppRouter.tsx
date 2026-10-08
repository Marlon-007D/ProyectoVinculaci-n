import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronRight, Home } from 'lucide-react'
import { Sidebar } from '../../shared/components/Sidebar/Sidebar'
import { AppHeader } from '../../shared/components/AppHeader/AppHeader'
import { InvoiceSimulatorPage } from '../../features/simulators/invoice/pages/InvoiceSimulatorPage'
import { ConverterPage } from '../../features/simulators/converter/pages/ConverterPage'
import { InterestSimulatorPage } from '../../features/simulators/interest/pages/InterestSimulatorPage'
import { NewsPage } from '../../features/news/pages/NewsPage'
import { EventsPage } from '../../features/events/pages/EventsPage'
import { HonorsPage } from '../../features/honors/pages/HonorsPage'
import { AcademicPeriodsPage } from '../../features/academic-periods/pages/AcademicPeriodsPage'
import { InvoicePageSkeleton } from '../../features/simulators/invoice/pages/InvoicePageSkeleton'
import { ConverterPageSkeleton } from '../../features/simulators/converter/pages/ConverterPageSkeleton'
import { InterestPageSkeleton } from '../../features/simulators/interest/pages/InterestPageSkeleton'
import { AcademicContentSkeleton } from '../../features/academic-content/components/AcademicContentSkeleton'
import type { ThemeName } from '../../features/themeUser/types/themeUser.types'

export type SimulatorRoute = 'invoice' | 'converter' | 'interest'
export type AppRoute = SimulatorRoute | 'news' | 'events' | 'honors' | 'academic-periods'

interface Props { collapsed: boolean; theme: ThemeName; onThemeChange: (theme: ThemeName, origin: { x: number; y: number }) => void; onToggleSidebar: () => void }

const pages = {
  invoice: { Component: InvoiceSimulatorPage },
  converter: { Component: ConverterPage },
  interest: { Component: InterestSimulatorPage },
  news: { Component: NewsPage },
  events: { Component: EventsPage },
  honors: { Component: HonorsPage },
  'academic-periods': { Component: AcademicPeriodsPage },
} satisfies Record<AppRoute, { Component: () => ReactNode }>

const routeLabels: Record<AppRoute, string> = {
  invoice: 'Facturación electrónica', converter: 'Unidades y monedas', interest: 'Interés financiero',
  news: 'Noticias', events: 'Eventos', honors: 'Cuadro de honor', 'academic-periods': 'Período académico',
}

const routeSkeletons: Record<AppRoute, () => ReactNode> = {
  invoice: InvoicePageSkeleton,
  converter: ConverterPageSkeleton,
  interest: InterestPageSkeleton,
  news: () => <AcademicContentSkeleton kind="news" title="Noticias" />,
  events: () => <AcademicContentSkeleton kind="event" title="Eventos" />,
  honors: () => <AcademicContentSkeleton kind="honor" title="Cuadro de honor" />,
  'academic-periods': () => <AcademicContentSkeleton kind="period" title="Período académico" />,
}

export function AppRouter({ collapsed, theme, onThemeChange, onToggleSidebar }: Props) {
  const [route, setRoute] = useState<AppRoute>('invoice')
  const [loadingRoute, setLoadingRoute] = useState<AppRoute | null>(null)
  const navigationTimer = useRef<number | null>(null)
  const displayedRoute = loadingRoute ?? route
  const { Component } = pages[displayedRoute]
  const Skeleton = routeSkeletons[displayedRoute]
  const navigateTo = (nextRoute: AppRoute) => {
    if (nextRoute === displayedRoute) return
    if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current)
    setLoadingRoute(nextRoute)
    navigationTimer.current = window.setTimeout(() => {
      setRoute(nextRoute)
      setLoadingRoute(null)
      navigationTimer.current = null
    }, 360)
  }
  useEffect(() => () => {
    if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current)
  }, [])
  return <>
    <AppHeader />
    <Sidebar active={displayedRoute} collapsed={collapsed} theme={theme} onThemeChange={onThemeChange} onSelect={navigateTo} onToggle={onToggleSidebar} />
    <main className="main">
      <nav className="breadcrumbs" aria-label="Migas de pan">
        <span className="breadcrumb-home"><Home size={15} aria-hidden="true" /> SimulaEdu</span>
        <ChevronRight size={15} aria-hidden="true" />
        <span aria-current="page">{routeLabels[displayedRoute]}</span>
      </nav>
      {loadingRoute ? <Skeleton /> : <Component />}
    </main>
  </>
}
