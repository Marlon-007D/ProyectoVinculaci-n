import type { ConversionKind, ConversionUnit, UnitOption } from '../types/converter.types'
import { ArrowLeftRight } from 'lucide-react'
import './ConverterResult.css'

interface Props { kind: ConversionKind; amount: number | ''; from: ConversionUnit; to: ConversionUnit; result: number; isValid: boolean; options: UnitOption[] }

export function ConverterResult({ kind, amount, from, to, result, isValid, options }: Props) {
  const fromName = options.find(option => option.code === from)?.name.toLowerCase() ?? from
  const toName = options.find(option => option.code === to)?.name.toLowerCase() ?? to
  return <aside className="result-card"><div className="simulator-result-icon"><ArrowLeftRight size={22} aria-hidden="true" /></div><p className="step-label">RESULTADO</p>{!isValid ? <p>Completa la cantidad para ver la conversión.</p> : <>
    <span className="result-value">{kind === 'currency' ? new Intl.NumberFormat('es-EC', { style: 'currency', currency: to }).format(result) : `${number.format(result)} ${toName}`}</span>
    <p>{number.format(Number(amount))} {fromName} equivalen a</p></>}
  </aside>
}

const number = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 })
