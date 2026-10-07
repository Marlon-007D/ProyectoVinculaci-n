import { ChartNoAxesCombined, RotateCcw } from 'lucide-react'
import './InterestResult.css'

interface Props { principal: number | ''; amount: number; isValid: boolean; onReset: () => void }

export function InterestResult({ principal, amount, isValid, onReset }: Props) {
  return <aside className="result-card"><div className="simulator-result-icon"><ChartNoAxesCombined size={22} aria-hidden="true" /></div><p className="step-label">PROYECCIÓN</p>{isValid ? <><span className="result-value">{usd.format(amount)}</span><p>Monto estimado al finalizar el período</p>
    <dl className="result-breakdown"><div><dt>Capital inicial</dt><dd>{usd.format(Number(principal))}</dd></div><div><dt>Interés generado</dt><dd>{usd.format(amount - Number(principal))}</dd></div></dl></> : <p>Completa los campos para ver la proyección.</p>}
    <button className="reset-button" onClick={onReset}><span className="reset-button-icon"><RotateCcw size={17} aria-hidden="true" /></span><span>Usar ejemplo</span></button>
  </aside>
}

const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' })
