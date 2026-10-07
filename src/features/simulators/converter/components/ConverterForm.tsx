import { ArrowLeftRight, ArrowRightLeft, Coins, Ruler } from 'lucide-react'
import type { ConversionKind, ConversionUnit, UnitOption } from '../types/converter.types'
import './ConverterForm.css'

interface Props {
  kind: ConversionKind; amount: number | ''; from: ConversionUnit; to: ConversionUnit; options: UnitOption[]
  onKind: (kind: ConversionKind) => void; onAmount: (amount: number | '') => void
  onFrom: (unit: ConversionUnit) => void; onTo: (unit: ConversionUnit) => void; onSwap: () => void
}

export function ConverterForm({ kind, amount, from, to, options, onKind, onAmount, onFrom, onTo, onSwap }: Props) {
  return <section className="simulator-card">
    <div className="converter-title"><span className="simulator-title-icon"><ArrowRightLeft size={21} aria-hidden="true" /></span><h2>¿Qué deseas convertir?</h2></div>
    <div className="segmented-control"><button className={kind === 'currency' ? 'selected' : ''} onClick={() => onKind('currency')}><Coins size={16} aria-hidden="true" />Monedas</button><button className={kind === 'length' ? 'selected' : ''} onClick={() => onKind('length')}><Ruler size={16} aria-hidden="true" />Longitud</button></div>
    <div className="conversion-form">
      <label><span className="simulator-field-label"><Coins size={16} aria-hidden="true" />Cantidad</span><input required type="number" min="0" aria-invalid={amount === ''} aria-describedby={amount === '' ? 'conversion-amount-error' : undefined} value={amount} onChange={e => onAmount(e.target.value === '' ? '' : Number(e.target.value))} />{amount === '' && <span className="simulator-field-error" id="conversion-amount-error" role="alert">Ingresa una cantidad para convertir.</span>}</label>
      <label><span className="simulator-field-label"><ArrowLeftRight size={16} aria-hidden="true" />Desde</span><select value={from} onChange={e => onFrom(e.target.value as ConversionUnit)}>{options.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}</select></label>
      <button className="swap-button" onClick={onSwap} aria-label="Intercambiar unidades"><ArrowLeftRight size={21} /></button>
      <label><span className="simulator-field-label"><ArrowLeftRight size={16} aria-hidden="true" />Hacia</span><select value={to} onChange={e => onTo(e.target.value as ConversionUnit)}>{options.map(option => <option key={option.code} value={option.code}>{option.name}</option>)}</select></label>
    </div>
  </section>
}
