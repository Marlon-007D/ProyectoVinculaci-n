export const toCents = (value: number): number => Math.round(value * 100);
export const sumMoney = (values: number[]): number => values.reduce((total, value) => total + toCents(value), 0) / 100;
export const remainingMoney = (budget: number, spent: number): number => (toCents(budget) - toCents(spent)) / 100;
export const isMoney = (value: number): boolean => Number.isFinite(value) && value >= 0
  && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;
