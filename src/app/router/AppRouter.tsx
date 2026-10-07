import { useState } from 'react'
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
import type { ThemeName } from '../../features/themeUser/types/themeUser.types'

export type SimulatorRoute = 'invoice' | 'converter' | 'interest'
export type AppRoute = SimulatorRoute | 'news' | 'events' | 'honors' | 'academic-periods'

interface Props { collapsed: boolean; theme: ThemeName; onThemeChange: (theme: ThemeName) => void; onToggleSidebar: () => void }

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

export function AppRouter({ collapsed, theme, onThemeChange, onToggleSidebar }: Props) {
  const [route, setRoute] = useState<AppRoute>('invoice')
  const { Component } = pages[route]
  return <>
    <AppHeader />
    <Sidebar active={route} collapsed={collapsed} theme={theme} onThemeChange={onThemeChange} onSelect={setRoute} onToggle={onToggleSidebar} />
    <main className="main">
      <nav className="breadcrumbs" aria-label="Migas de pan">
        <span className="breadcrumb-home"><Home size={15} aria-hidden="true" /> SimulaEdu</span>
        <ChevronRight size={15} aria-hidden="true" />
        <span aria-current="page">{routeLabels[route]}</span>
      </nav>
      <Component />
    </main>
  </>
}
