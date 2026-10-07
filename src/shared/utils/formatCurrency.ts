const usd = new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' })
export function formatCurrency(value: number): string { return usd.format(value) }
