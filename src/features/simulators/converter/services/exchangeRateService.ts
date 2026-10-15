import type { ConversionUnit } from '../types/converter.types'

// Valores fijos para el ejercicio; no representan tasas en tiempo real.
const mockRates: Partial<Record<ConversionUnit, number>> = { USD: 1, EUR: 0.92, COP: 4065 }

export function getExchangeRate(from: ConversionUnit, to: ConversionUnit): number {
  const fromRate = mockRates[from]
  const toRate = mockRates[to]
  if (fromRate === undefined || toRate === undefined) return 1
  return toRate / fromRate
}
