import {moduleClass} from './projectStyles';
import { useMemo, useRef, useState } from 'react';
import { createProjectService, projectError } from './projectService';
import { ecuadorToday, remainingMoney, sumMoney } from './projectValidation';
import { ExpenseFiles } from './ExpenseFiles';
import { ProjectReport } from './ProjectReport';
import { ProjectEditForm, type ProjectEditTarget } from './ProjectEditForm';
import type { MemberOption, Project } from './types';
import { ArrowLeft, CalendarDays, ChartNoAxesCombined, FolderOpen, Globe2, LockKeyhole, Plus, RefreshCw, Users, Wallet } from 'lucide-react';
import { FinancialProgress, ProjectBadge, ProjectEmpty } from './ProjectVisuals';
import { formatMoney, formatProjectDate, plural } from './projectPresentation';
import { AddBudgetItemForm, AddExpenseForm, AddMemberForm } from './BudgetForms';
import { InstitutionSwitcher } from './InstitutionSwitcher';
import { notify } from '../../shared/components/Toaster/notify';
import { confirmAction, type ConfirmOptions } from '../../shared/components/ConfirmDialog/confirm';
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
    const [options, setOptions] = useState<MemberOption[]>([]);
    const [edit, setEdit] = useState<ProjectEditTarget | null>(null);
    const editPanel = useRef<HTMLDivElement>(null);
    function beginEdit(target: ProjectEditTarget) { setEdit(target); requestAnimationFrame(() => editPanel.current?.scrollIntoView({block:"start",behavior:"smooth"})); }
    const [loadingMembers, setLoadingMembers] = useState(false);
    const [membersLoaded, setMembersLoaded] = useState(false);
    const memberRequest = useRef(false);
    const spent = sumMoney(current.budget_items.map(b => b.spent_amount));
    const allocated = sumMoney(current.budget_items.map(b => b.allocated_amount));
    function fail(title: string, cause: unknown) {
        const message = projectError(cause);
        setError(message);
        notify.error(title, { description: message });
    }
    async function run(action: () => Promise<unknown>, message = 'Cambios guardados') {
        if (lock.current)
            return;
        lock.current = true;
        setBusy(true);
        setError('');
        let saved = false;
        try {
            await action();
            saved = true;
            const fresh = await service.getProject(current.id);
            setCurrent(fresh);
            onProjectUpdate?.(fresh);
            notify.success(message);
        }
        catch (e) {
            if (saved) {
                setError('La operación se confirmó, pero no se pudo actualizar la vista. Pulsa Actualizar antes de repetirla. ' + projectError(e));
                notify.warning('Guardado, pero la vista no se actualizó', { description: 'Pulsa Actualizar antes de repetir la operación.' });
            }
            else fail('No se guardaron los cambios', e);
        }
        finally {
            lock.current = false;
            setBusy(false);
        }
    }
    async function confirmThen(options: ConfirmOptions, action: () => Promise<unknown>, message: string) {
        if (!lock.current && await confirmAction(options)) await run(action, message);
    }
    async function archive() {
        if (lock.current || !await confirmAction({ title: '¿Archivar este proyecto?', message: 'Se conservarán todos sus registros y podrás restaurarlo desde el filtro Archivados.', confirmLabel: 'Archivar', tone: 'danger' })) return;
        lock.current=true; setBusy(true); setError('');
        try { await service.archiveProject(current.id); notify.success('Proyecto archivado', { description: 'Puedes restaurarlo desde el filtro Archivados.' }); onBack(); }
        catch(cause) { fail('No se pudo archivar el proyecto', cause); }
        finally { lock.current=false; setBusy(false); }
    }
    async function refresh() { if (lock.current)
        return; lock.current = true; setBusy(true); setError(''); try {
        const fresh = await service.getProject(current.id);
        setCurrent(fresh);
        onProjectUpdate?.(fresh);
    }
    catch (e) {
        fail('No se pudo actualizar el proyecto', e);
    }
    finally {
        lock.current = false;
        setBusy(false);
    } }
    const save = (action: () => Promise<unknown>, message: string) => { void run(action, message); };
    async function loadMembers() { if (memberRequest.current)
        return; memberRequest.current = true; setLoadingMembers(true); setError(''); try {
        setOptions(await service.getMemberOptions());
        setMembersLoaded(true);
    }
    catch (e) {
        fail('No se pudieron cargar los perfiles', e);
    }
    finally {
        memberRequest.current = false;
        setLoadingMembers(false);
    } }
    return <fieldset disabled={busy} className={moduleClass("project-panel project-detail")}>
  <div className={moduleClass("project-detail-breadcrumb")}><button className={moduleClass("project-text-button")} onClick={onBack}><ArrowLeft size={17} aria-hidden="true"/>Todos los proyectos</button><InstitutionSwitcher confirmLeave={Boolean(edit)} showName /><button onClick={() => void refresh()}><RefreshCw size={16} aria-hidden="true"/>{busy ? 'Actualizando…' : 'Actualizar'}</button></div>
  {error && <p role="alert" className={moduleClass("project-error")}>{error}</p>}
  <header className={moduleClass("project-detail-header")}><div className={moduleClass("project-card-top")}><ProjectBadge active={current.is_active}/><span className={moduleClass("project-visibility")}>{current.is_public ? <Globe2 size={15} aria-hidden="true"/> : <LockKeyhole size={15} aria-hidden="true"/>}{current.is_public ? 'Resumen publicado' : 'Gestión privada'}</span></div><h1>{current.name}</h1><p className={moduleClass("project-detail-objective")}>{current.description}</p><div className={moduleClass("project-detail-meta")}><span><CalendarDays size={16} aria-hidden="true"/>{formatProjectDate(current.start_date)} — {formatProjectDate(current.end_date)}</span><span><Users size={16} aria-hidden="true"/>{plural(current.members.length, 'participante', 'participantes')}</span><span><Wallet size={16} aria-hidden="true"/>{plural(current.budget_items.length, 'rubro', 'rubros')}</span></div>
   <div className={moduleClass("project-detail-actions")}><button disabled={!current.is_active} onClick={() => beginEdit({kind:"project",project:current})}>Editar proyecto</button><button onClick={() => void archive()}>Archivar proyecto</button><button onClick={() => void confirmThen(current.is_active
        ? { title: '¿Cerrar el proyecto?', message: 'Se conservarán sus gastos y comprobantes. Para volver a modificarlo deberás reabrirlo.', confirmLabel: 'Cerrar proyecto' }
        : { title: '¿Reabrir el proyecto?', message: 'Volverá a estar en ejecución y se podrán registrar cambios.', confirmLabel: 'Reabrir' },
        () => service.setStatus(current.id, !current.is_active), current.is_active ? 'Proyecto cerrado' : 'Proyecto reabierto')}>{current.is_active ? 'Cerrar proyecto' : 'Reabrir proyecto'}</button>{canPublish && <button className={moduleClass("project-secondary")} onClick={() => void confirmThen(current.is_public
        ? { title: '¿Retirar el resumen público?', message: 'El proyecto dejará de aparecer en Transparencia. Sus datos internos no cambian.', confirmLabel: 'Retirar publicación', tone: 'danger' }
        : { title: '¿Aprobar el resumen público?', message: 'Se publicarán el nombre, el objetivo, el estado y el resumen financiero. Los gastos detallados, participantes y comprobantes seguirán privados.', confirmLabel: 'Aprobar y publicar' },
        () => service.setPublication(current.id, !current.is_public), current.is_public ? 'Resumen público retirado' : 'Resumen público aprobado')}><Globe2 size={16} aria-hidden="true"/>{current.is_public ? 'Retirar publicación' : 'Aprobar resumen público'}</button>}</div>
  </header>
  <div ref={editPanel}>{edit && <ProjectEditForm key={JSON.stringify([edit.kind,edit.project.revision,edit.kind === "budget" ? edit.item.budget_item_id : edit.kind === "expense" ? edit.expense.expense_id : edit.kind === "member" ? edit.member.project_member_id : current.id])} target={edit} onCancel={() => setEdit(null)} onSave={action => { void run(async () => { await action(); setEdit(null); }, 'Edición guardada'); }} />}</div>
  {!current.is_active && <p role="status">El proyecto está cerrado. Puedes consultar el informe o reabrirlo para realizar cambios.</p>}
  <div className={moduleClass("project-stats detail-stats")}><div><span>Presupuesto aprobado</span><strong>{formatMoney(current.budget_total)}</strong></div><div><span>Gastos registrados</span><strong>{formatMoney(spent)}</strong></div><div><span>Saldo por ejecutar</span><strong>{formatMoney(remainingMoney(current.budget_total, spent))}</strong></div><div><span>Pendiente de asignar a rubros</span><strong>{formatMoney(remainingMoney(current.budget_total, allocated))}</strong></div></div>
  <div className={moduleClass("project-detail-progress")}><FinancialProgress budget={current.budget_total} spent={spent}/></div>
  <nav aria-label="Gestión del proyecto" className={moduleClass("project-detail-tabs")}>{[{ id: 'budget', label: 'Rubros y gastos', Icon: Wallet }, { id: 'members', label: 'Equipo del proyecto', Icon: Users }, { id: 'report', label: 'Informe financiero', Icon: ChartNoAxesCombined }].map(({ id, label, Icon }) => <button key={id} aria-pressed={tab === id} onClick={() => { setTab(id); setError(''); }}><Icon size={17} aria-hidden="true"/>{label}</button>)}</nav>
  {tab === 'budget' && <>
   <div className={moduleClass("project-section-heading")}><div><h2>Distribución del presupuesto</h2><p className={moduleClass("project-muted")}>Organiza los recursos por rubro y registra sus movimientos.</p></div><span>{plural(current.budget_items.length, 'rubro', 'rubros')}</span></div>
   <details className={moduleClass("project-card project-create")}><summary><Plus size={18} aria-hidden="true"/><span>Añadir rubro<small>{formatMoney(remainingMoney(current.budget_total, allocated))} pendientes de asignación.</small></span></summary><AddBudgetItemForm pending={remainingMoney(current.budget_total, allocated)} disabled={!current.is_active} onSave={save} add={(name, amount) => service.addBudgetItem(current.id, name, amount)} /></details>
   {current.budget_items.map((item, index) => <article className={moduleClass("project-card project-budget-card")} key={item.budget_item_id}><div className={moduleClass("project-budget-heading")}><span className={moduleClass("project-budget-number")}>{String(index + 1).padStart(2, '0')}</span><div><p className={moduleClass("project-eyebrow")}>RUBRO PRESUPUESTARIO</p><h3>{item.name}</h3></div><span className={moduleClass("project-count-label")}>{plural(item.expenses.length, 'gasto', 'gastos')}</span></div><dl className={moduleClass("project-public-totals")}><div><dt>Asignado</dt><dd>{formatMoney(item.allocated_amount)}</dd></div><div><dt>Ejecutado</dt><dd>{formatMoney(item.spent_amount)}</dd></div><div><dt>Saldo del rubro</dt><dd>{formatMoney(remainingMoney(item.allocated_amount, item.spent_amount))}</dd></div></dl><FinancialProgress budget={item.allocated_amount} spent={item.spent_amount} compact/>
    <div className={moduleClass("project-toolbar")}><button disabled={!current.is_active} onClick={() => beginEdit({kind:"budget",project:current,item})}>Editar rubro</button><button disabled={!current.is_active || item.expenses.length > 0} aria-describedby={!current.is_active || item.expenses.length > 0 ? `delete-reason-${item.budget_item_id}` : undefined} onClick={() => void confirmThen({ title: `¿Retirar el rubro «${item.name}»?`, message: 'No tiene gastos vigentes. Su registro se conservará en el historial.', confirmLabel: 'Retirar rubro', tone: 'danger' },
                () => service.deleteBudgetItem(current.id, item.budget_item_id), 'Rubro retirado')}>Eliminar rubro</button>{(!current.is_active || item.expenses.length > 0) && <p id={`delete-reason-${item.budget_item_id}`} className={moduleClass("project-disabled-reason")}>{item.expenses.length > 0 ? `No se puede eliminar: tiene ${plural(item.expenses.length, 'gasto registrado', 'gastos registrados')}.` : 'No se puede eliminar: el proyecto está cerrado.'}</p>}</div>
    <details className={moduleClass("project-expense-form")}><summary>Registrar un gasto</summary><AddExpenseForm itemId={item.budget_item_id} balance={remainingMoney(item.allocated_amount, item.spent_amount)} start={current.start_date} end={current.end_date} disabled={!current.is_active} onSave={save} add={(amount, description, date) => service.addExpense(item.budget_item_id, current.id, amount, description, date)} /></details>
    {item.expenses.length ? <div className={moduleClass("project-table")} role="region" aria-label={`Gastos de ${item.name}`} tabIndex={0}><table><caption>Movimientos de {item.name}</caption><thead><tr><th scope="col">Fecha</th><th scope="col">Concepto</th><th scope="col">Importe</th><th scope="col">Respaldo privado</th><th scope="col">Acción</th></tr></thead><tbody>{item.expenses.map(exp => <tr key={exp.expense_id}><td className={moduleClass("project-nowrap")}>{formatProjectDate(exp.date)}</td><td>{exp.description}</td><td className={moduleClass("project-amount")}>{formatMoney(exp.amount)}</td><td><ExpenseFiles institutionId={current.institution_id} expenseId={exp.expense_id} readOnly={!current.is_active}/></td><td><button disabled={!current.is_active} aria-label={`Editar gasto ${exp.description}`} onClick={() => beginEdit({kind:"expense",project:current,expense:exp})}>Editar</button><button disabled={!current.is_active} className={moduleClass("project-danger-button")} aria-label={`Eliminar gasto ${exp.description}`} onClick={() => void confirmThen({ title: '¿Retirar este gasto?', message: `«${exp.description}» dejará de sumar al saldo ejecutado. Se conservarán su historial y comprobantes.`, confirmLabel: 'Retirar gasto', tone: 'danger' },
                () => service.deleteExpense(item.budget_item_id, current.id, exp.expense_id), 'Gasto retirado')}>Eliminar</button></td></tr>)}</tbody></table></div> : <p className={moduleClass("project-inline-empty")}><FolderOpen size={18} aria-hidden="true"/>Este rubro todavía no tiene gastos registrados.</p>}
   </article>)}
   {!current.budget_items.length && <ProjectEmpty title="Distribuye los recursos del proyecto">Abre «Añadir rubro» para asignar presupuesto a materiales, servicios u otras necesidades del proyecto.</ProjectEmpty>}
  </>}
  {tab === 'members' && <section className={moduleClass("project-card")}><div className={moduleClass("project-section-heading")}><div><p className={moduleClass("project-eyebrow")}>PERSONAS Y RESPONSABILIDADES</p><h2>Equipo del proyecto</h2><p className={moduleClass("project-muted")}>Asigna responsabilidades a perfiles existentes de la institución.</p></div><span>{plural(current.members.length, 'participante', 'participantes')}</span></div><button disabled={loadingMembers} onClick={() => void loadMembers()}><Users size={16} aria-hidden="true"/>{loadingMembers ? 'Cargando perfiles…' : membersLoaded ? 'Actualizar perfiles' : 'Cargar perfiles institucionales'}</button>
   <AddMemberForm options={options.filter(p => !current.members.some(m => m.profile_id === p.profile_id))} disabled={!current.is_active} onSave={save} add={(profile, role) => service.addProjectMember(current.id, { profile_id: profile, role })} /><datalist id="project-member-roles">{[...new Set(current.members.map(member => member.role))].map(role => <option key={role} value={role}/>)}</datalist>
   {membersLoaded && !options.length && <p className={moduleClass("project-inline-empty")}>No hay perfiles disponibles para añadir. Actualiza la lista si se asignan nuevos perfiles a la institución.</p>}
   {current.members.length ? <div className={moduleClass("project-team-grid")}>{current.members.map(m => <article className={moduleClass("project-member")} key={m.project_member_id}><span className={moduleClass("project-member-avatar")} aria-hidden="true">{m.full_name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'P'}</span><div><h3>{m.full_name}</h3><p>{m.role}</p><small>{m.email || 'Correo no visible'}</small></div><button disabled={!current.is_active} onClick={() => beginEdit({kind:"member",project:current,member:m})}>Editar responsabilidad</button><button className={moduleClass("project-text-button")} disabled={!current.is_active} aria-label={`Quitar a ${m.full_name}`} onClick={() => void confirmThen({ title: `¿Quitar a ${m.full_name} del proyecto?`, message: 'Podrás volver a añadirlo más adelante.', confirmLabel: 'Quitar', tone: 'danger' },
            () => service.removeProjectMember(current.id, m.project_member_id), 'Participante quitado')}>Quitar</button></article>)}</div> : <ProjectEmpty title="El equipo está por formarse">Carga los perfiles institucionales y añade a cada participante con su responsabilidad.</ProjectEmpty>}
  </section>}
  {tab === 'report' && <section className={moduleClass("project-report project-card")}><ProjectReport project={current} institutionName={institutionName}/></section>}
 </fieldset>;
}
