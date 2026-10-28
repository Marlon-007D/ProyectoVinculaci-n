import type { SimulatorRoute } from '../../../app/router/AppRouter'
import './SimulatorHubPage.css'

interface Props { onSelect?: (route: SimulatorRoute) => void }

const simulatorOptions = [
  { id: 'invoice', label: 'Facturación electrónica', description: 'Crea una factura y calcula el total.', icon: 'receipt_long' },
  { id: 'converter', label: 'Unidades y monedas', description: 'Convierte medidas y valores de uso diario.', icon: 'swap_horiz' },
  { id: 'interest', label: 'Interés financiero', description: 'Calcula interés simple y compuesto.', icon: 'calculate' },
] as const

export function SimulatorHubPage({ onSelect }: Props) {
  return <section className="page-content simulator-hub-page">
    <header className="simulator-hub-header"><span><span className="portal-material-icon" aria-hidden="true">calculate</span> Simuladores</span><h1>Elige un simulador</h1><p>Selecciona una herramienta para comenzar.</p></header>
    <div className="simulator-hub-list" aria-label="Opciones de simuladores">{simulatorOptions.map(({ id, label, description, icon }) => <button type="button" className="simulator-hub-card" key={id} onClick={() => onSelect?.(id)}><span className="simulator-hub-icon"><span className="portal-material-icon" aria-hidden="true">{icon}</span></span><span className="simulator-hub-info"><strong>{label}</strong><span>{description}</span></span><span className="portal-material-icon simulator-hub-chevron" aria-hidden="true">chevron_right</span></button>)}</div>
  </section>
}
