import type { ConversionKind, ConversionUnit, UnitOption } from '../types/converter.types'
import { getExchangeRate } from '../services/exchangeRateService'

export const conversionOptions: Record<ConversionKind, UnitOption[]> = {
  currency: [{ code: 'USD', name: 'Dólar estadounidense' }, { code: 'EUR', name: 'Euro' }, { code: 'COP', name: 'Peso colombiano' }],
  length: [{ code: 'm', name: 'Metros' }, { code: 'cm', name: 'Centímetros' }, { code: 'km', name: 'Kilómetros' }],
}

const lengthInMeters: Record<'m' | 'cm' | 'km', number> = { m: 1, cm: 0.01, km: 1000 }

export function convertValue(kind: ConversionKind, amount: number, from: ConversionUnit, to: ConversionUnit): number {
  if (kind === 'currency') return amount * getExchangeRate(from, to)
  const source = lengthInMeters[from as keyof typeof lengthInMeters]
  const target = lengthInMeters[to as keyof typeof lengthInMeters]
  return amount * source / target
}
