import { useEffect, useState, type FormEvent } from 'react';
import { Building2, CalendarDays, ChevronLeft, ChevronRight, Clock3, FolderKanban, LayoutGrid, Link, RefreshCw, Search, ShieldCheck, Table2, X } from 'lucide-react';
import { publicSupabase } from '../../core/supabase/publicClient';
import { executionPercent } from './projectValidation';
import { formatMoney, formatPercent, plural } from './projectPresentation';
import { createTransparencySource, isOverdue, pageWindow, projectPeriod, type PublicInstitution, type PublicProjectRow, type TransparencyPage, type TransparencySort, type TransparencySource, type TransparencyStatus } from './publicTransparency';
import { notify } from '../../shared/components/Toaster/notify';
import { TransparencyReportActions } from './TransparencyReportActions';
import { NotifyBridge } from '../../shared/components/Toaster/NotifyBridge';
import styles from './PublicProjects.module.css';

const defaultSource = createTransparencySource(publicSupabase);
const pageSizes = [6, 9, 12, 24];
const sorts: Array<[TransparencySort, string]> = [['name', 'Nombre (A–Z)'], ['recent', 'Más recientes'], ['budget', 'Mayor presupuesto'], ['spent', 'Mayor gasto'], ['execution', 'Mayor ejecución']];
const statusLabels: Record<TransparencyStatus, string> = { all: 'Todos', active: 'En ejecución', closed: 'Cerrados' };

// One request per visible page; "loading" keeps the previous page on screen to avoid flicker.
type LoadState =
  | { status: 'loading'; previous: TransparencyPage | null }
  | { status: 'ready'; data: TransparencyPage; checkedAt: string }
  | { status: 'error'; message: string; previous: TransparencyPage | null };
type InstitutionState = { status: 'loading' } | { status: 'ready'; rows: PublicInstitution[] } | { status: 'error' };

const percentText = formatPercent;
const clampPercent = (value: number) => Math.max(0, Math.min(100, value));

/** Discreet note for projects still «En ejecución» after their end date. */
const OverdueNote = ({ row }: { row: PublicProjectRow }) => isOverdue(row) ? <span className={styles.overdue}>Plazo vencido</span> : null;

function ProjectCard({ row }: { row: PublicProjectRow }) {
  const percent = executionPercent(row.total_budget, row.spent);
  const period = projectPeriod(row);
  return <article className={styles.card}>
    <div className={styles.cardTop}>
      <span className={styles.status} data-status={row.is_active ? 'active' : 'closed'}>{row.is_active ? 'En ejecución' : 'Cerrado'}</span>
      <OverdueNote row={row} />
      <span className={styles.approved}><ShieldCheck size={14} aria-hidden="true" />Aprobado</span>
    </div>
    <h3>{row.title}</h3>
    {period && <p className={styles.period}><CalendarDays size={14} aria-hidden="true" />{period}</p>}
    <p className={styles.objective} title={row.description}>{row.description || 'La institución no registró un objetivo.'}</p>
    <dl className={styles.cardFigures}>
      <div><dt>Presupuesto</dt><dd>{formatMoney(row.total_budget)}</dd></div>
      <div><dt>Ejecutado</dt><dd>{formatMoney(row.spent)}</dd></div>
      <div><dt>Saldo</dt><dd>{formatMoney(row.balance)}</dd></div>
    </dl>
    <div className={styles.cardProgress}>
      <div className={styles.bar} role="img" aria-label={`Ejecución financiera: ${percentText(percent)}`}><span style={{ width: `${clampPercent(percent)}%` }} /></div>
      <span>{percentText(percent)} ejecutado</span>
    </div>
  </article>;
}

/**
 * Public transparency. Inside a portal page the page banner already names the section,
 * so the heading is only rendered for the standalone routes (`heading`, or no institution given).
 */
function PublicProjectsView({ institutionSlug, institutionName, heading = false, source = defaultSource }: { institutionSlug?: string; institutionName?: string; heading?: boolean; source?: TransparencySource } = {}) {
  const [slug, setSlug] = useState(() => institutionSlug ?? new URLSearchParams(location.search).get('institution') ?? '');
  const [institutions, setInstitutions] = useState<InstitutionState>({ status: 'loading' });
  const [draftSearch, setDraftSearch] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TransparencyStatus>('all');
  const [sort, setSort] = useState<TransparencySort>('name');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(9);
  const [view, setView] = useState<'cards' | 'table'>('cards');
  const [revision, setRevision] = useState(0);
  const [load, setLoad] = useState<{ key: string; state: LoadState } | null>(null);
  const key = JSON.stringify([slug, search, status, sort, page, pageSize, revision]);

  useEffect(() => {
    if (institutionSlug) { setInstitutions({ status: 'ready', rows: [{ slug: institutionSlug, name: institutionName ?? institutionSlug }] }); return; }
    let active = true;
    setInstitutions({ status: 'loading' });
    source.institutions().then(rows => { if (active) setInstitutions({ status: 'ready', rows }); }, () => { if (active) setInstitutions({ status: 'error' }); });
    return () => { active = false; };
  }, [institutionSlug, institutionName, revision, source]);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    setLoad(current => ({ key, state: { status: 'loading', previous: current?.state.status === 'ready' ? current.state.data : current?.state.status === 'loading' ? current.state.previous : null } }));
    source.page({ slug, search, status, sort, page, pageSize }).then(data => {
      if (active) setLoad({ key, state: { status: 'ready', data, checkedAt: new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guayaquil' }).format(new Date()) } });
    }, () => {
      if (active) setLoad(current => ({ key, state: { status: 'error', message: 'No se pudieron consultar los resúmenes aprobados. Comprueba la conexión y vuelve a intentarlo.', previous: current?.state.status === 'loading' ? current.state.previous : null } }));
    });
    return () => { active = false; };
    // The key encodes every query parameter, so it is the only trigger needed.
  }, [key, source]);

  const state = load?.key === key ? load.state : { status: 'loading' as const, previous: load?.state.status === 'ready' ? load.state.data : null };
  const data = state.status === 'ready' ? state.data : state.previous;
  const busy = state.status === 'loading';
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / pageSize));
  useEffect(() => { if (state.status === 'ready' && page > pages) setPage(pages); }, [state.status, page, pages]);

  const institutionList = institutions.status === 'ready' ? institutions.rows : [];
  const name = institutionList.find(item => item.slug === slug)?.name ?? institutionName;
  const summary = data?.summary;
  const overall = summary ? executionPercent(summary.budget, summary.spent) : 0;
  const filtered = Boolean(search || status !== 'all');
  const first = data && data.total ? (page - 1) * pageSize + 1 : 0;
  const last = data ? Math.min(data.total, page * pageSize) : 0;
  const showHeading = heading || !institutionSlug;

  function query(change: () => void) { change(); setPage(1); }
  function submitSearch(event: FormEvent<HTMLFormElement>) { event.preventDefault(); query(() => setSearch(draftSearch.trim())); }
  function clearFilters() { query(() => { setDraftSearch(''); setSearch(''); setStatus('all'); }); }
  function selectInstitution(next: string) {
    setSlug(next); clearFilters();
    const url = new URL(location.href); url.searchParams.set('transparency', '1');
    if (next) url.searchParams.set('institution', next); else url.searchParams.delete('institution');
    window.history.replaceState(window.history.state, '', url);
  }
  async function copyLink() {
    try {
      const url = new URL('/proyectos', location.origin);
      url.searchParams.set('transparency', '1');
      url.searchParams.set('institution', slug);
      await navigator.clipboard.writeText(url.href);
      notify.success('Enlace copiado', { description: 'Puedes compartirlo con tu comunidad.' });
    } catch {
      notify.warning('No se pudo copiar automáticamente', { description: 'Copia la dirección que aparece en tu navegador.' });
    }
  }
  const reportFilters = filtered ? { search, statusLabel: statusLabels[status], sortLabel: sorts.find(([value]) => value === sort)?.[1] ?? "" } : null;
  return <section className={styles.page} aria-label={showHeading ? undefined : 'Transparencia de proyectos'} aria-labelledby={showHeading ? 'transparency-title' : undefined}>
    <div className={styles.container}>
      {showHeading && <header className={styles.heading}>
        <p className={styles.eyebrow}>Transparencia institucional</p>
        <h1 id="transparency-title">{name ? `Proyectos de ${name}` : 'Proyectos de la institución'}</h1>
        <p>Consulta los proyectos aprobados para publicación y cómo se utilizan sus presupuestos.</p>
      </header>}

      {!institutionSlug && <div className={styles.institutionBar}>
        <span className={styles.institutionIcon}><Building2 size={20} aria-hidden="true" /></span>
        <label>Institución<select disabled={institutions.status !== 'ready'} value={slug} onChange={event => selectInstitution(event.target.value)}>
          <option value="">{institutions.status === 'loading' ? 'Cargando instituciones…' : 'Selecciona una institución'}</option>
          {institutionList.map(item => <option key={item.slug} value={item.slug}>{item.name}</option>)}
        </select></label>
        {institutions.status === 'error' && <p role="alert">No se pudo cargar la lista de instituciones.</p>}
      </div>}

      {state.status === 'error' && <div className={styles.alert} role="alert"><div><strong>No pudimos cargar la información</strong><p>{state.message}</p></div><button type="button" onClick={() => setRevision(value => value + 1)}><RefreshCw size={16} aria-hidden="true" />Reintentar</button></div>}

      {!slug ? <div className={styles.empty}><FolderKanban size={30} aria-hidden="true" /><h2>Explora los proyectos de tu institución</h2><p>Selecciona una institución para consultar presupuestos, gastos registrados y saldos de sus proyectos públicos.</p></div> : <>
        <div className={styles.summary}>
          <dl className={styles.figures} aria-busy={!summary}>
            <div><dt>Presupuesto publicado</dt><dd>{summary ? formatMoney(summary.budget) : '—'}</dd></div>
            <div><dt>Ejecutado</dt><dd>{summary ? formatMoney(summary.spent) : '—'}</dd></div>
            <div><dt>Saldo disponible</dt><dd>{summary ? formatMoney(summary.budget - summary.spent) : '—'}</dd></div>
            <div><dt>Ejecución general</dt><dd>{summary ? percentText(overall) : '—'}</dd><div className={styles.bar} aria-hidden="true"><span style={{ width: `${clampPercent(overall)}%` }} /></div></div>
          </dl>
          <p className={styles.summaryNote}>
            <span><ShieldCheck size={15} aria-hidden="true" />{summary ? `${plural(summary.count, 'proyecto publicado', 'proyectos publicados')} · ${summary.active} en ejecución · ${summary.closed} ${summary.closed === 1 ? 'cerrado' : 'cerrados'}` : 'Resúmenes aprobados por la institución'}</span>
            {state.status === 'ready' && <span><Clock3 size={15} aria-hidden="true" />Consulta: {state.checkedAt}</span>}
          </p>
        </div>

        <section className={styles.toolbar} aria-label="Buscar y filtrar proyectos">
          <form className={styles.search} role="search" onSubmit={submitSearch}>
            <div className={styles.searchField}>
              <Search size={18} aria-hidden="true" />
              <input type="search" aria-label="Buscar proyecto" maxLength={100} placeholder="Buscar por nombre u objetivo" value={draftSearch} onChange={event => setDraftSearch(event.target.value)} />
              {draftSearch && <button type="button" className={styles.clearSearch} aria-label="Borrar búsqueda" onClick={() => { setDraftSearch(''); if (search) query(() => setSearch('')); }}><X size={16} /></button>}
            </div>
            <button type="submit" className={styles.searchButton}>Buscar</button>
          </form>
          <div className={styles.filters}>
            <div className={styles.segmented} role="group" aria-label="Estado del proyecto">
              {(Object.keys(statusLabels) as TransparencyStatus[]).map(option => <button type="button" key={option} aria-pressed={status === option} onClick={() => query(() => setStatus(option))}>
                {statusLabels[option]}{summary && <span>{option === 'all' ? summary.count : option === 'active' ? summary.active : summary.closed}</span>}
              </button>)}
            </div>
            <label className={styles.sort}>Ordenar por<select value={sort} onChange={event => query(() => setSort(event.target.value as TransparencySort))}>{sorts.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <div className={styles.viewSwitch} role="group" aria-label="Presentación">
              <button type="button" aria-label="Ver tarjetas" aria-pressed={view === 'cards'} onClick={() => setView('cards')}><LayoutGrid size={17} /></button>
              <button type="button" aria-label="Ver tabla" aria-pressed={view === 'table'} onClick={() => setView('table')}><Table2 size={17} /></button>
            </div>
          </div>
        </section>

        <div className={styles.resultsBar}>
          <p role="status">{data ? (data.total ? `Mostrando ${first}–${last} de ${data.total} proyectos` : 'Sin resultados') : 'Consultando información pública…'}</p>
          {filtered && <div className={styles.activeFilters}>
            {search && <button type="button" onClick={() => query(() => { setSearch(''); setDraftSearch(''); })}>Búsqueda: «{search}»<X size={13} aria-hidden="true" /></button>}
            {status !== 'all' && <button type="button" onClick={() => query(() => setStatus('all'))}>{statusLabels[status]}<X size={13} aria-hidden="true" /></button>}
          </div>}
          <div className={styles.actions}>
            <button type="button" disabled={busy} onClick={() => setRevision(value => value + 1)}><RefreshCw size={15} aria-hidden="true" />Actualizar</button>
            <button type="button" onClick={() => void copyLink()}><Link size={15} aria-hidden="true" />Compartir</button>
            <TransparencyReportActions source={source} slug={slug} name={name ?? slug} query={{ slug, search, status, sort }} filters={reportFilters} disabled={!data?.rows.length} />
          </div>
        </div>

        <div className={styles.results} aria-busy={busy} data-busy={busy && Boolean(data)}>
          {!data ? <div className={styles.grid}>{Array.from({ length: 3 }, (_, index) => <div className={styles.skeleton} key={index} aria-hidden="true" />)}</div>
            : !data.total ? <div className={styles.empty}>
              <FolderKanban size={30} aria-hidden="true" />
              {filtered ? <><h2>No hay coincidencias</h2><p>Cambia el texto de búsqueda o el estado seleccionado.</p><button type="button" onClick={clearFilters}>Ver todos los proyectos</button></>
                : <><h2>Todavía no hay proyectos publicados</h2><p>Los resúmenes aparecerán aquí cuando la institución apruebe su publicación.</p></>}
            </div>
              : view === 'cards' ? <div className={styles.grid}>{data.rows.map(row => <ProjectCard key={row.project_id} row={row} />)}</div>
                : <div className={styles.tableWrap} role="region" aria-label="Comparación financiera de proyectos" tabIndex={0}><table>
                  <caption>Proyectos publicados · {name ?? slug}</caption>
                  <thead><tr><th scope="col">Proyecto</th><th scope="col">Estado</th><th scope="col">Período</th><th scope="col">Presupuesto</th><th scope="col">Ejecutado</th><th scope="col">Saldo</th><th scope="col">Ejecución</th></tr></thead>
                  <tbody>{data.rows.map(row => { const percent = executionPercent(row.total_budget, row.spent); return <tr key={row.project_id}>
                    <th scope="row">{row.title}</th><td><span className={styles.status} data-status={row.is_active ? 'active' : 'closed'}>{row.is_active ? 'En ejecución' : 'Cerrado'}</span><OverdueNote row={row} /></td>
                    <td>{projectPeriod(row) || '—'}</td><td>{formatMoney(row.total_budget)}</td><td>{formatMoney(row.spent)}</td><td>{formatMoney(row.balance)}</td>
                    <td><div className={styles.cellProgress}><div className={styles.bar}><span style={{ width: `${clampPercent(percent)}%` }} /></div>{percentText(percent)}</div></td>
                  </tr>; })}</tbody>
                </table></div>}
        </div>

        {data && data.total > 0 && <nav className={styles.pagination} aria-label="Paginación de proyectos">
          <label>Por página<select value={pageSize} onChange={event => query(() => setPageSize(Number(event.target.value)))}>{pageSizes.map(size => <option key={size} value={size}>{size}</option>)}</select></label>
          <div className={styles.pages}>
            <button type="button" disabled={busy || page <= 1} onClick={() => setPage(page - 1)} aria-label="Página anterior"><ChevronLeft size={17} /></button>
            {pageWindow(page, pages).map((item, index) => item === 'gap' ? <span key={`gap-${index}`} aria-hidden="true">…</span>
              : <button type="button" key={item} disabled={busy} aria-current={item === page ? 'page' : undefined} aria-label={`Página ${item}`} onClick={() => setPage(item)}>{item}</button>)}
            <button type="button" disabled={busy || page >= pages} onClick={() => setPage(page + 1)} aria-label="Página siguiente"><ChevronRight size={17} /></button>
          </div>
        </nav>}

        <aside className={styles.explainer} aria-labelledby="transparency-help">
          <h2 id="transparency-help">Cómo leer esta información</h2>
          <dl>
            <div><dt>Presupuesto</dt><dd>Monto aprobado para el proyecto.</dd></div>
            <div><dt>Ejecutado</dt><dd>Gastos registrados con su respaldo.</dd></div>
            <div><dt>Saldo</dt><dd>Presupuesto menos gastos; no es el saldo bancario de la institución.</dd></div>
          </dl>
          <p>Los participantes, los movimientos detallados y los comprobantes permanecen en la gestión privada.</p>
        </aside>
      </>}
    </div>
  </section>;
}

// The public portal mounts this outside ModuleBoundary; it connects notify() to the shared toast.
export function PublicProjects(props: Parameters<typeof PublicProjectsView>[0] = {}) {
  return <><PublicProjectsView {...props} /><NotifyBridge /></>;
}
