export const toCents = (value: number): number => Math.round(value * 100);
export const sumMoney = (values: number[]): number => values.reduce((total, value) => total + toCents(value), 0) / 100;
export const remainingMoney = (budget: number, spent: number): number => (toCents(budget) - toCents(spent)) / 100;
export const isMoney = (value: number): boolean => Number.isFinite(value) && value >= 0
  && Number.isSafeInteger(Math.round(value * 100))
  && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001;

export const MAX_STORED_MONEY = 9999999999.99;
export interface ProjectAcademicPeriod {
  academic_period_id:string; name:string; start_date:string; end_date:string;
}

export function ecuadorToday(now=new Date()):string {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Guayaquil',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
  const part=(type:string)=>parts.find(p=>p.type===type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function nextAnniversary(date:string):string {
  const year=Number(date.slice(0,4))+1;
  const candidate=`${year}${date.slice(4)}`;
  return isCalendarDate(candidate)?candidate:`${year}-02-28`;
}

export function projectDateWindow(period:ProjectAcademicPeriod|null,today=ecuadorToday()) {
  if(!period)return {min:today,max:nextAnniversary(today)};
  if(!isCalendarDate(period.start_date)||!isCalendarDate(period.end_date)||period.end_date<period.start_date)
    throw new Error('El período lectivo tiene fechas inválidas. Solicita su revisión al responsable académico.');
  if(period.end_date>nextAnniversary(period.start_date))
    throw new Error('El período configurado supera un año lectivo. Solicita su revisión al responsable académico.');
  const min=period.start_date>today?period.start_date:today;
  const anniversary=nextAnniversary(today);
  const max=period.end_date<anniversary?period.end_date:anniversary;
  if(min>max)throw new Error('No hay fechas disponibles en el período lectivo activo. Solicita que se revise el período de la institución.');
  return {min,max};
}

export function validateProjectDates(start:string,end:string,period?:ProjectAcademicPeriod,today=ecuadorToday()):void {
  if(!isCalendarDate(start)||!isCalendarDate(end))throw new Error('Introduce fechas de calendario válidas de inicio y finalización.');
  if(end<start)throw new Error('La fecha final no puede ser anterior al inicio.');
  if(start<today)throw new Error('La fecha de inicio debe ser hoy o posterior.');
  if(start>nextAnniversary(today)||end>nextAnniversary(today))throw new Error('El proyecto no puede programarse a más de un año desde hoy.');
  if(period){const bounds=projectDateWindow(period,today);if(start<bounds.min||end>bounds.max)throw new Error(`Las fechas deben quedar dentro del período lectivo: del ${bounds.min} al ${bounds.max}.`);}
}

export function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Round the exact cents ratio to two percentage decimals, including half cents. */
export function executionPercent(budget:number,spent:number):number {
  if(budget===0)return 0;
  const denominator=BigInt(toCents(budget));
  return Number((BigInt(toCents(spent))*10000n+denominator/2n)/denominator)/100;
}

/** Character limits shared by the forms, the service and the proposed database CHECK constraints. */
export const TEXT_LIMITS = { projectName: 120, budgetName: 120, expense: 150, role: 80, description: 1000, search: 100 } as const;

export type FieldResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** Trim, reject blank values and enforce the maximum length. */
export function validateText(raw: string, max: number): FieldResult<string> {
  const value = raw.trim();
  if (!raw.length) return { ok: false, message: 'Este campo es obligatorio.' };
  if (!value) return { ok: false, message: 'No puede quedar solo con espacios.' };
  if (value.length > max) return { ok: false, message: `Máximo ${max} caracteres (tienes ${value.length}).` };
  return { ok: true, value };
}

/** Accepts «350,20» or «350.20». One message per failure, shown under the field. */
export function parseMoneyInput(raw: string, { allowZero = false }: { allowZero?: boolean } = {}): FieldResult<number> {
  const text = raw.trim();
  if (!text) return { ok: false, message: 'Ingresa un monto.' };
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1).trim() : text;
  const match = /^(\d+)(?:[.,](\d*))?$/.exec(body);
  if (!match) return { ok: false, message: 'Ingresa solo números (ej. 350,20).' };
  if (negative && /[1-9]/.test(body)) return { ok: false, message: 'El monto no puede ser negativo.' };
  if ((match[2] ?? '').length > 2) return { ok: false, message: 'Ingresa un monto con máximo 2 decimales (ej. 350,20).' };
  const value = Number(`${match[1]}.${match[2] || '0'}`);
  if (value > MAX_STORED_MONEY) return { ok: false, message: 'El monto máximo es $9.999.999.999,99.' };
  if (value === 0 && !allowZero) return { ok: false, message: 'El monto debe ser mayor que $0,00.' };
  return { ok: true, value };
}

export const MAX_INTEGER_DIGITS = 10;
export type MoneyTrim = '' | 'decimals' | 'integers' | 'negative' | 'chars';
export const MONEY_TRIM_MESSAGES: Record<Exclude<MoneyTrim, ''>, string> = {
  decimals: 'Ingresa un monto con máximo 2 decimales (ej. 350,20).',
  integers: `El monto admite hasta ${MAX_INTEGER_DIGITS} dígitos enteros.`,
  negative: 'El monto no puede ser negativo.',
  chars: 'Ingresa solo números (ej. 350,20).',
};

/**
 * Cleans what is typed or pasted in an amount field: digits and one decimal separator, at most
 * 10 integer digits and 2 decimals. «1.234,50» or «1,234.50» keep the last separator as decimal.
 * `trimmed` names the first rule that removed characters, to explain it under the field.
 */
export function sanitizeMoneyInput(raw: string): { text: string; trimmed: MoneyTrim } {
  let trimmed: MoneyTrim = raw.includes('-') ? 'negative' : /[^\d.,\s-]/.test(raw) ? 'chars' : '';
  const kept = raw.replace(/[^\d.,]/g, '');
  const commas = (kept.match(/,/g) ?? []).length;
  const dots = (kept.match(/\./g) ?? []).length;
  // One kind repeated («1.234.567») is grouping; with both kinds the last one is the decimal separator.
  const decimalIndex = commas && dots ? Math.max(kept.lastIndexOf(','), kept.lastIndexOf('.'))
    : commas + dots === 1 ? kept.search(/[.,]/) : -1;
  const separator = decimalIndex >= 0 ? kept[decimalIndex] : '';
  let integer = (decimalIndex >= 0 ? kept.slice(0, decimalIndex) : kept).replace(/\D/g, '');
  let decimals = decimalIndex >= 0 ? kept.slice(decimalIndex + 1).replace(/\D/g, '') : '';
  integer = integer.replace(/^0+(?=\d)/, '');
  if (integer.length > MAX_INTEGER_DIGITS) { integer = integer.slice(0, MAX_INTEGER_DIGITS); trimmed ||= 'integers'; }
  if (decimals.length > 2) { decimals = decimals.slice(0, 2); trimmed ||= 'decimals'; }
  if (separator && !integer) integer = '0';
  return { text: separator ? `${integer}${separator}${decimals}` : integer, trimmed };
}
