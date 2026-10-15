import { useMemo, useState } from 'react'
import type { CompoundingFrequency, InterestMode } from '../types/interest.types'
import { compoundInterest } from '../utils/compoundInterest'
import { simpleInterest } from '../utils/simpleInterest'

export function useInterestSimulator() {
  const [mode, setMode] = useState<InterestMode>('simple')
  const [principal, setPrincipal] = useState<number | ''>(500)
  const [annualRate, setAnnualRate] = useState<number | ''>(8)
  const [years, setYears] = useState<number | ''>(2)
  const [frequency, setFrequency] = useState<CompoundingFrequency>(12)
  const amount = useMemo(() => mode === 'simple'
    ? simpleInterest(Number(principal) || 0, Number(annualRate) || 0, Number(years) || 0)
    : compoundInterest(Number(principal) || 0, Number(annualRate) || 0, Number(years) || 0, frequency), [mode, principal, annualRate, years, frequency])
  const isValid = principal !== '' && annualRate !== '' && years !== ''
  const reset = () => { setMode('simple'); setPrincipal(500); setAnnualRate(8); setYears(2); setFrequency(12) }
  return { mode, setMode, principal, setPrincipal, annualRate, setAnnualRate, years, setYears, frequency, setFrequency, amount, isValid, reset }
}
