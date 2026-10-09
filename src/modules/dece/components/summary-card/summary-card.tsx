import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faClock,
  faFileLines,
  faHeartPulse,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import type { SummaryIcon } from '../../types/icons'

type Props = {
  icon: SummaryIcon
  label: string
  value: string
  hint: string
  tone: string
}

const icons: Record<SummaryIcon, IconDefinition> = {
  students: faUsers,
  forms: faFileLines,
  authorizations: faHeartPulse,
  'follow-ups': faClock,
}

export default function SummaryCard({ icon, label, value, hint, tone }: Props) {
  return (
    <div className={`summary-card col-12 col-sm-6 col-xl-3`}>
      <div className={`summary-icon ${tone}`}>
        <FontAwesomeIcon icon={icons[icon]} aria-hidden="true" />
      </div>
      <div className="summary-label">{label}</div>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  )
}
