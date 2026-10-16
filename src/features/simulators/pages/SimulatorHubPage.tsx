import { ArrowLeftRight, Calculator, ChevronRight, ReceiptText } from 'lucide-react'
import type { SimulatorRoute } from '../../../app/router/AppRouter'
import './SimulatorHubPage.css'

interface Props { onSelect?: (route: SimulatorRoute) => void }

const simulatorOptions = [
  { id: 'invoice', label: 'Facturación electrónica', description: 'Crea una factura y calcula el total.', Icon: ReceiptText },
  { id: 'converter', label: 'Unidades y monedas', description: 'Convierte medidas y valores de uso diario.', Icon: ArrowLeftRight },
  { id: 'interest', label: 'Interés financiero', description: 'Calcula interés simple y compuesto.', Icon: Calculator },
] as const

export function SimulatorHubPage({ onSelect }: Props) {
  return <section className="page-content simulator-hub-page">
    <header className="simulator-hub-header"><span><Calculator size={18} /> Simuladores</span><h1>Elige un simulador</h1><p>Selecciona una herramienta para comenzar.</p></header>
    <div className="simulator-hub-list" aria-label="Opciones de simuladores">{simulatorOptions.map(({ id, label, description, Icon }) => <button type="button" className="simulator-hub-card" key={id} onClick={() => onSelect?.(id)}><span className="simulator-hub-icon"><Icon size={21} /></span><span className="simulator-hub-info"><strong>{label}</strong><span>{description}</span></span><ChevronRight size={18} /></button>)}</div>
  </section>
}
