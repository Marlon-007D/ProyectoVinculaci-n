import type { LucideIcon } from 'lucide-react'
import {
  Blocks,
  Bug,
  Activity,
  Atom,
  BookOpenText,
  ChartNoAxesColumn,
  ClipboardList,
  CloudSun,
  Compass,
  Dna,
  FlaskConical,
  FileText,
  Fingerprint,
  FolderTree,
  GitBranch,
  Globe,
  History,
  HeartPulse,
  KeyRound,
  Leaf,
  ListOrdered,
  Lightbulb,
  LockKeyhole,
  MailWarning,
  MessageSquareText,
  MessageCircleHeart,
  Microscope,
  Mountain,
  Network,
  Puzzle,
  Search,
  ShieldCheck,
  SearchCheck,
  Share2,
  Telescope,
  UsersRound,
  Waves,
  Focus,
  Footprints,
} from 'lucide-react'
import type { TemarioLesson } from '../types/schoolTemario.types'
import inputIllustration from '../assets/temario-input.svg'
import outputIllustration from '../assets/temario-output.svg'
import processingIllustration from '../assets/temario-processing.svg'
import memoryIllustration from '../assets/temario-memory.svg'
import storageIllustration from '../assets/temario-storage.svg'
import peripheralsIllustration from '../assets/temario-peripherals.svg'
import styles from './CourseTemario.module.css'

interface Props {
  lesson: TemarioLesson
  courseId: string
  topicIndex: number
}

const conceptVectors: Record<string, LucideIcon> = {
  'Archivos y formatos': FileText,
  'Carpetas y nombres': FolderTree,
  'Versiones y copias': History,
  'Colaboración segura': UsersRound,
  'Permisos de acceso': KeyRound,
  'Archivos compartidos': Share2,
  'Datos personales': Fingerprint,
  'Contraseñas seguras': LockKeyhole,
  'Mensajes sospechosos': MailWarning,
  Verificación: SearchCheck,
  'Respeto en línea': MessageCircleHeart,
  'Huella digital': Footprints,
  Descomposición: Blocks,
  Patrones: Network,
  Abstracción: Focus,
  Algoritmos: ListOrdered,
  'Secuencias y decisiones': GitBranch,
  'Prueba y depuración': Bug,
}

const generalVectors: LucideIcon[] = [
  BookOpenText, ChartNoAxesColumn, Globe, MessageSquareText, Puzzle, UsersRound,
  ShieldCheck, Lightbulb, Search, Compass, ClipboardList, Network,
]

const scienceVectors: LucideIcon[] = [
  Atom, Dna, Microscope, Leaf, Waves, CloudSun, HeartPulse, Activity, ShieldCheck,
  FlaskConical, Mountain, Telescope,
]

export function CourseTemario({ lesson, courseId, topicIndex }: Props) {
  const conceptIllustrations = [inputIllustration, outputIllustration, processingIllustration, memoryIllustration, storageIllustration, peripheralsIllustration]
  const sectionVectors = courseId === 'ciencias' ? scienceVectors : generalVectors

  return <div className={styles.temario}>
    <section className={styles.learning} aria-label="Temario">
      {lesson.concepts.length > 0 && <div className={styles.conceptGrid} data-count={lesson.concepts.length} role="list" aria-label="Conceptos del temario">
        {lesson.concepts.map((concept, index) => {
          const isFirstComputerSection = courseId === 'informatica' && topicIndex === 0
          const ConceptVector = conceptVectors[concept.title]
            ?? (!isFirstComputerSection ? sectionVectors[(topicIndex * 6 + index) % sectionVectors.length] : undefined)
          const hasConceptVector = conceptVectors[concept.title] !== undefined || !isFirstComputerSection
          return (
          <article className={styles.concept} key={concept.title} role="listitem">
            <div className={`${styles.conceptIllustration}${hasConceptVector ? ` ${styles.conceptIllustrationVector}` : ''}`}>
              {ConceptVector
                ? <ConceptVector className={styles.conceptVector} aria-hidden="true" />
                : <img src={conceptIllustrations[index % conceptIllustrations.length]} alt="" aria-hidden="true" />}
            </div>
            <div className={styles.conceptCopy}>
              <h3>{concept.title}</h3>
              <p>{concept.detail}</p>
            </div>
          </article>
        )})}
      </div>}
    </section>

  </div>
}
