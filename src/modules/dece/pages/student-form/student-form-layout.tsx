import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft, faArrowRight } from '@fortawesome/free-solid-svg-icons'
import type { Student } from '../../types/student'
import type { DeceScreen } from '../../types/screen'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import FormNavigation from '../../components/form-navigation'
import { useDeceData } from '../../services/dece-data-context'
import ConfigurableForm from './configurable-form'
import PdfActionButton from '../../components/pdf-action-button'

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
  allowQuestionManagement?: boolean
  detailReview?: boolean
  onDownloadPdf?: () => Promise<void>
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
  allowQuestionManagement = true,
  detailReview = false,
  onDownloadPdf,
}: Props) {
  const general = kind === 'general'
  const integration = useDeceData()
  const [activeLabels, setActiveLabels] = useState(labels)
  const syncLabels = useCallback((next: string[]) => {
    const unchanged = activeLabels.length === next.length && activeLabels.every((label, index) => label === next[index])
    if (!unchanged) {
      setActiveLabels(next)
      setSection(0)
    }
  }, [activeLabels, setSection])
  useEffect(() => { setActiveLabels(labels) }, [labels])
  const visibleLabels = integration ? activeLabels : labels

  return (
    <div className="page-content container-fluid form-page">
      <button className="back-button btn" onClick={onBack}>
        <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
        {detailReview ? 'Volver a revisión de fichas' : 'Volver al directorio'}
      </button>
      {detailReview && <nav aria-label="Migas de pan" className="mb-3"><ol className="breadcrumb"><li className="breadcrumb-item"><button type="button" className="btn btn-link p-0" onClick={onBack}>Revisión de fichas</button></li><li className="breadcrumb-item active" aria-current="page">{heading}</li></ol></nav>}
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
        {detailReview ? <div className="form-switch"><PdfActionButton label="Descargar PDF lleno" className="btn btn-primary" generate={onDownloadPdf ?? (async () => {})} /></div> : <div className="form-switch">
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
        </div>}
      </div>
      <div className="form-layout">
        <FormNavigation labels={visibleLabels} section={Math.min(section, visibleLabels.length - 1)} setSection={setSection} />
        <section className="form-card">
          <div className="form-card-head">
            <div>
              <span className="eyebrow">
                SECCIÓN {String(section + 1).padStart(2, '0')} DE {visibleLabels.length}
              </span>
              <h2>{visibleLabels[section] ?? visibleLabels[0]}</h2>
            </div>
            <span className="required-note">* Campo requerido</span>
          </div>
          <div className="form-fields">
            {integration ? <ConfigurableForm
              integration={integration}
              student={student}
              code={kind}
              section={section}
              onSectionsChange={syncLabels}
              allowQuestionManagement={allowQuestionManagement}
            /> : contents.map((content, index) => (
              <div key={index} hidden={index !== section}>{content}</div>
            ))}
          </div>
          {!integration && <div className="form-actions">
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
              {section < visibleLabels.length - 1 ? (
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
          </div>}
        </section>
      </div>
      <footer className="page-footer">
        {integration ? 'Las respuestas se guardan en la ficha del estudiante.' : 'Vista demostrativa: conecta el proveedor DECE con la sesión de Supabase y los UUID reales para guardar la ficha.'}
      </footer>
    </div>
  )
}
