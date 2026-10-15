import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Sidebar } from '../../shared/components/Sidebar/Sidebar'
import { AppHeader } from '../../shared/components/AppHeader/AppHeader'
import { InvoiceSimulatorPage } from '../../features/simulators/invoice/pages/InvoiceSimulatorPage'
import { ConverterPage } from '../../features/simulators/converter/pages/ConverterPage'
import { InterestSimulatorPage } from '../../features/simulators/interest/pages/InterestSimulatorPage'
import { NewsPage } from '../../features/news/pages/NewsPage'
import { EventsPage } from '../../features/events/pages/EventsPage'
import { HonorsPage } from '../../features/honors/pages/HonorsPage'
import { AcademicPeriodsPage } from '../../features/academic-periods/pages/AcademicPeriodsPage'
import { SchoolCoursesPage } from '../../features/courses/pages/SchoolCoursesPage'
import { schoolModulesMock } from '../../features/courses/mocks/schoolModulesMock'
import { schoolCoursesMock } from '../../features/courses/mocks/schoolCoursesMock'
import type { BreadcrumbItem } from '../../shared/components/AppHeader/AppHeader'
import { InvoicePageSkeleton } from '../../features/simulators/invoice/pages/InvoicePageSkeleton'
import { ConverterPageSkeleton } from '../../features/simulators/converter/pages/ConverterPageSkeleton'
import { InterestPageSkeleton } from '../../features/simulators/interest/pages/InterestPageSkeleton'
import { AcademicContentSkeleton } from '../../features/academic-content/components/AcademicContentSkeleton'
import { AcademicPostPreviewPage } from '../../features/academic-content/pages/AcademicPostPreviewPage'
import type { AcademicContentEntry } from '../../features/academic-content/types/academicContent.types'
import type { ThemeName } from '../../features/themeUser/types/themeUser.types'

export type SimulatorRoute = 'invoice' | 'converter' | 'interest'
export type AppRoute = SimulatorRoute | 'school-courses' | 'news' | 'events' | 'honors' | 'academic-periods'

interface Props { collapsed: boolean; theme: ThemeName; onThemeChange: (theme: ThemeName, origin: { x: number; y: number }) => void; onToggleSidebar: () => void }

const pages = {
  invoice: { Component: InvoiceSimulatorPage },
  converter: { Component: ConverterPage },
  interest: { Component: InterestSimulatorPage },
  news: { Component: NewsPage },
  events: { Component: EventsPage },
  honors: { Component: HonorsPage },
  'academic-periods': { Component: AcademicPeriodsPage },
} satisfies Record<Exclude<AppRoute, 'school-courses'>, { Component: (props: { onPreview: (entry: AcademicContentEntry) => void }) => ReactNode }>

const routeSkeletons: Record<AppRoute, () => ReactNode> = {
  invoice: InvoicePageSkeleton,
  converter: ConverterPageSkeleton,
  interest: InterestPageSkeleton,
  'school-courses': () => <SchoolCoursesPage />,
  news: () => <AcademicContentSkeleton kind="news" title="Noticias" />,
  events: () => <AcademicContentSkeleton kind="event" title="Eventos" />,
  honors: () => <AcademicContentSkeleton kind="honor" title="Cuadro de honor" />,
  'academic-periods': () => <AcademicContentSkeleton kind="period" title="Período académico" />,
}

export function AppRouter({ collapsed, theme, onThemeChange, onToggleSidebar }: Props) {
  const [route, setRoute] = useState<AppRoute>('invoice')
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null)
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null)
  const [courseTopicName, setCourseTopicName] = useState<string | null>(null)
  const [evaluationActive, setEvaluationActive] = useState(false)
  const [loadingRoute, setLoadingRoute] = useState<AppRoute | null>(null)
  const [previewEntry, setPreviewEntry] = useState<AcademicContentEntry | null>(null)
  const navigationTimer = useRef<number | null>(null)
  const displayedRoute = loadingRoute ?? route
  const Component = displayedRoute === 'school-courses' ? null : pages[displayedRoute].Component
  const Skeleton = routeSkeletons[displayedRoute]
  const navigateTo = (nextRoute: AppRoute) => {
    if (nextRoute === displayedRoute) { setPreviewEntry(null); return }
    setPreviewEntry(null)
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
    navigateTo('school-courses')
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
  return <>
    <AppHeader breadcrumbs={breadcrumbs} />
    <Sidebar active={displayedRoute} activeModuleId={selectedModuleId} collapsed={collapsed} theme={theme} onThemeChange={onThemeChange} onSelect={navigateTo} onSelectModule={selectModule} onToggle={onToggleSidebar} />
    <main className="main">
      {loadingRoute ? <Skeleton /> : previewEntry ? <AcademicPostPreviewPage entry={previewEntry} /> : displayedRoute === 'school-courses' ? <SchoolCoursesPage selectedModuleId={selectedModuleId} selectedCourseId={selectedCourseId} evaluationActive={evaluationActive} onSelectCourse={selectCourse} onTopicChange={setCourseTopicName} onEvaluationChange={setEvaluationActive} /> : Component && <Component onPreview={showPostPreview} />}
    </main>
  </>
}
