import { useState } from 'react'
import { ArrowRight, Award, BookOpenText, CalendarDays, FolderKanban, GraduationCap, House, Layers3, LogOut, Newspaper } from 'lucide-react'
import { AdminCourseCategoriesPage } from './AdminCourseCategoriesPage'
import { AdminCoursesPage } from './AdminCoursesPage'
import { useCourseCategories } from '../../courses/hooks/useCourseCategories'
import { useSchoolCourses } from '../../courses/hooks/useSchoolCourses'
import { AcademicContentManager } from '../../academic-content/components/AcademicContentManager'
import styles from './AdminCoursesWorkspace.module.css'

type Section = 'home' | 'categories' | 'courses' | 'news' | 'events' | 'honors'

interface Props { onLogout: () => void }

export function AdminCoursesWorkspace({ onLogout }: Props) {
  const [section, setSection] = useState<Section>('home')
  const categories = useCourseCategories()
  const courses = useSchoolCourses()

  return <div className={styles.shell}>
    <aside className={styles.aside} aria-label="Administración de cursos">
      <div className={styles.brand}><span className={styles.brandIcon}><GraduationCap size={21} /></span><span>Admin cursos</span></div>
      <p className={styles.navLabel}>Administración</p>
      <nav className={styles.navigation} aria-label="Secciones del catálogo">
        <button type="button" className={section === 'home' ? styles.activeItem : styles.navItem} onClick={() => setSection('home')} aria-current={section === 'home' ? 'page' : undefined}><House size={19} /><span>Inicio</span></button>
        <button type="button" className={section === 'categories' ? styles.activeItem : styles.navItem} onClick={() => setSection('categories')} aria-current={section === 'categories' ? 'page' : undefined}><FolderKanban size={19} /><span>Categorías</span></button>
        <button type="button" className={section === 'courses' ? styles.activeItem : styles.navItem} onClick={() => setSection('courses')} aria-current={section === 'courses' ? 'page' : undefined}><BookOpenText size={19} /><span>Cursos</span></button>
        <button type="button" className={section === 'news' ? styles.activeItem : styles.navItem} onClick={() => setSection('news')} aria-current={section === 'news' ? 'page' : undefined}><Newspaper size={19} /><span>Noticias</span></button>
        <button type="button" className={section === 'events' ? styles.activeItem : styles.navItem} onClick={() => setSection('events')} aria-current={section === 'events' ? 'page' : undefined}><CalendarDays size={19} /><span>Eventos</span></button>
        <button type="button" className={section === 'honors' ? styles.activeItem : styles.navItem} onClick={() => setSection('honors')} aria-current={section === 'honors' ? 'page' : undefined}><Award size={19} /><span>Cuadro de honor</span></button>
      </nav>
      <button className={styles.logout} type="button" onClick={onLogout}><LogOut size={18} /><span>Cerrar sesión</span></button>
    </aside>
    <div className={styles.content}>
      {section === 'home' ? <main className={styles.home}>
        <header className={styles.homeHeader}>
          <p className={styles.homeEyebrow}>Administración del catálogo</p>
          <h1>Inicio</h1>
          <p>Gestiona las categorías y los cursos que aparecen en el portal educativo.</p>
        </header>
        <section className={styles.summary} aria-label="Resumen del catálogo">
          <article className={styles.summaryCard}><span className={`${styles.summaryIcon} ${styles.categoryIcon}`}><FolderKanban size={20} /></span><div><p>Categorías</p><strong>{categories.length}</strong></div></article>
          <article className={styles.summaryCard}><span className={`${styles.summaryIcon} ${styles.courseIcon}`}><BookOpenText size={20} /></span><div><p>Cursos</p><strong>{courses.length}</strong></div></article>
          <article className={styles.summaryCard}><span className={`${styles.summaryIcon} ${styles.topicIcon}`}><Layers3 size={20} /></span><div><p>Temas</p><strong>{courses.reduce((sum, course) => sum + course.units.length, 0)}</strong></div></article>
        </section>
        <section className={styles.quickSection}>
          <div className={styles.quickHeading}><h2>Accesos directos</h2><p>Continúa con la gestión del catálogo.</p></div>
          <div className={styles.quickLinks}>
            <button type="button" className={styles.quickLink} onClick={() => setSection('categories')}><span className={`${styles.summaryIcon} ${styles.categoryIcon}`}><FolderKanban size={20} /></span><span><strong>Administrar categorías</strong><small>Organiza las áreas de aprendizaje.</small></span><ArrowRight size={18} /></button>
            <button type="button" className={styles.quickLink} onClick={() => setSection('courses')}><span className={`${styles.summaryIcon} ${styles.courseIcon}`}><BookOpenText size={20} /></span><span><strong>Administrar cursos</strong><small>Edita cursos, temarios y evaluaciones.</small></span><ArrowRight size={18} /></button>
          </div>
        </section>
      </main> : section === 'categories' ? <AdminCourseCategoriesPage /> : section === 'news' ? <AcademicContentManager kind="news" title="Noticias" singular="Noticia" /> : section === 'events' ? <AcademicContentManager kind="event" title="Eventos" singular="Evento" /> : section === 'honors' ? <AcademicContentManager kind="honor" title="Cuadro de honor" singular="Reconocimiento" /> : <AdminCoursesPage />}
    </div>
  </div>
}
