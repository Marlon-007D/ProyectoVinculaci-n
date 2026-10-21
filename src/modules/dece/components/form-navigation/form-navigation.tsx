import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCheck, faChevronRight } from '@fortawesome/free-solid-svg-icons'

type Props = {
  labels: string[]
  section: number
  setSection: (section: number) => void
}

export default function FormNavigation({ labels, section, setSection }: Props) {
  return (
    <nav className="step-list" aria-label="Secciones del formulario">
      {labels.map((label, index) => (
        <button
          className={`nav-item ${section === index ? 'current' : ''}`}
          type="button"
          aria-current={section === index ? 'step' : undefined}
          key={label}
          onClick={() => setSection(index)}
        >
          <span className="step-number">
            {index < section ? (
              <FontAwesomeIcon icon={faCheck} aria-hidden="true" />
            ) : (
              String(index + 1).padStart(2, '0')
            )}
          </span>
          {label}
          {section === index && (
            <span className="step-arrow">
              <FontAwesomeIcon icon={faChevronRight} aria-hidden="true" />
            </span>
          )}
        </button>
      ))}
    </nav>
  )
}
