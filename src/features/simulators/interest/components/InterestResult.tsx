import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import type { InterestMode } from '../types/interest.types'
import { formatExactInterestAmount, formatInterestAmount } from '../utils/formatInterestAmount'
import { PenguinMascot } from '../../../courses/components/PenguinMascot'
import './InterestResult.css'

interface Props { mode: InterestMode; principal: number | ''; annualRate: number | ''; years: number | ''; frequency: number; amount: number; isValid: boolean }
const simpleTips = [
  'Interés simple: siempre se calcula sobre el capital inicial.',
  'La tasa anual ayuda a comparar escenarios con el mismo plazo.',
  'Más tiempo puede aumentar el interés total de este modelo.',
  'Ensayar distintas metas también ayuda a aprender a ahorrar.',
  'Comprender las tasas ayuda a decidir con más confianza.',
]
const compoundTips = [
  'Interés compuesto: los intereses se suman al saldo.',
  'La frecuencia indica cuántas veces se actualiza el saldo al año.',
  'Con el tiempo, los intereses también pueden generar intereses.',
  'Prueba varios plazos y observa el efecto acumulado.',
  'Comparar opciones fortalece tus decisiones financieras.',
]

export function InterestResult({ mode, principal, annualRate, years, frequency, amount, isValid }: Props) {
  const animationKey = `${mode}-${principal}-${annualRate}-${years}-${frequency}-${amount}`
  const tips = mode === 'simple' ? simpleTips : compoundTips
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * tips.length))
  useEffect(() => {
    setTipIndex(current => (current + 1 + Math.floor(Math.random() * (tips.length - 1))) % tips.length)
  }, [animationKey, tips.length])
  const insight = isValid ? tips[tipIndex] : 'Completa capital, tasa y plazo para calcular la proyección.'
  const amountExact = formatExactInterestAmount(amount)
  const amountLabel = formatInterestAmount(amount)
  const amountStyle = { '--amount-fit-size': `${85 / amountLabel.length}cqw` } as CSSProperties
  const earnedExact = formatExactInterestAmount(amount - Number(principal))
  const earnedLabel = earnedExact
  const earnedStyle = { '--breakdown-fit-size': `${65 / earnedLabel.length}cqw` } as CSSProperties
  return <aside className="result-card interest-result-card" aria-live="polite"><div className="interest-result-heading"><PenguinMascot key={animationKey} expression={isValid ? 'excited' : 'curious'} /><div className="interest-penguin-speech">{insight}</div></div>{isValid ? <><span className="result-value interest-result-value" key={animationKey} style={amountStyle} title={amountExact} aria-label={`Monto estimado exacto: ${amountExact}`}>{amountLabel}</span><p>Monto estimado al finalizar el período</p>
    <dl className="result-breakdown"><div><dt>Capital inicial</dt><dd>{formatExactInterestAmount(Number(principal))}</dd></div><div><dt>Interés generado</dt><dd style={earnedStyle} title={earnedExact} aria-label={`Interés generado exacto: ${earnedExact}`}>{earnedLabel}</dd></div></dl></> : <p>Completa los campos para ver la proyección.</p>}
  </aside>
}
