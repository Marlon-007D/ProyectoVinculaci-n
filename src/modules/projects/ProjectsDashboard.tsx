import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Plus, RefreshCw, RotateCcw, Search, X } from 'lucide-react';
import type { Institution } from '../../core/TenantContext';
import { createProjectService, projectError } from './projectService';
import { ecuadorToday, projectDateWindow, sumMoney, remainingMoney, TEXT_LIMITS, type ProjectAcademicPeriod } from './projectValidation';
import { ProjectDetails } from './ProjectDetails';
import { ProjectFields } from './ProjectFields';
import { InstitutionSwitcher } from './InstitutionSwitcher';
import { Field, focusFirstInvalid, useFieldErrors } from './FormField';
import { validateProjectForm } from './projectForms';
import type { Project } from './types';
import { filterProjectList, formatMoney, formatProjectDate, plural } from './projectPresentation';
import styles from '../../features/feats/pages/AdminCourseCategoriesPage.module.css';
import local from './projects.module.css';
import { notify } from '../../shared/components/Toaster/notify';
import { confirmAction } from '../../shared/components/ConfirmDialog/confirm';

export function ProjectsDashboard({ institution }: { institution: Institution }) {
  const service = useMemo(() => createProjectService(institution.institution_id), [institution.institution_id]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<ProjectAcademicPeriod | null>(null);
  const [periodError, setPeriodError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [publication, setPublication] = useState('all');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('default');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const createErrors = useFieldErrors();
  const request = useRef(0);
  const loaded = useRef(false);
  const lock = useRef(false);
  const load = useCallback(async () => {
    const id = ++request.current;
    setLoading(true); setError(''); setPeriodError('');
    const [projectResult, periodResult] = await Promise.allSettled([service.getProjects(), service.getAcademicPeriod()]);
    if (id !== request.current) return;
    if (projectResult.status === 'fulfilled') setProjects(projectResult.value.data);
    else { const message = projectError(projectResult.reason); setProjects([]); setError(message); notify.error('No se pudo cargar la lista de proyectos', { id: 'projects-load', description: message }); }
    if (periodResult.status === 'fulfilled') setPeriod(periodResult.value);
    else { setPeriod(null); setPeriodError(projectError(periodResult.reason)); }
    loaded.current = true;
    setLoading(false);
  }, [service]);
  useEffect(() => { if (!loaded.current) void load(); return () => { request.current++; }; }, [load]);
  useEffect(() => { setPage(1); }, [search, status, publication, sort, pageSize]);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (lock.current) return;
    const form = event.currentTarget;
    const checked = validateProjectForm(new FormData(form), bounds ?? undefined);
    if (!checked.ok) { createErrors.setErrors(checked.errors); focusFirstInvalid(form); return; }
    createErrors.setErrors({});
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await service.createProject(checked.values);
      setProjects(old => [result.data, ...old]); setShowCreate(false); setSelected(result.data);
      notify.success('Proyecto creado', { description: result.data.name });
    } catch (cause) { const message = projectError(cause); setError(message); notify.error('No se pudo crear el proyecto', { description: message }); }
    finally { lock.current = false; setBusy(false); }
  }
  async function restore(project: Project) {
    if (lock.current || !await confirmAction({ title: `¿Restaurar «${project.name}»?`, message: 'Volverá a la lista de proyectos vigentes. Su resumen seguirá privado hasta que un administrador lo apruebe.', confirmLabel: 'Restaurar' })) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await service.restoreProject(project.id, project.revision);
      notify.success('Proyecto restaurado', { description: 'Su resumen sigue privado hasta que se apruebe su publicación.' });
      await load();
    }
    catch (cause) { const message = projectError(cause); setError(message); notify.error('No se pudo restaurar el proyecto', { description: message }); }
    finally { lock.current = false; setBusy(false); }
  }
  let bounds: { min: string; max: string } | null = null;
  let dateError = '';
  try { bounds = projectDateWindow(period, ecuadorToday()); } catch (cause) { dateError = projectError(cause); }
  const archived = status === 'archived';
  const collection = projects.filter(p => Boolean(p.deleted_at) === archived);
  const visible = filterProjectList(collection, p => ({ name: p.name, description: p.description, active: p.is_active, budget: p.budget_total, spent: sumMoney(p.budget_items.map(b => b.spent_amount)), public: p.is_public }), { query: search, status: archived ? 'all' : status, publication, sort });
  const pages = Math.max(1, Math.ceil(visible.length / pageSize));
  const currentPage = Math.min(page, pages);
  const rows = visible.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  if (selected) return <ProjectDetails project={selected} institutionName={institution.name} canPublish={['super_admin', 'institution_admin'].includes(institution.role)} onBack={() => { setSelected(null); void load(); }} onProjectUpdate={p => { setSelected(p); setProjects(old => old.map(item => item.id === p.id ? p : item)); }} />;
  return <section className={styles.page} aria-label="Proyectos de vinculación">
    <header className={styles.header}>
      <div><p className={styles.eyebrow}>{institution.name}</p><h1>Proyectos de vinculación</h1><p className={styles.intro}>Administra proyectos, rubros, gastos y participantes.</p></div>
      <div className={styles.headerActions}><button className={styles.secondaryButton} disabled={busy || loading} onClick={() => void load()}><RefreshCw size={17} />Actualizar</button><button className={styles.primaryButton} disabled={busy || loading} onClick={() => setShowCreate(true)}><Plus size={18} />Nuevo proyecto</button></div>
    </header>
    <InstitutionSwitcher confirmLeave={showCreate} />
    {error && <p className={local['project-error']} role="alert">{error}</p>}
    {showCreate && <section className={styles.formCard} aria-labelledby="new-project-title">
      <div className={styles.formHeading}><h2 id="new-project-title">Nuevo proyecto</h2><button className={styles.iconButton} disabled={busy} aria-label="Cerrar formulario" onClick={() => setShowCreate(false)}><X size={18} /></button></div>
      {period && <p className={styles.intro}>Período lectivo: {period.name} · {formatProjectDate(period.start_date)} al {formatProjectDate(period.end_date)}</p>}
      {(periodError || dateError) && <p role="alert">{periodError || dateError}</p>}
      <form noValidate onSubmit={create}><fieldset disabled={busy || loading || !bounds || Boolean(periodError)} className={local['project-fieldset']}>
        <ProjectFields min={bounds?.min} max={bounds?.max} errors={createErrors.errors} onEdit={createErrors.clear} />
        <div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={() => setShowCreate(false)}>Cancelar</button><button className={styles.primaryButton} type="submit">{busy ? 'Guardando…' : 'Crear proyecto'}</button></div>
      </fieldset></form>
    </section>}
    <section className={styles.listCard}>
      <div className={styles.listHeading}><div><h2>{archived ? 'Proyectos archivados' : 'Proyectos registrados'}</h2><p>{archived ? 'Los registros, gastos y comprobantes se conservan.' : 'Consulta y gestiona los proyectos de tu institución.'}</p></div></div>
      <div className={styles.filters}>
        <Field id="projects-search" label="Buscar proyecto" className={local['project-filter-search']}><span className={local['project-field-icon']}><Search size={18} aria-hidden="true" /><input id="projects-search" type="search" placeholder="Buscar por nombre u objetivo" value={search} maxLength={TEXT_LIMITS.search} onChange={e => setSearch(e.target.value)} /></span></Field>
        <Field id="projects-status" label="Estado" className={local['project-filter']}><select id="projects-status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Todos los vigentes</option><option value="active">En ejecución</option><option value="closed">Cerrados</option><option value="archived">Archivados</option></select></Field>
        <Field id="projects-visibility" label="Visibilidad" className={local['project-filter']}><select id="projects-visibility" value={publication} onChange={e => setPublication(e.target.value)}><option value="all">Todas</option><option value="public">Públicos</option><option value="private">Privados</option></select></Field>
        <Field id="projects-sort" label="Orden" className={local['project-filter']}><select id="projects-sort" value={sort} onChange={e => setSort(e.target.value)}><option value="default">Más recientes</option><option value="name">Nombre A–Z</option><option value="budget">Mayor presupuesto</option><option value="spent">Mayor gasto</option></select></Field>
      </div>
      <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Proyecto</th><th>Estado</th><th>Presupuesto</th><th>Gastos</th><th>Saldo</th><th>Acciones</th></tr></thead>
        <tbody>{loading ? <tr><td colSpan={6} className={styles.empty} role="status">Cargando proyectos…</td></tr> : rows.map(project => {
          const spent = sumMoney(project.budget_items.map(b => b.spent_amount));
          return <tr key={project.id}><td><strong className={styles.categoryName}>{project.name}</strong><span className={styles.categoryDescription}>{project.description}</span><small>{formatProjectDate(project.start_date)} — {formatProjectDate(project.end_date)}</small></td><td>{project.deleted_at ? 'Archivado' : project.is_active ? 'En ejecución' : 'Cerrado'}<br /><small>{project.is_public ? 'Público' : 'Privado'}</small></td><td>{formatMoney(project.budget_total)}</td><td>{formatMoney(spent)}</td><td>{formatMoney(remainingMoney(project.budget_total, spent))}</td><td><div className={styles.rowActions}>{archived ? <button className={styles.iconButton} title="Restaurar proyecto" aria-label={`Restaurar ${project.name}`} disabled={busy} onClick={() => void restore(project)}><RotateCcw size={18} /></button> : <button className={styles.iconButton} title="Gestionar proyecto" aria-label={`Gestionar ${project.name}`} onClick={() => setSelected(project)}><ArrowUpRight size={18} /></button>}</div></td></tr>;
        })}{!loading && !rows.length && <tr><td colSpan={6} className={styles.empty}>{error ? 'No se pudo cargar la lista.' : 'No hay proyectos que coincidan con los filtros.'}</td></tr>}</tbody>
      </table></div>
      <div className={styles.pagination}>
        <span role="status">{plural(visible.length, 'proyecto', 'proyectos')} · Página {currentPage} de {pages}</span>
        <div className={styles.pageControls}><label>Por página <select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>{[10, 20, 50].map(n => <option key={n}>{n}</option>)}</select></label><button className={styles.pageButton} aria-label="Página anterior" disabled={loading || currentPage <= 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={18} /></button><button className={styles.pageButton} aria-label="Página siguiente" disabled={loading || currentPage >= pages} onClick={() => setPage(currentPage + 1)}><ChevronRight size={18} /></button></div>
      </div>
    </section>
  </section>;
}
