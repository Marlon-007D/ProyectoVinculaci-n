export type ConversionKind = 'currency' | 'length'
export type ConversionUnit = 'USD' | 'EUR' | 'COP' | 'm' | 'cm' | 'km'

export interface ConversionState {
  kind: ConversionKind
  amount: number | ''
  from: ConversionUnit
  to: ConversionUnit
}

export interface UnitOption { code: ConversionUnit; name: string }
