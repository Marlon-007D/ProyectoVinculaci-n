export function compoundInterest(principal: number, annualRate: number, years: number, frequency: number): number {
  return principal * (1 + annualRate / 100 / frequency) ** (frequency * years)
}
