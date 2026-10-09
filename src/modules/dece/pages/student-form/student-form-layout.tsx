import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import type { Student } from '../../types/student'
import type { DeceScreen } from '../../types/screen'
import type { ReactNode } from 'react'
import FormNavigation from '../../components/form-navigation'

type Props = {
  kind: 'general' | 'authorization'
  heading: string
  labels: string[]
  contents: ReactNode[]
  student: Student
  section: number
  setSection: (section: number) => void
  onBack: () => void
  onNavigate: (screen: DeceScreen) => void
}

export default function StudentFormLayout({
  kind,
  heading,
  labels,
  contents,
  student,
  section,
  setSection,
  onBack,
  onNavigate,
}: Props) {
  const general = kind === 'general'

  return (
    <div className="page-content container-fluid form-page">
      <button className="back-button btn" onClick={onBack}>
        <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
        Volver al directorio
      </button>
      <div className="eyebrow">
        FICHAS ESTUDIANTILES / {general ? 'REGISTRO GENERAL' : 'AUTORIZACIÓN'}
      </div>
      <div className="form-head">
        <div>
          <h1>{heading}</h1>
          <p className="subheading">
            {student.name} <span>·</span> {student.grade}
          </p>
        </div>
        <div className="form-switch">
          <button
            className={`btn ${general ? 'selected' : ''}`}
            onClick={() => onNavigate('general')}
          >
            Ficha general
          </button>
          <button
            className={`btn ${!general ? 'selected' : ''}`}
            onClick={() => onNavigate('authorization')}
          >
            Autorización
          </button>
        </div>
      </div>
      <div className="form-layout">
        <FormNavigation labels={labels} section={section} setSection={setSection} />
        <section className="form-card">
          <div className="form-card-head">
            <div>
              <span className="eyebrow">
                SECCIÓN {String(section + 1).padStart(2, '0')} DE {labels.length}
              </span>
              <h2>{labels[section]}</h2>
            </div>
            <span className="required-note">* Campo requerido</span>
          </div>
          <div className="form-fields">
            {contents.map((content, index) => (
              <div key={index} hidden={index !== section}>
                {content}
              </div>
            ))}
          </div>
          <div className="form-actions">
            <span className="helper">
              Los campos se mantienen mientras recorres las secciones.
            </span>
            <div>
              {section > 0 && (
                <button
                  className="button btn secondary"
                  onClick={() => setSection(section - 1)}
                >
                  Anterior
                </button>
              )}
              {section < labels.length - 1 ? (
                <button
                  className="button btn primary"
                  onClick={() => setSection(section + 1)}
                >
                  Continuar <FontAwesomeIcon icon={faArrowRight} aria-hidden="true" />
                </button>
              ) : (
                <button className="button btn primary" onClick={onBack}>
                  Volver al directorio
                </button>
              )}
            </div>
          </div>
        </section>
      </div>
      <footer className="page-footer">
        Los formularios son demostrativos. Los cambios no se envían ni se guardan en una base de datos.
      </footer>
    </div>
  )
}
