import { moduleClass } from './projectStyles';
import { useMemo, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Project } from './types';
import { ecuadorToday, executionPercent, remainingMoney, sumMoney } from './projectValidation';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { fileSlug, formatMoney, formatNumericDate, formatPercent, reportFileName, saveBlob } from './projectPresentation';
import { buildReportModel, filterSummary, movementsLabel, projectXlsxSheets, reportPeriod } from './reportData';
import { buildXlsx, XLSX_MIME } from './xlsxWriter';
import { loadInstitutionBrand, type InstitutionBrand } from './institutionBrand';
import { issueDate, ProjectPrintSheet, usePrintJob } from './PrintSheet';
import { useAuth } from '../../core/AuthContext';
import { Field } from './FormField';
import { notify } from '../../shared/components/Toaster/notify';

/** «Nombre Apellido (correo)» when the account has a name, otherwise the email. */
export function userLabel(user: User | null): string {
  if (!user) return 'Usuario no identificado';
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const name = String(meta.full_name ?? meta.name ?? [meta.first_name, meta.last_name].filter(Boolean).join(' ')).trim();
  return name && user.email ? `${name} (${user.email})` : name || user.email || 'Usuario no identificado';
}

export function ProjectReport({ project, institutionName }: { project: Project; institutionName: string }) {
  const { user } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [itemId, setItemId] = useState('');
  const [issuedOn, setIssuedOn] = useState('');
  const [brand, setBrand] = useState<InstitutionBrand | null>(null);
  const [preparing, setPreparing] = useState(false);
  const { printing, print } = usePrintJob();
  const filters = { from, to, itemId };
  const invalid = Boolean(from && to && from > to);
  const model = useMemo(() => buildReportModel(project, { from, to, itemId }), [project, from, to, itemId]);
  const spent = sumMoney(project.budget_items.map(item => item.spent_amount));
  const meta = () => ({ institution: institutionName, issuedBy: userLabel(user), issuedOn: issueDate() });
  const today = ecuadorToday();

  function downloadExcel() {
    saveBlob(reportFileName('Informe', project.name, 'xlsx', today), new Blob([buildXlsx(projectXlsxSheets(project, filters, meta(), model))], { type: XLSX_MIME }));
    notify.success('Informe descargado', { description: `${movementsLabel(model.movements.length)} en formato Excel.` });
  }
  async function downloadPdf() {
    setPreparing(true);
    setBrand(await loadInstitutionBrand({ id: project.institution_id, name: institutionName }));
    setPreparing(false);
    setIssuedOn(issueDate());
    print(`Informe_${fileSlug(project.name)}_${today}`);
  }

  return <section className={moduleClass('project-report-content')}>
    <div className={moduleClass('project-section-heading')}>
      <div className={moduleClass('project-report-heading')}><p className={moduleClass('project-eyebrow')}>INFORME FINANCIERO</p><h2>{project.name}</h2><p>{institutionName} · Período: {reportPeriod(project)}</p></div>
      <div className={moduleClass('project-report-actions')}>
        <button type="button" disabled={invalid} onClick={downloadExcel}><FileSpreadsheet size={16} aria-hidden="true" />Descargar Excel (.xlsx)</button>
        <button type="button" disabled={invalid || printing || preparing} onClick={() => void downloadPdf()}><FileText size={16} aria-hidden="true" />{preparing ? 'Preparando…' : 'Descargar informe (PDF)'}</button>
      </div>
    </div>
    <dl className={moduleClass('project-public-totals project-report-summary')}>
      <div><dt>Presupuesto</dt><dd>{formatMoney(project.budget_total)}</dd></div>
      <div><dt>Ejecutado</dt><dd>{formatMoney(spent)}</dd></div>
      <div><dt>Saldo</dt><dd>{formatMoney(remainingMoney(project.budget_total, spent))}</dd></div>
      <div><dt>Ejecución financiera</dt><dd>{formatPercent(executionPercent(project.budget_total, spent))}</dd></div>
    </dl>
    <div className={moduleClass('project-filters report-filters')}>
      <Field id="report-from" label="Desde"><input id="report-from" type="date" value={from} onChange={event => setFrom(event.target.value)} /></Field>
      <Field id="report-to" label="Hasta"><input id="report-to" type="date" value={to} onChange={event => setTo(event.target.value)} /></Field>
      <Field id="report-item" label="Rubro"><select id="report-item" value={itemId} onChange={event => setItemId(event.target.value)}><option value="">Todos</option>{project.budget_items.map(item => <option key={item.budget_item_id} value={item.budget_item_id}>{item.name}</option>)}</select></Field>
    </div>
    {(from || to || itemId) && <button type="button" className={moduleClass('project-text-button')} onClick={() => { setFrom(''); setTo(''); setItemId(''); }}>Restablecer filtros</button>}
    {invalid ? <p className={moduleClass('project-error')} role="alert">La fecha final debe ser posterior o igual a la inicial.</p> : <>
      <p className={moduleClass('project-muted')}>{filterSummary(project, filters)}.</p>
      <h3>Resumen por rubro</h3>
      {model.items.length ? <div className={moduleClass('project-table')} role="region" aria-label="Resumen por rubro" tabIndex={0}><table><thead><tr><th scope="col">Rubro</th><th scope="col">Asignado</th><th scope="col">Ejecutado</th><th scope="col">Saldo</th><th scope="col">Ejecución</th></tr></thead>
        <tbody>{model.items.map(item => <tr key={item.id}><td>{item.name}</td><td className={moduleClass('project-amount')}>{formatMoney(item.allocated)}</td><td className={moduleClass('project-amount')}>{formatMoney(item.spent)}</td><td className={moduleClass('project-amount')}>{formatMoney(item.balance)}</td><td className={moduleClass('project-amount')}>{formatPercent(item.percent)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row">Totales</th><td className={moduleClass('project-amount')}>{formatMoney(model.totals.allocated)}</td><td className={moduleClass('project-amount')}>{formatMoney(model.totals.spent)}</td><td className={moduleClass('project-amount')}>{formatMoney(model.totals.balance)}</td><td className={moduleClass('project-amount')}>{formatPercent(model.totals.percent)}</td></tr></tfoot></table></div>
        : <p className={moduleClass('project-inline-empty')}>El proyecto todavía no tiene rubros.</p>}
      <h3>Detalle de movimientos</h3>
      <div className={moduleClass('project-report-total')}><div><span>Total del período consultado</span><strong>{formatMoney(model.movementsTotal)}</strong></div><span>{movementsLabel(model.movements.length)}</span></div>
      {model.movements.length ? <div className={moduleClass('project-table')} role="region" aria-label="Movimientos del informe" tabIndex={0}><table><thead><tr><th scope="col">Fecha</th><th scope="col">Rubro</th><th scope="col">Concepto</th><th scope="col">Importe</th></tr></thead><tbody>{model.movements.map(row => <tr key={row.id}><td className={moduleClass('project-nowrap')}>{formatNumericDate(row.date)}</td><td>{row.item}</td><td>{row.description}</td><td className={moduleClass('project-amount')}>{formatMoney(row.amount)}</td></tr>)}</tbody></table></div> : <p className={moduleClass('project-inline-empty')}>No hay gastos que coincidan con este período y rubro.</p>}
      <p className={moduleClass('project-form-help')}>Informe interno. El resumen por rubro muestra el acumulado a la fecha, independientemente del filtro de fechas.</p>
    </>}
    {printing && brand && <ProjectPrintSheet brand={brand} project={project} filters={filters} model={model} issuedBy={userLabel(user)} issuedOn={issuedOn} />}
  </section>;
}
