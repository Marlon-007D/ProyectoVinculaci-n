import type { BudgetItem, Expense, Project, ProjectMember } from './types';
import { createProjectService } from './projectService';
import { ecuadorToday, MAX_STORED_MONEY } from './projectValidation';
import { ProjectFields, projectInput } from './ProjectFields';
import styles from '../../features/feats/pages/AdminCourseCategoriesPage.module.css';
import local from './projects.module.css';

export type ProjectEditTarget = { project: Project } & (
  { kind: 'project' } | { kind: 'budget'; item: BudgetItem } |
  { kind: 'expense'; expense: Expense } | { kind: 'member'; member: ProjectMember }
);

export function ProjectEditForm({ target, onSave, onCancel }: {
  target: ProjectEditTarget; onSave: (action: () => Promise<unknown>) => void; onCancel: () => void;
}) {
  // The revision belongs to the record shown when editing began, even if the list refreshes.
  const service = createProjectService(target.project.institution_id, ecuadorToday, target.project.revision);
  function save(data: FormData) {
    switch (target.kind) {
      case 'project': return service.updateProject(target.project.id, projectInput(data));
      case 'budget': return service.updateBudgetItem(target.project.id, target.item.budget_item_id, String(data.get('name')), Number(data.get('amount')));
      case 'expense': return service.updateExpense(target.expense.budget_item_id, target.project.id, target.expense.expense_id, Number(data.get('amount')), String(data.get('description')), String(data.get('date')));
      case 'member': return service.updateProjectMember(target.project.id, target.member.project_member_id, String(data.get('role')));
    }
  }
  const title = { project: 'Editar proyecto', budget: 'Editar rubro', expense: 'Editar gasto', member: 'Editar responsabilidad' }[target.kind];
  return <section className={styles.formCard} aria-labelledby="project-edit-heading">
    <div className={styles.formHeading}><h2 id="project-edit-heading">{title}</h2></div>
    <form onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); onSave(() => save(data)); }}>
      <fieldset className={local['project-fieldset']}>
        {target.kind === 'project' && <ProjectFields project={target.project} />}
        {target.kind === 'budget' && <div className={styles.formFields}><label className={styles.field}>Nombre del rubro<input name="name" defaultValue={target.item.name} required maxLength={255} /></label><label className={styles.field}>Asignación (USD)<input name="amount" defaultValue={target.item.allocated_amount} type="number" required min="0.01" max={MAX_STORED_MONEY} step="0.01" /></label></div>}
        {target.kind === 'expense' && <div className={styles.formFields}><label className={styles.field}>Concepto y referencia<input name="description" defaultValue={target.expense.description} required /></label><label className={styles.field}>Importe (USD)<input name="amount" defaultValue={target.expense.amount} type="number" required min="0.01" max={MAX_STORED_MONEY} step="0.01" /></label><label className={styles.field}>Fecha del gasto<input name="date" defaultValue={target.expense.date} type="date" required min={target.project.start_date} max={target.project.end_date < ecuadorToday() ? target.project.end_date : ecuadorToday()} /></label></div>}
        {target.kind === 'member' && <label className={styles.field}>Responsabilidad de {target.member.full_name}<input name="role" defaultValue={target.member.role} required maxLength={100} /></label>}
        <div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={onCancel}>Cancelar</button><button type="submit" className={styles.primaryButton}>Guardar edición</button></div>
      </fieldset>
    </form>
  </section>;
}
