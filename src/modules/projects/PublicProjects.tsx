import {moduleClass} from './projectStyles';
import { useEffect, useState } from 'react';
import { Building2, Globe2, LayoutGrid, Link, Printer, RefreshCw, Search, ShieldCheck, Table2 } from 'lucide-react';
import { publicSupabase as supabase } from '../../core/supabase/publicClient';
import { sumMoney } from './projectValidation';
import { watchPortalUpdates } from '../site/services/portalUpdates';
import { filterProjectList, formatMoney } from './projectPresentation';
import { FinancialProgress, ProjectBadge, ProjectEmpty, ProjectLoading, ProjectMetrics } from './ProjectVisuals';
interface Summary {
    is_active: boolean;
    project_id: string;
    title: string;
    description: string;
    total_budget: number;
    spent: number;
    balance: number;
}
export function PublicProjects({ institutionSlug, institutionName }: { institutionSlug?: string; institutionName?: string }) {
    const slug = institutionSlug ?? '';
    const [revision, setRevision] = useState(0);
    const [refreshTick, setRefreshTick] = useState(0);
    useEffect(() => watchPortalUpdates(slug, () => setRefreshTick(value => value + 1)), [slug]);
    const [state, setState] = useState<{
        key: string;
        rows: Summary[];
        error: string;
        checkedAt: string;
    } | null>(null);
    const [query, setQuery] = useState('');
    const [status, setStatus] = useState('all');
    const [sort, setSort] = useState('name');
    const [view, setView] = useState<'cards' | 'table'>('cards');
    const [copyMessage, setCopyMessage] = useState('');
    const key = `${slug}:${revision}`;
    useEffect(() => {
        if (!slug)
            return;
        let active = true;
        void (async () => {
            try {
                const result = await supabase.rpc('project_public_summary', { institution_slug: slug });
                if (result.error)
                    throw result.error;
                const rows: Summary[] = (result.data ?? []).map((p: Summary) => ({ ...p, total_budget: Number(p.total_budget), spent: Number(p.spent), balance: Number(p.balance) }));
                if (rows.some(row => ![row.total_budget, row.spent, row.balance].every(Number.isFinite)))
                    throw new Error('Resumen inválido');
                if (active)
                    setState({ key, rows, error: '', checkedAt: new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(new Date()) });
            }
            catch {
                if (active)
                    setState({ key, rows: [], error: 'No se pudieron consultar los resúmenes aprobados. Comprueba la conexión y vuelve a intentarlo.', checkedAt: '' });
            }
        })();
        return () => { active = false; };
    }, [slug, key, refreshTick]);
    const current = state?.key === key ? state : null;
    const rows = current?.rows ?? [];
    const error = current?.error;
    const ready = Boolean(slug && current && !error);
    const name = institutionName;
    const total = sumMoney(rows.map(row => row.total_budget));
    const spent = sumMoney(rows.map(row => row.spent));
    const visible = filterProjectList(rows, p => ({ name: p.title, description: p.description, active: p.is_active, budget: p.total_budget, spent: p.spent, public: true }), { query, status, publication: 'all', sort });
    function clearFilters() { setQuery(''); setStatus('all'); setSort('name'); }
    async function copyLink() {
        try {
            const url = new URL('/proyectos', location.origin);
            url.searchParams.set('transparency', '1');
            url.searchParams.set('institution', slug);
            await navigator.clipboard.writeText(url.href);
            setCopyMessage('Enlace copiado. Puedes compartirlo con tu comunidad.');
        }
        catch {
            setCopyMessage('No se pudo copiar automáticamente. Puedes copiar la dirección de esta página.');
        }
    }
    return <div className={moduleClass("project-panel project-public")}>
    <header className={moduleClass("project-hero public-hero")}><div className={moduleClass("project-hero-copy")}><p className={moduleClass("project-eyebrow")}><Globe2 size={14} aria-hidden="true"/>TRANSPARENCIA INSTITUCIONAL</p><h1>Proyectos y recursos</h1><p>Consulta las iniciativas de tu colegio, su presupuesto y los recursos utilizados.</p><span className={moduleClass("public-trust")}><ShieldCheck size={16} aria-hidden="true"/>Resúmenes aprobados por la institución</span></div><div className={moduleClass("public-hero-symbol")} aria-hidden="true"><Building2 size={72} strokeWidth={1}/><span>PROYECTOS · RECURSOS · COMUNIDAD</span></div></header>
    <div className={moduleClass("public-institution-bar")}><div><Building2 size={20} aria-hidden="true"/><strong>{name ?? 'Transparencia de tu colegio'}</strong></div><button disabled={!slug || Boolean(slug && !current)} onClick={() => { setCopyMessage(''); setRevision(value => value + 1); }}><RefreshCw size={16} aria-hidden="true"/>Actualizar datos</button></div>
    {error && <div className={moduleClass("project-error")} role="alert"><strong>No pudimos cargar la información</strong><p>{error}</p><button onClick={() => setRevision(value => value + 1)}>Reintentar consulta</button></div>}
    {!slug && !error && <ProjectEmpty title="Explora los proyectos de tu institución">Abre Transparencia desde el portal de tu colegio para consultar sus proyectos publicados.</ProjectEmpty>}
    {slug && !current && !error && <ProjectLoading label="Consultando información pública…"/>}
    {ready && <>
      <div className={moduleClass("project-section-heading")}><div><p className={moduleClass("project-eyebrow")}>RESUMEN PÚBLICO</p><h2>Resumen de recursos</h2><p className={moduleClass("project-muted")}>Totales de todos los proyectos publicados, incluidos los cerrados.</p></div><div className={moduleClass("project-actions public-actions")}><button onClick={() => void copyLink()}><Link size={16} aria-hidden="true"/>Compartir</button><button disabled={!rows.length} onClick={() => window.print()}><Printer size={16} aria-hidden="true"/>Imprimir / PDF</button></div></div>
      {copyMessage && <p className={moduleClass("project-success")} role="status">{copyMessage}</p>}
      <ProjectMetrics count={rows.length} budget={total} spent={spent} caption="con resumen público"/>
      {rows.length > 0 && <div className={moduleClass("public-overview")}><div><span className={moduleClass("project-eyebrow")}>USO DEL PRESUPUESTO PUBLICADO</span><FinancialProgress budget={total} spent={spent}/></div><div className={moduleClass("public-overview-note")}><ShieldCheck size={22} aria-hidden="true"/><p><strong>{rows.filter(row => row.is_active).length} en ejecución · {rows.filter(row => !row.is_active).length} cerrados</strong><span>Consulta: {current?.checkedAt} (Ecuador continental).</span></p></div></div>}
      {!rows.length ? <ProjectEmpty title="Todavía no hay proyectos publicados">Los resúmenes aparecerán aquí cuando la institución apruebe su publicación.</ProjectEmpty> : <>
        <div className={moduleClass("project-section-heading")}><div><h2>Iniciativas de la comunidad</h2><p className={moduleClass("project-muted")}>Busca una iniciativa o compara su ejecución financiera.</p></div><div className={moduleClass("project-view-switch")} role="group" aria-label="Presentación de proyectos"><button aria-label="Ver tarjetas" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><LayoutGrid size={18}/></button><button aria-label="Ver tabla comparativa" aria-pressed={view === 'table'} onClick={() => setView('table')}><Table2 size={18}/></button></div></div>
        <div className={moduleClass("project-filters public-filters")}><label className={moduleClass("project-search")}>Buscar proyecto<div><Search size={17} aria-hidden="true"/><input type="search" placeholder="Nombre u objetivo…" value={query} onChange={e => setQuery(e.target.value)}/></div></label><label>Estado<select value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos los estados</option><option value="active">En ejecución</option><option value="closed">Cerrados</option></select></label><label>Ordenar por<select value={sort} onChange={e => setSort(e.target.value)}><option value="name">Nombre A–Z</option><option value="budget">Mayor presupuesto</option><option value="spent">Mayor gasto</option></select></label></div>
        <div className={moduleClass("project-results")}><span role="status">{visible.length} de {rows.length} proyectos publicados</span>{(query || status !== 'all' || sort !== 'name') && <button className={moduleClass("project-text-button")} onClick={clearFilters}>Limpiar filtros</button>}</div>
        {!visible.length ? <ProjectEmpty title="No hay coincidencias" action={<button onClick={clearFilters}>Ver todos los proyectos</button>}>Cambia el texto de búsqueda o selecciona otro estado.</ProjectEmpty> : view === 'cards' ? <div className={moduleClass("project-grid project-list-grid")}>{visible.map(row => <article className={moduleClass("project-card project-public-card")} key={row.project_id}><div className={moduleClass("project-card-top")}><ProjectBadge active={row.is_active}/><span className={moduleClass("project-visibility")}><ShieldCheck size={14} aria-hidden="true"/>Aprobado</span></div><h3>{row.title}</h3><details className={moduleClass("project-objective")}><summary>Objetivo del proyecto</summary><p>{row.description || 'La institución no ha registrado una descripción.'}</p></details><dl className={moduleClass("project-public-totals")}><div><dt>Presupuesto</dt><dd>{formatMoney(row.total_budget)}</dd></div><div><dt>Gastos</dt><dd>{formatMoney(row.spent)}</dd></div><div><dt>Saldo</dt><dd>{formatMoney(row.balance)}</dd></div></dl><FinancialProgress budget={row.total_budget} spent={row.spent} compact/></article>)}</div> : <div className={moduleClass("project-table public-comparison")} role="region" aria-label="Comparación financiera de proyectos" tabIndex={0}><table><caption>Proyectos publicados · {name ?? slug} · {visible.length} de {rows.length} resultados.</caption><thead><tr><th scope="col">Proyecto</th><th scope="col">Estado</th><th scope="col">Presupuesto</th><th scope="col">Gastos</th><th scope="col">Saldo</th><th scope="col">Ejecución</th></tr></thead><tbody>{visible.map(row => <tr key={row.project_id}><th scope="row">{row.title}</th><td><ProjectBadge active={row.is_active}/></td><td>{formatMoney(row.total_budget)}</td><td>{formatMoney(row.spent)}</td><td>{formatMoney(row.balance)}</td><td><FinancialProgress budget={row.total_budget} spent={row.spent} compact/></td></tr>)}</tbody></table></div>}
        <p className={moduleClass("public-print-context")}>Vista de {visible.length} de {rows.length} proyectos. Estado: {status === 'all' ? 'todos' : status === 'active' ? 'en ejecución' : 'cerrados'}. Búsqueda: {query || 'sin filtro'}.</p>
      </>}
      <aside className={moduleClass("public-explainer")}><ShieldCheck size={24} aria-hidden="true"/><div><h2>Cómo leer esta información</h2><p><strong>Presupuesto:</strong> monto aprobado. <strong>Gastos:</strong> valores registrados. <strong>Saldo:</strong> presupuesto menos gastos; no representa el saldo bancario del colegio.</p><p>Los participantes, movimientos detallados y comprobantes permanecen en la gestión privada.</p></div></aside>
    </>}
  </div>;
}
