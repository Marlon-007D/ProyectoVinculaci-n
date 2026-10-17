import { useMemo, useState } from 'react'
import type { CompoundingFrequency, InterestMode } from '../types/interest.types'
import { compoundInterest } from '../utils/compoundInterest'
import { simpleInterest } from '../utils/simpleInterest'

const MAX_PRINCIPAL = 1_000_000
const MAX_ANNUAL_RATE = 100
const MAX_YEARS = 30

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
  const setPrincipalLimited = (value: number | '') => setPrincipal(value === '' ? '' : Math.min(MAX_PRINCIPAL, Math.max(0, value)))
  const setAnnualRateLimited = (value: number | '') => setAnnualRate(value === '' ? '' : Math.min(MAX_ANNUAL_RATE, Math.max(0, value)))
  const setYearsLimited = (value: number | '') => setYears(value === '' ? '' : Math.min(MAX_YEARS, Math.max(0, value)))
  return { mode, setMode, principal, setPrincipal: setPrincipalLimited, annualRate, setAnnualRate: setAnnualRateLimited, years, setYears: setYearsLimited, frequency, setFrequency, amount, isValid }
}
