import {moduleClass} from './projectStyles';
import { useMemo, useRef, useState } from 'react';
import { createProjectService, projectError } from './projectService';
import { ecuadorToday, executionPercent, remainingMoney, sumMoney } from './projectValidation';
import { ExpenseFiles } from './ExpenseFiles';
import { ProjectReport } from './ProjectReport';
import { ProjectEditForm, type ProjectEditTarget } from './ProjectEditForm';
import type { MemberOption, Project } from './types';
import { ArrowLeft, CalendarDays, ChartNoAxesCombined, FolderOpen, Globe2, LockKeyhole, Plus, RefreshCw, Users, Wallet } from 'lucide-react';
import { FinancialProgress, ProjectBadge, ProjectEmpty } from './ProjectVisuals';
import { formatMoney, formatProjectDate } from './projectPresentation';
interface Props {
    project: Project;
    institutionName: string;
    canPublish: boolean;
    onBack: () => void;
    onProjectUpdate?: (p: Project) => void;
}
export function ProjectDetails({ project, institutionName, canPublish, onBack, onProjectUpdate }: Props) {
    const [current, setCurrent] = useState(project);
    const service = useMemo(() => createProjectService(current.institution_id, ecuadorToday, current.revision), [current.institution_id, current.revision]);
    const [tab, setTab] = useState('budget');
    const [busy, setBusy] = useState(false);
    const lock = useRef(false);
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [options, setOptions] = useState<MemberOption[]>([]);
    const [edit, setEdit] = useState<ProjectEditTarget | null>(null);
    const editPanel = useRef<HTMLDivElement>(null);
    function beginEdit(target: ProjectEditTarget) { setEdit(target); requestAnimationFrame(() => editPanel.current?.scrollIntoView({block:"start",behavior:"smooth"})); }
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [membersLoaded, setMembersLoaded] = useState(false);
    const memberRequest = useRef(false);
    const spent = sumMoney(current.budget_items.map(b => b.spent_amount));
    const allocated = sumMoney(current.budget_items.map(b => b.allocated_amount));
    async function run(action: () => Promise<unknown>, message = 'Cambios guardados.') {
        if (lock.current)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        setNotice('');
        let saved = false;
        try {
            await action();
            saved = true;
            const fresh = await service.getProject(current.id);
            setCurrent(fresh);
            onProjectUpdate?.(fresh);
            setNotice(message);
        }
        catch (e) {
            setError((saved ? 'La operación se confirmó, pero no se pudo actualizar la vista. Pulsa Actualizar antes de repetirla. ' : '') + projectError(e));
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function archive() {
        if (lock.current || !window.confirm('¿Archivar el proyecto? Se conservarán todos sus registros y podrás restaurarlo desde Archivados.')) return;
        lock.current=true; setBusy(true); setError('');
        try { await service.archiveProject(current.id); onBack(); }
        catch(cause) { setError(projectError(cause)); }
        finally { lock.current=false; setBusy(false); }
    }
    async function refresh() { if (lock.current)
        return; lock.current = true; setBusy(true); setError(''); try {
        const fresh = await service.getProject(current.id);
        setCurrent(fresh);
        onProjectUpdate?.(fresh);
    }
    catch (e) {
        setError(projectError(e));
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    function submit(event: React.FormEvent<HTMLFormElement>, action: (data: FormData) => Promise<unknown>) { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); void run(async () => { await action(data); form.reset(); }); }
    async function loadMembers() { if (memberRequest.current)
        return; memberRequest.current = true; setLoadingMembers(true); setError(''); try {
        setOptions(await service.getMemberOptions());
        setMembersLoaded(true);
    }
    catch (e) {
        setError(projectError(e));
    }
    finally {
        memberRequest.current = false;
        setLoadingMembers(false);
    } }
    return <fieldset disabled={busy} className={moduleClass("project-panel project-detail")}>
  <div className={moduleClass("project-detail-breadcrumb")}><button className={moduleClass("project-text-button")} onClick={onBack}><ArrowLeft size={17} aria-hidden="true"/>Todos los proyectos</button><span>{institutionName}</span><button onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true"/>{busy ? 'Actualizando…' : 'Actualizar'}</button></div>
  {error && <p role="alert" className={moduleClass("project-error")}>{error}</p>}{notice && <p role="status" className={moduleClass("project-success")}>{notice}</p>}
  <header className={moduleClass("project-detail-header")}><div className={moduleClass("project-card-top")}><ProjectBadge active={current.is_active}/><span className={moduleClass("project-visibility")}>{current.is_public ? <Globe2 size={15} aria-hidden="true"/> : <LockKeyhole size={15} aria-hidden="true"/>}{current.is_public ? 'Resumen publicado' : 'Gestión privada'}</span></div><h1>{current.name}</h1><p className={moduleClass("project-detail-objective")}>{current.description}</p><div className={moduleClass("project-detail-meta")}><span><CalendarDays size={16} aria-hidden="true"/>{formatProjectDate(current.start_date)} — {formatProjectDate(current.end_date)}</span><span><Users size={16} aria-hidden="true"/>{current.members.length} participantes</span><span><Wallet size={16} aria-hidden="true"/>{current.budget_items.length} rubros</span></div>
   <div className={moduleClass("project-detail-actions")}><button disabled={!current.is_active} onClick={() => beginEdit({kind:"project",project:current})}>Editar proyecto</button><button onClick={() => void archive()}>Archivar proyecto</button><button onClick={() => { if (window.confirm(current.is_active ? '¿Marcar el proyecto como cerrado? Se conservarán sus gastos y comprobantes.' : '¿Volver a marcar este proyecto como en ejecución?'))
        void run(() => service.setStatus(current.id, !current.is_active)); }}>{current.is_active ? 'Cerrar proyecto' : 'Reabrir proyecto'}</button>{canPublish && <button className={moduleClass("project-secondary")} onClick={() => { if (window.confirm(current.is_public ? '¿Retirar el resumen público?' : '¿Aprobar el nombre, objetivo y resumen financiero para publicación?'))
        void run(() => service.setPublication(current.id, !current.is_public)); }}><Globe2 size={16} aria-hidden="true"/>{current.is_public ? 'Retirar publicación' : 'Aprobar resumen público'}</button>}</div>
  </header>
  <div ref={editPanel}>{edit && <ProjectEditForm key={JSON.stringify([edit.kind,edit.project.revision,edit.kind === "budget" ? edit.item.budget_item_id : edit.kind === "expense" ? edit.expense.expense_id : edit.kind === "member" ? edit.member.project_member_id : current.id])} target={edit} onCancel={() => setEdit(null)} onSave={action => { void run(async () => { await action(); setEdit(null); }); }} />}</div>
  {!current.is_active && <p role="status">El proyecto está cerrado. Puedes consultar el informe o reabrirlo para realizar cambios.</p>}
  <div className={moduleClass("project-stats detail-stats")}><div><span>Presupuesto aprobado</span><strong>{formatMoney(current.budget_total)}</strong></div><div><span>Gastos registrados</span><strong>{formatMoney(spent)}</strong></div><div><span>Saldo por ejecutar</span><strong>{formatMoney(remainingMoney(current.budget_total, spent))}</strong></div><div><span>Pendiente de asignar a rubros</span><strong>{formatMoney(remainingMoney(current.budget_total, allocated))}</strong></div></div>
  <div className={moduleClass("project-detail-progress")}><FinancialProgress budget={current.budget_total} spent={spent}/></div>
  <nav aria-label="Gestión del proyecto" className={moduleClass("project-detail-tabs")}>{[{ id: 'budget', label: 'Rubros y gastos', Icon: Wallet }, { id: 'members', label: 'Equipo del proyecto', Icon: Users }, { id: 'report', label: 'Informe financiero', Icon: ChartNoAxesCombined }].map(({ id, label, Icon }) => <button key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setError(''); }}><Icon size={17} aria-hidden="true"/>{label}</button>)}</nav>
  {tab === 'budget' && <>
   <div className={moduleClass("project-section-heading")}><div><h2>Distribución del presupuesto</h2><p className={moduleClass("project-muted")}>Organiza los recursos por rubro y registra sus movimientos.</p></div><span>{current.budget_items.length} rubros</span></div>
   <details className={moduleClass("project-card project-create")}><summary><Plus size={18} aria-hidden="true"/><span>Añadir rubro<small>{formatMoney(remainingMoney(current.budget_total, allocated))} pendientes de asignación.</small></span></summary><form onSubmit={e => submit(e, d => service.addBudgetItem(current.id, String(d.get('name')), Number(d.get('amount'))))} className={moduleClass("project-form-grid")}><label>Nombre del rubro<input name="name" required maxLength={255} placeholder="Por ejemplo: Materiales e insumos"/></label><label>Asignación (USD)<input name="amount" type="number" min="0.01" step="0.01" required/></label><button type="submit" disabled={!current.is_active} className={moduleClass("project-primary")}>Guardar rubro</button></form></details>
   {current.budget_items.map((item, index) => <article className={moduleClass("project-card project-budget-card")} key={item.budget_item_id}><div className={moduleClass("project-budget-heading")}><span className={moduleClass("project-budget-number")}>{String(index + 1).padStart(2, '0')}</span><div><p className={moduleClass("project-eyebrow")}>RUBRO PRESUPUESTARIO</p><h3>{item.name}</h3></div><span className={moduleClass("project-count-label")}>{item.expenses.length} gastos</span></div><dl className={moduleClass("project-public-totals")}><div><dt>Asignado</dt><dd>{formatMoney(item.allocated_amount)}</dd></div><div><dt>Ejecutado</dt><dd>{formatMoney(item.spent_amount)}</dd></div><div><dt>Saldo del rubro</dt><dd>{formatMoney(remainingMoney(item.allocated_amount, item.spent_amount))}</dd></div></dl><FinancialProgress budget={item.allocated_amount} spent={item.spent_amount} compact/>
    <div className={moduleClass("project-toolbar")}><button disabled={!current.is_active} onClick={() => beginEdit({kind:"budget",project:current,item})}>Editar rubro</button><button disabled={!current.is_active || item.expenses.length > 0} onClick={() => { if (window.confirm('¿Retirar este rubro sin gastos vigentes? Su registro se conservará.'))
                void run(() => service.deleteBudgetItem(current.id, item.budget_item_id)); }}>Eliminar rubro</button></div>
    <details className={moduleClass("project-expense-form")}><summary>Registrar un gasto</summary><form className={moduleClass("project-form-grid")} onSubmit={e => submit(e, d => service.addExpense(item.budget_item_id, current.id, Number(d.get('amount')), String(d.get('description')), String(d.get('date'))))}><label>Concepto y referencia del comprobante<input name="description" required placeholder="Describe la compra o el servicio"/></label><label>Importe (USD)<input name="amount" type="number" min="0.01" step="0.01" required/></label><label>Fecha del gasto<input name="date" type="date" min={current.start_date} max={current.end_date < ecuadorToday() ? current.end_date : ecuadorToday()} required/></label><button type="submit" disabled={!current.is_active} className={moduleClass("project-primary")}>Registrar gasto</button></form></details>
    {item.expenses.length ? <div className={moduleClass("project-table")} role="region" aria-label={`Gastos de ${item.name}`} tabIndex={0}><table><caption>Movimientos de {item.name}</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Concepto</th><th scope="col">Importe</th><th scope="col">Respaldo privado</th><th scope="col">Acción</th></tr></thead><tbody>{item.expenses.map(exp => <tr key={exp.expense_id}><td className={moduleClass("project-nowrap")}>{formatProjectDate(exp.date)}</td><td>{exp.description}</td><td className={moduleClass("project-amount")}>{formatMoney(exp.amount)}</td><td><ExpenseFiles institutionId={current.institution_id} expenseId={exp.expense_id} readOnly={!current.is_active}/></td><td><button disabled={!current.is_active} aria-label={`Editar gasto ${exp.description}`} onClick={() => beginEdit({kind:"expense",project:current,expense:exp})}>Editar</button><button disabled={!current.is_active} className={moduleClass("project-danger-button")} aria-label={`Eliminar gasto ${exp.description}`} onClick={() => { if (window.confirm('¿Retirar este gasto del saldo ejecutado? Se conservarán su historial y comprobantes.'))
                void run(() => service.deleteExpense(item.budget_item_id, current.id, exp.expense_id)); }}>Eliminar</button></td></tr>)}</tbody></table></div> : <p className={moduleClass("project-inline-empty")}><FolderOpen size={18} aria-hidden="true"/>Este rubro todavía no tiene gastos registrados.</p>}
   </article>)}
   {!current.budget_items.length && <ProjectEmpty title="Distribuye los recursos del proyecto">Abre «Añadir rubro» para asignar presupuesto a materiales, servicios u otras necesidades del proyecto.</ProjectEmpty>}
  </>}
  {tab === 'members' && <section className={moduleClass("project-card")}><div className={moduleClass("project-section-heading")}><div><p className={moduleClass("project-eyebrow")}>PERSONAS Y RESPONSABILIDADES</p><h2>Equipo del proyecto</h2><p className={moduleClass("project-muted")}>Asigna responsabilidades a perfiles existentes de la institución.</p></div><span>{current.members.length} participantes</span></div><button disabled={loadingMembers} onClick={() => void loadMembers()}><Users size={16} aria-hidden="true"/>{loadingMembers ? 'Cargando perfiles…' : membersLoaded ? 'Actualizar perfiles' : 'Cargar perfiles institucionales'}</button>
   <form className={moduleClass("project-form-grid")} onSubmit={e => submit(e, d => service.addProjectMember(current.id, { profile_id: String(d.get('profile')), role: String(d.get('role')) }))}><label>Persona<select name="profile" required defaultValue=""><option value="" disabled>Selecciona un perfil existente</option>{options.filter(p => !current.members.some(m => m.profile_id === p.profile_id)).map(p => <option key={p.profile_id} value={p.profile_id}>{p.full_name} ({p.email})</option>)}</select></label><label>Responsabilidad<input name="role" required maxLength={100} list="project-member-roles"/><datalist id="project-member-roles">{[...new Set(current.members.map(member => member.role))].map(role => <option key={role} value={role}/>)}</datalist></label><button disabled={!current.is_active || !options.length}>Añadir participante</button></form>
   {membersLoaded && !options.length && <p className={moduleClass("project-inline-empty")}>No hay perfiles disponibles para añadir. Actualiza la lista si se asignan nuevos perfiles a la institución.</p>}
   {current.members.length ? <div className={moduleClass("project-team-grid")}>{current.members.map(m => <article className={moduleClass("project-member")} key={m.project_member_id}><span className={moduleClass("project-member-avatar")} aria-hidden="true">{m.full_name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'P'}</span><div><h3>{m.full_name}</h3><p>{m.role}</p><small>{m.email || 'Correo no visible'}</small></div><button disabled={!current.is_active} onClick={() => beginEdit({kind:"member",project:current,member:m})}>Editar responsabilidad</button><button className={moduleClass("project-text-button")} disabled={!current.is_active} aria-label={`Quitar a ${m.full_name}`} onClick={() => { if (window.confirm('¿Quitar este participante del proyecto?'))
            void run(() => service.removeProjectMember(current.id, m.project_member_id)); }}>Quitar</button></article>)}</div> : <ProjectEmpty title="El equipo está por formarse">Carga los perfiles institucionales y añade a cada participante con su responsabilidad.</ProjectEmpty>}
  </section>}
  {tab === 'report' && <section className={moduleClass("project-report project-card")}><h2>{institutionName} · {current.name}</h2><p>Período: {current.start_date} al {current.end_date}</p><p>Presupuesto: ${current.budget_total.toFixed(2)} · Ejecutado: ${spent.toFixed(2)} · Saldo: ${remainingMoney(current.budget_total, spent).toFixed(2)}</p><p>Ejecución financiera: {new Intl.NumberFormat('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(executionPercent(current.budget_total, spent))}%</p><ProjectReport project={current}/><button onClick={() => window.print()}>Imprimir / guardar PDF</button></section>}
 </fieldset>;
}
