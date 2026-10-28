import type { Project } from './types';
import { executionPercent, remainingMoney, sumMoney } from './projectValidation';
import { formatNumericDate, formatProjectDate, plural } from './projectPresentation';
import type { XlsxCell, XlsxRow, XlsxSheet } from './xlsxWriter';

export interface ReportFilters { from: string; to: string; itemId: string }
export interface ReportMeta { institution: string; issuedBy: string; issuedOn: string }
export interface ReportItem { id: string; name: string; allocated: number; spent: number; balance: number; percent: number }
export interface ReportMovement { id: string; date: string; item: string; description: string; amount: number }
export interface ReportModel {
  items: ReportItem[];
  totals: { allocated: number; spent: number; balance: number; percent: number };
  movements: ReportMovement[];
  movementsTotal: number;
}

/** Movements follow the date/rubro filters; the per-rubro table is the accumulated position of each rubro. */
export function buildReportModel(project: Project, filters: ReportFilters): ReportModel {
  const selected = (project.budget_items ?? []).filter(item => !filters.itemId || item.budget_item_id === filters.itemId);
  const items = selected.map(item => ({
    id: item.budget_item_id, name: item.name, allocated: item.allocated_amount, spent: item.spent_amount,
    balance: remainingMoney(item.allocated_amount, item.spent_amount), percent: executionPercent(item.allocated_amount, item.spent_amount),
  }));
  const allocated = sumMoney(items.map(item => item.allocated));
  const spent = sumMoney(items.map(item => item.spent));
  const movements = selected
    .flatMap(item => (item.expenses ?? []).map(expense => ({ id: expense.expense_id, date: expense.date, item: item.name, description: expense.description, amount: expense.amount })))
    .filter(row => (!filters.from || row.date >= filters.from) && (!filters.to || row.date <= filters.to))
    .sort((a, b) => a.date.localeCompare(b.date));
  return {
    items,
    totals: { allocated, spent, balance: remainingMoney(allocated, spent), percent: executionPercent(allocated, spent) },
    movements,
    movementsTotal: sumMoney(movements.map(row => row.amount)),
  };
}

/** «Desde: el inicio · Hasta: la última fecha registrada · Rubro: todos». */
export function filterSummary(project: Project, filters: ReportFilters): string {
  const item = project.budget_items?.find(candidate => candidate.budget_item_id === filters.itemId)?.name ?? 'todos';
  return `Desde: ${filters.from ? formatProjectDate(filters.from) : 'el inicio'} · Hasta: ${filters.to ? formatProjectDate(filters.to) : 'la última fecha registrada'} · Rubro: ${item}`;
}

export const reportPeriod = (project: Project) => `${formatProjectDate(project.start_date)} al ${formatProjectDate(project.end_date)}`;
export const movementsLabel = (count: number) => plural(count, 'movimiento', 'movimientos');

const headerRow = (labels: string[]): XlsxRow => labels.map(value => ({ value, style: 'header' as const }));
const money = (value: number): XlsxCell => ({ value, style: 'money' });
const percent = (value: number): XlsxCell => ({ value: value / 100, style: 'percent' });

/** Sheets «Resumen por rubro» and «Movimientos»; totals are SUM formulas with their cached value. */
export function projectXlsxSheets(project: Project, filters: ReportFilters, meta: ReportMeta, model = buildReportModel(project, filters)): XlsxSheet[] {
  const first = 7; // rows 1-5 are the title and details, row 6 the header
  const last = first + model.items.length - 1;
  const total = last + 1;
  const sum = (column: string, from: number, to: number) => (to >= from ? `SUM(${column}${from}:${column}${to})` : '0');
  const summary: XlsxRow[] = [
    [{ value: 'Informe financiero del proyecto', style: 'title' }],
    [{ value: 'Institución', style: 'bold' }, meta.institution],
    [{ value: 'Proyecto', style: 'bold' }, project.name],
    [{ value: 'Período', style: 'bold' }, reportPeriod(project)],
    [{ value: 'Emitido', style: 'bold' }, `${meta.issuedOn} · ${meta.issuedBy}`],
    headerRow(['Rubro', 'Asignado', 'Ejecutado', 'Saldo', 'Ejecución']),
    ...model.items.map((item, index): XlsxRow => [item.name, money(item.allocated), money(item.spent),
      { value: item.balance, style: 'money', formula: `B${first + index}-C${first + index}` }, percent(item.percent)]),
    [{ value: 'Totales', style: 'bold' },
      { value: model.totals.allocated, style: 'moneyBold', formula: sum('B', first, last) },
      { value: model.totals.spent, style: 'moneyBold', formula: sum('C', first, last) },
      { value: model.totals.balance, style: 'moneyBold', formula: `B${total}-C${total}` },
      { value: model.totals.percent / 100, style: 'percent', formula: `IF(B${total}=0,0,C${total}/B${total})` }],
  ];
  const movementsFirst = 2;
  const movementsLast = movementsFirst + model.movements.length - 1;
  const movements: XlsxRow[] = [
    headerRow(['Fecha', 'Rubro', 'Concepto', 'Importe']),
    ...model.movements.map((row): XlsxRow => [formatNumericDate(row.date), row.item, row.description, money(row.amount)]),
    [{ value: 'Total', style: 'bold' }, null, null, { value: model.movementsTotal, style: 'moneyBold', formula: sum('D', movementsFirst, movementsLast) }],
  ];
  return [{ name: 'Resumen por rubro', rows: summary }, { name: 'Movimientos', rows: movements, freezeRows: 1 }];
}
