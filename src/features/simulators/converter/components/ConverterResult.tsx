import { useEffect, useState } from 'react'
import type { ConversionKind, ConversionUnit, UnitOption } from '../types/converter.types'
import { PenguinMascot } from '../../../courses/components/PenguinMascot'
import './ConverterResult.css'

interface Props { kind: ConversionKind; amount: number | ''; from: ConversionUnit; to: ConversionUnit; result: number; isValid: boolean; options: UnitOption[] }
const currencyTips = [
  'Los tipos de cambio pueden variar; revisa la tasa antes de decidir.',
  'Comparar precios después de convertir ayuda a planificar tus compras.',
  'Una conversión estima el valor; comisiones y tasas pueden cambiar el total.',
  'El dólar es la moneda oficial de Ecuador; otras monedas requieren conversión.',
]
const lengthTips = [
  'Un kilómetro equivale a 1.000 metros.',
  'Un metro tiene 100 centímetros.',
  'Convertir a una unidad común facilita comparar medidas.',
  'La unidad final importa: revisa si el resultado está en m, cm o km.',
]

export function ConverterResult({ kind, amount, from, to, result, isValid, options }: Props) {
  const fromName = options.find(option => option.code === from)?.name.toLowerCase() ?? from
  const toName = options.find(option => option.code === to)?.name.toLowerCase() ?? to
  const animationKey = `${kind}-${amount}-${from}-${to}-${result}`
  const tips = kind === 'currency' ? currencyTips : lengthTips
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * tips.length))
  useEffect(() => {
    setTipIndex(current => (current + 1 + Math.floor(Math.random() * (tips.length - 1))) % tips.length)
  }, [animationKey, tips.length])
  return <aside className="result-card converter-result-inline" aria-live="polite"><div className="converter-result-copy"><p className="step-label">RESULTADO</p>{!isValid ? <p>Completa la cantidad para ver la conversión.</p> : <>
    <span className="result-value converter-result-value" key={animationKey}>{kind === 'currency' ? new Intl.NumberFormat('es-EC', { style: 'currency', currency: to }).format(result) : `${number.format(result)} ${toName}`}</span>
    <p>{number.format(Number(amount))} {fromName} equivalen a</p></>}</div><div className="converter-result-coach"><p className="converter-penguin-speech">{tips[tipIndex]}</p><PenguinMascot key={animationKey} expression={isValid ? 'excited' : 'curious'} /></div>
  </aside>
}

const number = new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 })
