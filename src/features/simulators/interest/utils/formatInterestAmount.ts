const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const scaledNumber = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const scales = [
  { threshold: 1e18, singular: 'trillón', plural: 'trillones' },
  { threshold: 1e15, singular: 'mil billones', plural: 'mil billones' },
  { threshold: 1e12, singular: 'billón', plural: 'billones' },
  { threshold: 1e9, singular: 'mil millones', plural: 'mil millones' },
  { threshold: 1e6, singular: 'millón', plural: 'millones' },
]

export function formatInterestAmount(value: number): string {
  const absoluteValue = Math.abs(value)
  const scale = scales.find(candidate => absoluteValue >= candidate.threshold)
  if (!scale) return usd.format(value)

  const scaledValue = absoluteValue / scale.threshold
  const roundedValue = Math.round(scaledValue * 100) / 100
  const label = roundedValue === 1 ? scale.singular : scale.plural
  const sign = value < 0 ? '-' : ''
  return `${sign}$${scaledNumber.format(scaledValue)} ${label}`
}

export function formatExactInterestAmount(value: number): string {
  return usd.format(value)
}
