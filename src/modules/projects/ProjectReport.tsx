import { useState } from 'react';
import type { Project } from './types';
import { sumMoney } from './projectValidation';
import {Download,SlidersHorizontal} from 'lucide-react';
import {formatMoney,formatProjectDate} from './projectPresentation';
export function ProjectReport({ project }: { project: Project }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [itemId, setItemId] = useState('');
  const invalid = Boolean(from && to && from > to);
  const rows = (project.budget_items ?? []).filter(item => !itemId || item.budget_item_id === itemId)
    .flatMap(item => (item.expenses ?? []).map(expense => ({ ...expense, item: item.name })))
    .filter(expense => (!from || expense.date >= from) && (!to || expense.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date));
  function download() {
    const cell = (value: string) => `"${(/^[=+@\-\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
    const data = [['Proyecto','Rubro','Fecha','Concepto','USD'], ...rows.map(row => [project.name,row.item,row.date,row.description,row.amount.toFixed(2)])];
    const url = URL.createObjectURL(new Blob(['\ufeff' + data.map(row => row.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `informe-${project.id}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <section className="project-report-content">
    <div className="project-section-heading"><div><p className="project-eyebrow"><SlidersHorizontal size={14} aria-hidden="true"/>CONSULTA DE MOVIMIENTOS</p><h3>Informe de gastos</h3></div><button disabled={invalid||!rows.length} onClick={download}><Download size={16} aria-hidden="true"/>Descargar CSV</button></div>
    <div className="project-filters report-filters">
      <label>Desde <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label>Hasta <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      <label>Rubro <select value={itemId} onChange={e => setItemId(e.target.value)}><option value="">Todos</option>{project.budget_items?.map(item => <option key={item.budget_item_id} value={item.budget_item_id}>{item.name}</option>)}</select></label>
    </div>
    {(from||to||itemId)&&<button type="button" className="project-text-button" onClick={()=>{setFrom('');setTo('');setItemId('');}}>Restablecer filtros</button>}
    {invalid ? <p className="project-error" role="alert">La fecha final debe ser posterior o igual a la inicial.</p> : <>
      <div className="project-report-total"><div><span>Total del período consultado</span><strong>{formatMoney(sumMoney(rows.map(row=>row.amount)))}</strong></div><span>{rows.length} movimientos</span></div>
      <p className="project-muted">Desde: {from?formatProjectDate(from):'el inicio'} · Hasta: {to?formatProjectDate(to):'la última fecha registrada'} · Rubro: {project.budget_items.find(item=>item.budget_item_id===itemId)?.name??'todos'}.</p>
      {rows.length?<div className="project-table" role="region" aria-label="Movimientos del informe" tabIndex={0}><table><thead><tr><th scope="col">Fecha</th><th scope="col">Rubro</th><th scope="col">Concepto</th><th scope="col">Importe</th></tr></thead><tbody>{rows.map(row=><tr key={row.expense_id}><td className="project-nowrap">{formatProjectDate(row.date)}</td><td>{row.item}</td><td>{row.description}</td><td className="project-amount">{formatMoney(row.amount)}</td></tr>)}</tbody></table></div>:<p className="project-inline-empty">No hay gastos que coincidan con este período y rubro.</p>}
      <p className="project-form-help">Informe interno. El saldo global incluye todos los movimientos, independientemente del filtro.</p>
    </>}
  </section>;
}
