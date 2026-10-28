import { filterProjectList, formatProjectDate } from './projectPresentation';
import { ecuadorToday, executionPercent, isCalendarDate, sumMoney } from './projectValidation';
import type { XlsxRow, XlsxSheet } from './xlsxWriter';

export type TransparencyStatus = 'all' | 'active' | 'closed';
export type TransparencySort = 'name' | 'recent' | 'budget' | 'spent' | 'execution';
export interface TransparencyQuery { slug: string; search: string; status: TransparencyStatus; sort: TransparencySort; page: number; pageSize: number }
export interface PublicProjectRow { project_id: string; title: string; description: string; is_active: boolean; total_budget: number; spent: number; balance: number; start_date?: string | null; end_date?: string | null }
export interface TransparencySummary { count: number; budget: number; spent: number; active: number; closed: number }
export interface TransparencyPage { total: number; rows: PublicProjectRow[]; summary: TransparencySummary }
export interface PublicInstitution { name: string; slug: string }
/** Contract the public page depends on; the Supabase adapter below is injected by default. */
export interface TransparencySource {
  institutions(): Promise<PublicInstitution[]>;
  page(query: TransparencyQuery): Promise<TransparencyPage>;
}
type RpcClient = { rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: { code?: string } | null }> };

const money = (value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error('Resumen inválido');
  return number;
};
function row(value: Record<string, unknown>): PublicProjectRow {
  return {
    project_id: String(value.project_id), title: String(value.title ?? ''), description: String(value.description ?? ''),
    is_active: Boolean(value.is_active), total_budget: money(value.total_budget), spent: money(value.spent), balance: money(value.balance),
    start_date: typeof value.start_date === 'string' ? value.start_date : null, end_date: typeof value.end_date === 'string' ? value.end_date : null,
  };
}
const missingFunction = (error: { code?: string }) => error.code === 'PGRST202' || error.code === '42883';

/** Older databases only have the full summary; filter and page locally until the paginated SQL is applied. */
export function pageLocally(all: PublicProjectRow[], query: TransparencyQuery): TransparencyPage {
  const filtered = filterProjectList(all, p => ({ name: p.title, description: p.description, active: p.is_active, budget: p.total_budget, spent: p.spent, public: true }),
    { query: query.search, status: query.status, publication: 'all', sort: query.sort === 'execution' || query.sort === 'recent' ? 'default' : query.sort });
  const ordered = query.sort === 'execution'
    ? [...filtered].sort((a, b) => (b.total_budget ? b.spent / b.total_budget : 0) - (a.total_budget ? a.spent / a.total_budget : 0))
    : filtered;
  const start = (query.page - 1) * query.pageSize;
  return {
    total: ordered.length,
    rows: ordered.slice(start, start + query.pageSize),
    summary: { count: all.length, budget: sumMoney(all.map(p => p.total_budget)), spent: sumMoney(all.map(p => p.spent)), active: all.filter(p => p.is_active).length, closed: all.filter(p => !p.is_active).length },
  };
}

/** Page numbers to show: first, last and the neighbours of the current page, with gaps. */
export function pageWindow(current: number, pages: number): Array<number | 'gap'> {
  const wanted = [...new Set([1, pages, current - 1, current, current + 1])].filter(page => page >= 1 && page <= pages).sort((a, b) => a - b);
  return wanted.flatMap((page, index) => index && page - wanted[index - 1] > 1 ? ['gap' as const, page] : [page]);
}

/** Every row matching the query, read in server-sized pages, for the public Excel and PDF reports. */
export async function collectRows(source: TransparencySource, query: Omit<TransparencyQuery, 'page' | 'pageSize'>): Promise<PublicProjectRow[]> {
  const pageSize = 50;
  const rows: PublicProjectRow[] = [];
  for (let page = 1; ; page++) {
    const result = await source.page({ ...query, page, pageSize });
    rows.push(...result.rows);
    if (!result.rows.length || rows.length >= result.total) return rows;
  }
}

/** «28 oct 2026 – 31 oct 2026», or '' while the public function does not return both dates. */
export function projectPeriod(row: Pick<PublicProjectRow, 'start_date' | 'end_date'>): string {
  return row.start_date && row.end_date && isCalendarDate(row.start_date) && isCalendarDate(row.end_date)
    ? `${formatProjectDate(row.start_date)} – ${formatProjectDate(row.end_date)}` : '';
}

/** Still «En ejecución» after its end date (Ecuador time). Without an end date it is never overdue. */
export function isOverdue(row: Pick<PublicProjectRow, 'is_active' | 'end_date'>, today = ecuadorToday()): boolean {
  return row.is_active && Boolean(row.end_date && isCalendarDate(row.end_date) && row.end_date < today);
}

/** Status text for reports: «Cerrado», «En ejecución» or «En ejecución · Plazo vencido». */
export function publicStatus(row: Pick<PublicProjectRow, 'is_active' | 'end_date'>, today = ecuadorToday()): string {
  return !row.is_active ? 'Cerrado' : isOverdue(row, today) ? 'En ejecución · Plazo vencido' : 'En ejecución';
}

/** Sheets «Resumen» and «Proyectos» with the same published fields; totals are SUM formulas. */
/** Only the published summary fields; participants and receipts never reach this report. */
export function transparencyXlsxSheets(institution: string, rows: PublicProjectRow[], issuedOn: string, today = ecuadorToday()): XlsxSheet[] {
  const budget = sumMoney(rows.map(item => item.total_budget));
  const spent = sumMoney(rows.map(item => item.spent));
  const first = 2;
  const last = first + rows.length - 1;
  const total = last + 1;
  const sum = (column: string) => (rows.length ? `SUM(${column}${first}:${column}${last})` : '0');
  const head = (labels: string[]): XlsxRow => labels.map(value => ({ value, style: 'header' as const }));
  const summary: XlsxRow[] = [
    [{ value: 'Informe de transparencia de proyectos', style: 'title' }],
    [{ value: 'Institución', style: 'bold' }, institution],
    [{ value: 'Fecha de emisión', style: 'bold' }, issuedOn],
    [],
    head(['Indicador', 'Valor']),
    ['Proyectos publicados', rows.length],
    ['Presupuesto publicado', { value: budget, style: 'money' }],
    ['Ejecutado', { value: spent, style: 'money' }],
    ['Saldo', { value: sumMoney(rows.map(item => item.balance)), style: 'money' }],
    ['Ejecución', { value: executionPercent(budget, spent) / 100, style: 'percent' }],
  ];
  const projects: XlsxRow[] = [
    head(['Proyecto', 'Objetivo', 'Período', 'Estado', 'Presupuesto', 'Ejecutado', 'Saldo', 'Ejecución']),
    ...rows.map((item): XlsxRow => [item.title, item.description, projectPeriod(item), publicStatus(item, today),
      { value: item.total_budget, style: 'money' }, { value: item.spent, style: 'money' }, { value: item.balance, style: 'money' }, { value: executionPercent(item.total_budget, item.spent) / 100, style: 'percent' }]),
    [{ value: 'Totales', style: 'bold' }, null, null, null,
      { value: budget, style: 'moneyBold', formula: sum('E') }, { value: spent, style: 'moneyBold', formula: sum('F') },
      { value: sumMoney(rows.map(item => item.balance)), style: 'moneyBold', formula: sum('G') },
      { value: executionPercent(budget, spent) / 100, style: 'percent', formula: `IF(E${total}=0,0,F${total}/E${total})` }],
  ];
  return [{ name: 'Resumen', rows: summary, widths: [32, 40] }, { name: 'Proyectos', rows: projects, freezeRows: 1, widths: [34, 50, 27, 26, 16, 16, 16, 12] }];
}

export function createTransparencySource(client: RpcClient): TransparencySource {
  // Once the paginated function is known to be missing, go straight to the legacy summary.
  let paginated = true;
  async function legacyPage(query: TransparencyQuery) {
    const legacy = await client.rpc('project_public_summary', { institution_slug: query.slug });
    if (legacy.error) throw legacy.error;
    return pageLocally((Array.isArray(legacy.data) ? legacy.data : []).map(row), query);
  }
  return {
    async institutions() {
      const result = await client.rpc('project_public_institutions');
      if (result.error) throw result.error;
      return (Array.isArray(result.data) ? result.data : []) as PublicInstitution[];
    },
    async page(query) {
      if (!paginated) return legacyPage(query);
      const result = await client.rpc('project_public_page', {
        institution_slug: query.slug, search_text: query.search, status_filter: query.status,
        sort_key: query.sort, page_number: query.page, page_size: query.pageSize,
      });
      if (result.error && missingFunction(result.error)) {
        paginated = false;
        return legacyPage(query);
      }
      if (result.error) throw result.error;
      const data = (result.data ?? {}) as { total?: unknown; rows?: unknown; summary?: Record<string, unknown> };
      const summary = data.summary ?? {};
      return {
        total: money(data.total ?? 0),
        rows: (Array.isArray(data.rows) ? data.rows : []).map(item => row(item as Record<string, unknown>)),
        summary: { count: money(summary.count ?? 0), budget: money(summary.budget ?? 0), spent: money(summary.spent ?? 0), active: money(summary.active ?? 0), closed: money(summary.closed ?? 0) },
      };
    },
  };
}
