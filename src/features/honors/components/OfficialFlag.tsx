import styles from './OfficialFlag.module.css'
import type { OfficialFlagKind } from '../utils/honorRules'

interface Props {
  kind: OfficialFlagKind
}

const flagLabels: Record<OfficialFlagKind, string> = {
  national: 'Bandera del Ecuador',
  city: 'Bandera del cantón Santo Domingo',
  institutional: 'Bandera institucional ilustrativa',
}

export function OfficialFlag({ kind }: Props) {
  return <svg className={styles.flag} viewBox="0 0 36 24" role="img" aria-label={flagLabels[kind]} focusable="false">
    {kind === 'national' ? <>
      <rect width="36" height="24" fill="#ffcf22" />
      <rect y="12" width="36" height="6" fill="#17479e" />
      <rect y="18" width="36" height="6" fill="#d92f3a" />
      <path d="M18 7.2 21.7 9l-.8 4.7L18 16l-2.9-2.3-.8-4.7L18 7.2Z" fill="#f3d16c" stroke="#6f482b" strokeWidth=".55" />
      <path d="m14.6 7.1 2.1.6L18 6.1l1.3 1.6 2.1-.6-1.2 1.7h-3.9l-1.7-1.7Z" fill="#583b2e" />
      <path d="M16 10.3h4v1.5h-4zM16.5 12.4h3v1.4h-3z" fill="#286c63" />
    </> : kind === 'city' ? <>
      <path d="M0 0h36v24L0 0Z" fill="#d3343d" />
      <path d="M0 0v24h36L0 0Z" fill="#1c643e" />
      <path d="M18 7.1 22 8.7l-.6 5.2-3.4 3-3.4-3L14 8.7l4-1.6Z" fill="#f1d06c" stroke="#68442c" strokeWidth=".6" />
      <path d="M16 9.4h4v2.2h-4z" fill="#f6f0d8" />
      <path d="M16.7 12.3h2.6v2.1h-2.6z" fill="#2f7251" />
    </> : <>
      <rect width="36" height="24" fill="#f7f4fb" />
      <path d="M0 0h36v6H0zM0 18h36v6H0z" fill="#5b4672" />
      <path d="M18 5.7 24 8v5.7c0 3.5-2.7 5.7-6 7.2-3.3-1.5-6-3.7-6-7.2V8l6-2.3Z" fill="#fff" stroke="#5b4672" strokeWidth=".9" />
      <path d="M13.9 10.4c1.6-.7 2.9-.4 4.1.4 1.2-.8 2.5-1.1 4.1-.4v4.2c-1.6-.7-2.9-.4-4.1.4-1.2-.8-2.5-1.1-4.1-.4v-4.2Z" fill="#d6c6e8" stroke="#5b4672" strokeWidth=".55" />
      <path d="M18 10.9v4.1" stroke="#5b4672" strokeWidth=".6" />
    </>}
  </svg>
}
