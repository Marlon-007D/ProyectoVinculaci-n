export type InterestMode = 'simple' | 'compound'
export type CompoundingFrequency = 1 | 4 | 12

export interface InterestInput {
  mode: InterestMode
  principal: number
  annualRate: number
  years: number
  frequency: CompoundingFrequency
}

export interface InterestResult { principal: number; amount: number; earned: number }
