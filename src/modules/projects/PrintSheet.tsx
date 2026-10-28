import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { InstitutionBrand } from './institutionBrand';
import { formatMoney, formatNumericDate, formatPercent, plural } from './projectPresentation';
import { remainingMoney, sumMoney, executionPercent } from './projectValidation';
import type { Project } from './types';
import { buildReportModel, filterSummary, reportPeriod, type ReportFilters, type ReportModel } from './reportData';
import { isOverdue, projectPeriod, type PublicProjectRow } from './publicTransparency';
import css from './PrintSheet.module.css';

/** «27 de octubre de 2026», Ecuador time. */
export const issueDate = (now = new Date()) => new Intl.DateTimeFormat('es-EC', { dateStyle: 'long', timeZone: 'America/Guayaquil' }).format(now);

/**
 * Mounts the printable sheet, names the document (the PDF file name), waits for the logo and calls print().
 * The title and the sheet are restored when the print dialog closes.
 */
export function usePrintJob() {
  const [job, setJob] = useState<{ title: string } | null>(null);
  useEffect(() => {
    if (!job) return;
    const previous = document.title;
    let cancelled = false;
    const finish = () => { document.title = previous; setJob(null); };
    document.title = job.title;
    window.addEventListener('afterprint', finish, { once: true });
    const images = [...document.querySelectorAll<HTMLImageElement>('[data-print-sheet] img')];
    const loaded = Promise.all(images.map(image => image.complete ? undefined : new Promise<void>(resolve => { image.onload = image.onerror = () => resolve(); })));
    void Promise.race([loaded, new Promise(resolve => setTimeout(resolve, 2500))]).then(() => { if (!cancelled) requestAnimationFrame(() => window.print()); });
    return () => { cancelled = true; window.removeEventListener('afterprint', finish); document.title = previous; };
  }, [job]);
  return { printing: job !== null, print: (title: string) => setJob({ title }) };
}

interface SheetProps { brand: InstitutionBrand; title: string; subtitle?: string; issuedOn: string; children: ReactNode }

function Sheet({ brand, title, subtitle, issuedOn, children }: SheetProps) {
  return createPortal(<div className={css.sheet} data-print-sheet style={{ '--print-accent': brand.color } as CSSProperties}>
    <header className={css.header}>
      {brand.logoUrl ? <img className={css.logo} src={brand.logoUrl} alt="" /> : <span className={css.initials} aria-hidden="true">{brand.initials}</span>}
      <div className={css.titles}>
        <p className={css.institution}>{brand.name}</p>
        <h1 className={css.title}>{title}</h1>
        {subtitle && <p className={css.subtitle}>{subtitle}</p>}
      </div>
      <p className={css.issued}>Fecha de emisión<br /><strong>{issuedOn}</strong></p>
    </header>
    {children}
  </div>, document.body);
}

function Summary({ items }: { items: Array<[string, string]> }) {
  return <dl className={css.summary}>{items.map(([label, value]) => <div className={css.box} key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

export interface PublicFilters { search: string; statusLabel: string; sortLabel: string }

/** Printable transparency report: one row per published project with totals. */
export function TransparencyPrintSheet({ brand, rows, filters, issuedOn }: { brand: InstitutionBrand; rows: PublicProjectRow[]; filters: PublicFilters | null; issuedOn: string }) {
  const budget = sumMoney(rows.map(row => row.total_budget));
  const spent = sumMoney(rows.map(row => row.spent));
  return <Sheet brand={brand} title="Informe de transparencia de proyectos" issuedOn={issuedOn}>
    <Summary items={[['Presupuesto publicado', formatMoney(budget)], ['Ejecutado', formatMoney(spent)], ['Saldo', formatMoney(remainingMoney(budget, spent))], ['Ejecución', formatPercent(executionPercent(budget, spent))]]} />
    {filters && <p className={css.filters}><strong>Filtros aplicados:</strong> {filters.search ? `Búsqueda: «${filters.search}»` : 'Búsqueda: ninguna'} · Estado: {filters.statusLabel} · Orden: {filters.sortLabel}</p>}
    <section className={css.section}>
      <h2>{plural(rows.length, 'proyecto publicado', 'proyectos publicados')}</h2>
      <table className={css.table}>
        <thead><tr><th>Proyecto</th><th>Objetivos</th><th>Estado</th><th className={css.num}>Presupuesto</th><th className={css.num}>Ejecutado</th><th className={css.num}>Saldo</th><th className={css.num}>Ejec. %</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.project_id}>
          <td><strong>{row.title}</strong>{projectPeriod(row) && <span className={css.subtle}>{projectPeriod(row)}</span>}</td><td>{row.description || '—'}</td><td className={css.nowrap}>{row.is_active ? 'En ejecución' : 'Cerrado'}{isOverdue(row) && <span className={css.subtle}>Plazo vencido</span>}</td>
          <td className={css.num}>{formatMoney(row.total_budget)}</td><td className={css.num}>{formatMoney(row.spent)}</td><td className={css.num}>{formatMoney(row.balance)}</td><td className={css.num}>{formatPercent(executionPercent(row.total_budget, row.spent))}</td>
        </tr>)}</tbody>
        <tfoot><tr className={css.total}><th colSpan={3}>Totales</th><td className={css.num}>{formatMoney(budget)}</td><td className={css.num}>{formatMoney(spent)}</td><td className={css.num}>{formatMoney(remainingMoney(budget, spent))}</td><td className={css.num}>{formatPercent(executionPercent(budget, spent))}</td></tr></tfoot>
      </table>
    </section>
    <p className={css.note}>Los participantes, movimientos detallados y comprobantes permanecen en la gestión privada.</p>
  </Sheet>;
}

interface ProjectSheetProps { brand: InstitutionBrand; project: Project; filters: ReportFilters; model?: ReportModel; issuedBy: string; issuedOn: string }

/** Printable financial report of one project: summary, per-rubro table, movements and signature boxes. */
export function ProjectPrintSheet({ brand, project, filters, model = buildReportModel(project, filters), issuedBy, issuedOn }: ProjectSheetProps) {
  const spent = sumMoney(project.budget_items.map(item => item.spent_amount));
  return <Sheet brand={brand} title="Informe financiero del proyecto" subtitle={project.name} issuedOn={issuedOn}>
    <dl className={css.details}>
      <div><dt>Proyecto</dt><dd>{project.name}</dd></div>
      <div><dt>Período</dt><dd>{reportPeriod(project)}</dd></div>
      <div><dt>Generado por</dt><dd>{issuedBy}</dd></div>
      <div><dt>Estado</dt><dd>{project.is_active ? 'En ejecución' : 'Cerrado'}</dd></div>
    </dl>
    <Summary items={[['Presupuesto aprobado', formatMoney(project.budget_total)], ['Ejecutado', formatMoney(spent)], ['Saldo', formatMoney(remainingMoney(project.budget_total, spent))], ['Ejecución', formatPercent(executionPercent(project.budget_total, spent))]]} />
    <p className={css.filters}><strong>Filtros aplicados:</strong> {filterSummary(project, filters)}</p>
    <section className={css.section}>
      <h2>Resumen por rubro</h2>
      {model.items.length ? <table className={css.table}>
        <thead><tr><th>Rubro</th><th className={css.num}>Asignado</th><th className={css.num}>Ejecutado</th><th className={css.num}>Saldo</th><th className={css.num}>Ejec. %</th></tr></thead>
        <tbody>{model.items.map(item => <tr key={item.id}><td>{item.name}</td><td className={css.num}>{formatMoney(item.allocated)}</td><td className={css.num}>{formatMoney(item.spent)}</td><td className={css.num}>{formatMoney(item.balance)}</td><td className={css.num}>{formatPercent(item.percent)}</td></tr>)}</tbody>
        <tfoot><tr className={css.total}><th>Totales</th><td className={css.num}>{formatMoney(model.totals.allocated)}</td><td className={css.num}>{formatMoney(model.totals.spent)}</td><td className={css.num}>{formatMoney(model.totals.balance)}</td><td className={css.num}>{formatPercent(model.totals.percent)}</td></tr></tfoot>
      </table> : <p className={css.empty}>El proyecto todavía no tiene rubros.</p>}
    </section>
    <section className={css.section}>
      <h2>Detalle de movimientos</h2>
      {model.movements.length ? <table className={css.table}>
        <thead><tr><th>Fecha</th><th>Rubro</th><th>Concepto</th><th className={css.num}>Importe</th></tr></thead>
        <tbody>{model.movements.map(row => <tr key={row.id}><td className={css.nowrap}>{formatNumericDate(row.date)}</td><td>{row.item}</td><td>{row.description}</td><td className={css.num}>{formatMoney(row.amount)}</td></tr>)}</tbody>
        <tfoot><tr className={css.total}><th colSpan={3}>Total de {plural(model.movements.length, 'movimiento', 'movimientos')}</th><td className={css.num}>{formatMoney(model.movementsTotal)}</td></tr></tfoot>
      </table> : <p className={css.empty}>No hay gastos que coincidan con este período y rubro.</p>}
    </section>
    <p className={css.note}>Informe interno. El resumen por rubro muestra el acumulado a la fecha de emisión, independientemente del filtro de fechas.</p>
    <section className={css.signatures} aria-label="Firmas">
      {['Elaborado por', 'Revisado por', 'Aprobado por'].map(label => <div className={css.sign} key={label}>
        <h3>{label}</h3>
        <div className={css.signBody}><div className={css.line} /><div className={css.stamp}>Sello</div></div>
        <p className={css.caption}>Nombre, cargo y firma</p>
      </div>)}
    </section>
  </Sheet>;
}
