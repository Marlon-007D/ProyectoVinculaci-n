const dateFormatter = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium' })
export function formatDate(value: Date | string): string { return dateFormatter.format(value instanceof Date ? value : new Date(value)) }
