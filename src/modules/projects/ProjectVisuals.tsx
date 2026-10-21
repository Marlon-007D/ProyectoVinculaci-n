import {moduleClass} from './projectStyles';
import type { ReactNode } from 'react';
import { ArrowDownLeft, ChartNoAxesCombined, FolderKanban, Wallet } from 'lucide-react';
import { executionPercent, remainingMoney } from './projectValidation';
import { formatMoney } from './projectPresentation';
export function ProjectMetrics({ count, budget, spent, available = true, caption = 'proyectos registrados' }: {
    count: number;
    budget: number;
    spent: number;
    available?: boolean;
    caption?: string;
}) {
    const items = [{ label: 'Proyectos', value: String(count), hint: caption, Icon: FolderKanban }, { label: 'Presupuesto aprobado', value: formatMoney(budget), hint: 'Suma de los presupuestos', Icon: Wallet }, { label: 'Gastos registrados', value: formatMoney(spent), hint: 'Ejecución financiera', Icon: ArrowDownLeft }, { label: 'Saldo por ejecutar', value: formatMoney(remainingMoney(budget, spent)), hint: 'Presupuesto menos gastos', Icon: ChartNoAxesCombined }];
    return <dl className={moduleClass("project-metrics")}>{items.map(({ label, value, hint, Icon }) => <div key={label}><dt><span>{label}</span><Icon size={18} aria-hidden="true"/></dt><dd>{available ? value : '—'}</dd><p>{available ? hint : 'Información pendiente'}</p></div>)}</dl>;
}
export function FinancialProgress({ budget, spent, compact = false }: {
    budget: number;
    spent: number;
    compact?: boolean;
}) {
    const percent = executionPercent(budget, spent);
    const label = budget > 0 ? `${new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 }).format(percent)} %` : 'Sin presupuesto';
    return <div className={moduleClass(`project-financial-progress ${compact ? 'is-compact' : ''}`)}><div><span>Ejecución financiera</span><strong>{label}</strong></div>
    {budget > 0 ? <progress max={100} value={Math.max(0, Math.min(100, percent))} aria-label="Presupuesto ejecutado" aria-valuetext={`${label} del presupuesto aprobado`}/> : <div className={moduleClass("project-progress-empty")} aria-hidden="true"/>}
    {!compact && <p>Representa el gasto registrado, no el avance de las actividades.</p>}
  </div>;
}
export function ProjectBadge({ active }: {
    active: boolean;
}) { return <span className={moduleClass(`project-badge ${active ? 'is-active' : 'is-closed'}`)}><span aria-hidden="true"/>{active ? 'En ejecución' : 'Cerrado'}</span>; }
export function ProjectEmpty({ title, children, action }: {
    title: string;
    children: ReactNode;
    action?: ReactNode;
}) { return <div className={moduleClass("project-empty-state")}><span className={moduleClass("project-empty-icon")}><FolderKanban size={28} aria-hidden="true"/></span><h2>{title}</h2><p>{children}</p>{action}</div>; }
export function ProjectLoading({ label = 'Cargando proyectos…' }: {
    label?: string;
}) { return <div className={moduleClass("project-loading")} role="status"><span className={moduleClass("project-loading-dot")} aria-hidden="true"/>{label}</div>; }
