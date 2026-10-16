import { useState } from 'react';
import type { Project } from './types';
import { sumMoney } from './projectValidation';
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
  return <section className="my-6 rounded border p-4">
    <h3 className="font-bold">Movimientos por fecha y rubro</h3>
    <div className="my-3 flex flex-wrap gap-4">
      <label>Desde <input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label>Hasta <input type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      <label>Rubro <select value={itemId} onChange={e => setItemId(e.target.value)}><option value="">Todos</option>{project.budget_items?.map(item => <option key={item.budget_item_id} value={item.budget_item_id}>{item.name}</option>)}</select></label>
    </div>
    {invalid ? <p role="alert">La fecha final debe ser posterior o igual a la inicial.</p> : <>
      <p>Total del período: <strong>${sumMoney(rows.map(row => row.amount)).toFixed(2)}</strong>. {rows.length} movimientos.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th>Fecha</th><th>Rubro</th><th>Concepto</th><th>USD</th></tr></thead><tbody>{rows.map(row => <tr key={row.expense_id}><td>{row.date}</td><td>{row.item}</td><td>{row.description}</td><td>{row.amount.toFixed(2)}</td></tr>)}</tbody></table></div>
      <button type="button" className="mt-3 rounded bg-blue-700 px-4 py-2 text-white" onClick={download}>Descargar informe CSV</button>
      <p className="mt-2 text-xs">Informe interno. El saldo global incluye todos los movimientos, independientemente del filtro.</p>
    </>}
  </section>;
}
