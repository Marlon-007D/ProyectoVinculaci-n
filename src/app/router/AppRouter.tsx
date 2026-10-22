import { useEffect, useRef, useState } from 'react'
import type { ElementType, ReactNode } from 'react'
import { FileText, FolderOpen } from 'lucide-react'
import { Sidebar } from '../../shared/components/Sidebar/Sidebar'
import { AppHeader } from '../../shared/components/AppHeader/AppHeader'
import { InvoiceSimulatorPage } from '../../features/simulators/invoice/pages/InvoiceSimulatorPage'
import { ConverterPage } from '../../features/simulators/converter/pages/ConverterPage'
import { InterestSimulatorPage } from '../../features/simulators/interest/pages/InterestSimulatorPage'
import { SimulatorHubPage } from '../../features/simulators/pages/SimulatorHubPage'
import { NewsPage } from '../../features/news/pages/NewsPage'
import { EventsPage } from '../../features/events/pages/EventsPage'
import { HonorsPage } from '../../features/honors/pages/HonorsPage'
import { AcademicPeriodsPage } from '../../features/academic-periods/pages/AcademicPeriodsPage'
import { SchoolCoursesPage } from '../../features/courses/pages/SchoolCoursesPage'
import { SchoolModuleSkeleton } from '../../features/courses/components/SchoolModuleSkeleton'
import { schoolModulesMock } from '../../features/courses/mocks/schoolModulesMock'
import { schoolCoursesMock } from '../../features/courses/mocks/schoolCoursesMock'
import type { BreadcrumbItem } from '../../shared/components/AppHeader/AppHeader'
import { InvoicePageSkeleton } from '../../features/simulators/invoice/pages/InvoicePageSkeleton'
import { ConverterPageSkeleton } from '../../features/simulators/converter/pages/ConverterPageSkeleton'
import { InterestPageSkeleton } from '../../features/simulators/interest/pages/InterestPageSkeleton'
import { AcademicContentSkeleton } from '../../features/academic-content/components/AcademicContentSkeleton'
import { AcademicPostPreviewPage } from '../../features/academic-content/pages/AcademicPostPreviewPage'
import { ReportsHubPage } from '../../features/academic-content/pages/ReportsHubPage'
import type { AcademicContentEntry } from '../../features/academic-content/types/academicContent.types'
import type { ThemeName } from '../../features/themeUser/types/themeUser.types'
import { HomePage } from '../../features/home/pages/HomePage'

export type SimulatorRoute = 'invoice' | 'converter' | 'interest'
export type AppRoute = SimulatorRoute | 'home' | 'simulator-hub' | 'reports-hub' | 'school-courses' | 'news' | 'events' | 'honors' | 'academic-periods'

interface Props { collapsed: boolean; theme: ThemeName; onThemeChange: (theme: ThemeName, origin: { x: number; y: number }) => void; onToggleSidebar: () => void }

const pages = {
  home: { Component: HomePage },
  invoice: { Component: InvoiceSimulatorPage },
  converter: { Component: ConverterPage },
  interest: { Component: InterestSimulatorPage },
  'simulator-hub': { Component: SimulatorHubPage },
  'reports-hub': { Component: ReportsHubPage },
  'school-courses': { Component: SchoolCoursesPage },
  news: { Component: NewsPage },
  events: { Component: EventsPage },
  honors: { Component: HonorsPage },
  'academic-periods': { Component: AcademicPeriodsPage },
} satisfies Record<AppRoute, { Component: ElementType }>

const routeSkeletons: Record<AppRoute, () => ReactNode> = {
  home: () => <HomePage />,
  invoice: InvoicePageSkeleton,
  converter: ConverterPageSkeleton,
  interest: InterestPageSkeleton,
  'simulator-hub': () => <SimulatorHubPage />,
  'reports-hub': () => <ReportsHubPage />,
  'school-courses': () => <SchoolCoursesPage />,
  news: () => <AcademicContentSkeleton kind="news" title="Noticias" />,
  events: () => <AcademicContentSkeleton kind="event" title="Eventos" />,
  honors: () => <AcademicContentSkeleton kind="honor" title="Cuadro de honor" />,
  'academic-periods': () => <AcademicContentSkeleton kind="period" title="Período académico" />,
}

export function AppRouter({ collapsed, theme, onThemeChange, onToggleSidebar }: Props) {
  const [route, setRoute] = useState<AppRoute>('home')
  const [invoiceSection, setInvoiceSection] = useState<'emission' | 'history'>('emission')
  const [invoiceCount, setInvoiceCount] = useState(0)
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [courseTopicName, setCourseTopicName] = useState<string | null>(null)
  const [evaluationActive, setEvaluationActive] = useState(false)
  const [loadingRoute, setLoadingRoute] = useState<AppRoute | null>(null)
  const [previewEntry, setPreviewEntry] = useState<AcademicContentEntry | null>(null)
  const navigationTimer = useRef<number | null>(null)
  const displayedRoute = loadingRoute ?? route
  const { Component }: { Component: ElementType } = pages[displayedRoute]
  const Skeleton = routeSkeletons[displayedRoute]
  const navigateTo = (nextRoute: AppRoute, forceLoading = false) => {
    if (nextRoute === displayedRoute && !forceLoading) { setPreviewEntry(null); return }
    setPreviewEntry(null)
    if (nextRoute === 'home') {
      if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current)
      navigationTimer.current = null
      setLoadingRoute(null)
      setRoute('home')
      return
    }
    if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current)
    setLoadingRoute(nextRoute)
    navigationTimer.current = window.setTimeout(() => {
      setRoute(nextRoute)
      setLoadingRoute(null)
      navigationTimer.current = null
    }, 360)
  }
  const selectCourse = (courseId: string) => {
    setSelectedCourseId(courseId)
    setCourseTopicName(schoolCoursesMock.find(course => course.id === courseId)?.units[0]?.title ?? null)
    setEvaluationActive(false)
    navigateTo('school-courses')
  }
  const selectModule = (moduleId: string) => {
    setSelectedModuleId(moduleId)
    setSelectedCourseId(null)
    setCourseTopicName(null)
    setEvaluationActive(false)
    navigateTo('school-courses', true)
  }
  useEffect(() => () => {
    if (navigationTimer.current !== null) window.clearTimeout(navigationTimer.current)
  }, [])
  const showPostPreview = (entry: AcademicContentEntry) => setPreviewEntry(entry)
  const selectedCourse = schoolCoursesMock.find(course => course.id === selectedCourseId)
  const selectedModule = schoolModulesMock.find(module => module.id === selectedModuleId)
  const openCourses = () => { setSelectedCourseId(null); setSelectedModuleId(null); setCourseTopicName(null); setEvaluationActive(false); navigateTo('school-courses') }
  const breadcrumbs: BreadcrumbItem[] = displayedRoute === 'school-courses' ? [
    { label: 'Cursos', onClick: selectedModule || selectedCourse ? openCourses : undefined },
    ...(selectedModule ? [{ label: selectedModule.name, onClick: selectedCourse ? () => { setSelectedCourseId(null); setEvaluationActive(false); setCourseTopicName(null); navigateTo('school-courses') } : undefined }] : []),
    ...(selectedCourse ? [{ label: selectedCourse.name, onClick: evaluationActive ? () => setEvaluationActive(false) : () => { setSelectedCourseId(null); setCourseTopicName(null); navigateTo('school-courses') } }] : []),
    ...(selectedCourse && courseTopicName ? [{ label: courseTopicName, onClick: evaluationActive ? () => setEvaluationActive(false) : undefined }] : []),
    ...(evaluationActive ? [{ label: 'Evaluaciones' }] : []),
  ] : []
  const invoiceNavigation = displayedRoute === 'invoice' && !loadingRoute ? <nav className="invoice-navbar-tabs" aria-label="Secciones de facturación" role="tablist">
    <button className="invoice-navbar-tab" id="invoice-tab-emission" type="button" role="tab" aria-controls="invoice-panel-emission" aria-selected={invoiceSection === 'emission'} onClick={() => setInvoiceSection('emission')}><FileText size={18} aria-hidden="true" />Emisión</button>
    <button className="invoice-navbar-tab" id="invoice-tab-history" type="button" role="tab" aria-controls="invoice-panel-history" aria-selected={invoiceSection === 'history'} onClick={() => setInvoiceSection('history')}><FolderOpen size={18} aria-hidden="true" />Facturas<span className="invoice-section-count">{invoiceCount}</span></button>
  </nav> : undefined
  return <>
    <AppHeader breadcrumbs={breadcrumbs} navigation={invoiceNavigation} theme={theme} onThemeChange={onThemeChange} />
    <Sidebar active={displayedRoute} activeModuleId={selectedModuleId} collapsed={collapsed} onSelect={nextRoute => nextRoute === 'school-courses' ? openCourses() : navigateTo(nextRoute)} onSelectModule={selectModule} onToggle={onToggleSidebar} />
    <main className="main">
      {loadingRoute === 'school-courses' && selectedModuleId && !selectedCourseId ? <SchoolModuleSkeleton courseCount={selectedModule?.courseIds.length ?? 1} /> : loadingRoute ? <Skeleton /> : previewEntry ? <AcademicPostPreviewPage entry={previewEntry} /> : displayedRoute === 'home' ? <HomePage onSelect={navigateTo} /> : displayedRoute === 'school-courses' ? <SchoolCoursesPage selectedModuleId={selectedModuleId} selectedCourseId={selectedCourseId} evaluationActive={evaluationActive} onSelectModule={selectModule} onSelectCourse={selectCourse} onBackToModules={openCourses} onBackToModule={() => { setSelectedCourseId(null); setEvaluationActive(false); setCourseTopicName(null); navigateTo('school-courses') }} onTopicChange={setCourseTopicName} onEvaluationChange={setEvaluationActive} /> : displayedRoute === 'simulator-hub' ? <SimulatorHubPage onSelect={navigateTo} /> : displayedRoute === 'reports-hub' ? <ReportsHubPage onSelect={navigateTo} /> : displayedRoute === 'invoice' ? <InvoiceSimulatorPage activeSection={invoiceSection} onSectionChange={setInvoiceSection} onInvoiceCountChange={setInvoiceCount} /> : <Component onPreview={showPostPreview} />}
    </main>
  </>
}
