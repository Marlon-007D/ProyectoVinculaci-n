export function simpleInterest(principal: number, annualRate: number, years: number): number {
  return principal * (1 + annualRate / 100 * years)
}
