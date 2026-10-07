import { ArrowLeftRight } from 'lucide-react'
import type { ConversionKind, ConversionUnit, UnitOption } from '../types/converter.types'
import './ConverterForm.css'

interface Props {
  kind: ConversionKind; amount: number | ''; from: ConversionUnit; to: ConversionUnit; options: UnitOption[]
  onKind: (kind: ConversionKind) => void; onAmount: (amount: number | '') => void
  onFrom: (unit: ConversionUnit) => void; onTo: (unit: ConversionUnit) => void; onSwap: () => void
}

export function ConverterForm({ kind, amount, from, to, options, onKind, onAmount, onFrom, onTo, onSwap }: Props) {
  return <section className="simulator-card">
    <h2>¿Qué deseas convertir?</h2>
    <div className="segmented-control"><button className={kind === 'currency' ? 'selected' : ''} onClick={() => onKind('currency')}>Monedas</button><button className={kind === 'length' ? 'selected' : ''} onClick={() => onKind('length')}>Longitud</button></div>
    <div className="conversion-form">
      <label>Cantidad<input required type="number" min="0" aria-invalid={amount === ''} aria-describedby={amount === '' ? 'conversion-amount-error' : undefined} value={amount} onChange={e => onAmount(e.target.value === '' ? '' : Number(e.target.value))} />{amount === '' && <span className="simulator-field-error" id="conversion-amount-error" role="alert">Ingresa una cantidad para convertir.</span>}</label>
      <label>Desde<select value={from} onChange={e => onFrom(e.target.value as ConversionUnit)}>{options.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}</select></label>
      <button className="swap-button" onClick={onSwap} aria-label="Intercambiar unidades"><ArrowLeftRight size={21} /></button>
      <label>Hacia<select value={to} onChange={e => onTo(e.target.value as ConversionUnit)}>{options.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}</select></label>
    </div>
  </section>
}
