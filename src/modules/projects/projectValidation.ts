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
