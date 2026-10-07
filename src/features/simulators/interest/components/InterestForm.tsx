import { Calculator } from 'lucide-react'
import type { CompoundingFrequency, InterestMode } from '../types/interest.types'
import './InterestForm.css'

interface Props {
  mode: InterestMode; principal: number | ''; annualRate: number | ''; years: number | ''; frequency: CompoundingFrequency
  onMode: (mode: InterestMode) => void; onPrincipal: (value: number | '') => void; onRate: (value: number | '') => void
  onYears: (value: number | '') => void; onFrequency: (value: CompoundingFrequency) => void
}

export function InterestForm({ mode, principal, annualRate, years, frequency, onMode, onPrincipal, onRate, onYears, onFrequency }: Props) {
  return <section className="simulator-card"><h2>Calcula tu proyección</h2>
    <div className="segmented-control"><button className={mode === 'simple' ? 'selected' : ''} onClick={() => onMode('simple')}>Interés simple</button><button className={mode === 'compound' ? 'selected' : ''} onClick={() => onMode('compound')}>Interés compuesto</button></div>
    <div className="interest-form">
      <label>Capital inicial (USD)<input required type="number" min="0" aria-invalid={principal === ''} aria-describedby={principal === '' ? 'interest-principal-error' : undefined} value={principal} onChange={e => onPrincipal(e.target.value === '' ? '' : Number(e.target.value))} />{principal === '' && <span className="simulator-field-error" id="interest-principal-error" role="alert">Ingresa el capital inicial.</span>}</label>
      <label>Tasa anual (%)<input required type="number" min="0" step=".1" aria-invalid={annualRate === ''} aria-describedby={annualRate === '' ? 'interest-rate-error' : undefined} value={annualRate} onChange={e => onRate(e.target.value === '' ? '' : Number(e.target.value))} />{annualRate === '' && <span className="simulator-field-error" id="interest-rate-error" role="alert">Ingresa la tasa anual.</span>}</label>
      <label>Tiempo (años)<input required type="number" min="0" step=".5" aria-invalid={years === ''} aria-describedby={years === '' ? 'interest-years-error' : undefined} value={years} onChange={e => onYears(e.target.value === '' ? '' : Number(e.target.value))} />{years === '' && <span className="simulator-field-error" id="interest-years-error" role="alert">Ingresa el tiempo en años.</span>}</label>
      {mode === 'compound' && <label>Capitalización<select value={frequency} onChange={e => onFrequency(Number(e.target.value) as CompoundingFrequency)}><option value="12">Mensual</option><option value="4">Trimestral</option><option value="1">Anual</option></select></label>}
    </div>
    <div className="formula"><Calculator size={18} />{mode === 'simple' ? 'Monto = capital × (1 + tasa × tiempo)' : 'Monto = capital × (1 + tasa / períodos)⁽períodos × tiempo⁾'}</div>
  </section>
}
