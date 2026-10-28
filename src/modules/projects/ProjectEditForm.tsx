import type { BudgetItem, Expense, Project, ProjectMember } from './types';
import { createProjectService } from './projectService';
import { ecuadorToday, remainingMoney, TEXT_LIMITS } from './projectValidation';
import { ProjectFields } from './ProjectFields';
import { ExpenseFields, useValidatedSubmit } from './BudgetForms';
import { MoneyField, TextField } from './FormInputs';
import { validateBudgetItemForm, validateExpenseForm, validateProjectForm, validateRoleForm, type Validated } from './projectForms';
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
  const budgetItem = target.kind === 'expense' ? target.project.budget_items.find(item => item.budget_item_id === target.expense.budget_item_id) : undefined;
  // The expense being edited does not count against its own rubro balance.
  const balance = target.kind === 'expense' && budgetItem ? remainingMoney(budgetItem.allocated_amount, budgetItem.spent_amount) + target.expense.amount : 0;
  type Saved = { run: () => Promise<unknown> };
  function validate(data: FormData): Validated<Saved> {
    switch (target.kind) {
      case 'project': { const result = validateProjectForm(data); return result.ok ? { ok: true, values: { run: () => service.updateProject(target.project.id, result.values) } } : result; }
      case 'budget': { const result = validateBudgetItemForm(data); return result.ok ? { ok: true, values: { run: () => service.updateBudgetItem(target.project.id, target.item.budget_item_id, result.values.name, result.values.amount) } } : result; }
      case 'expense': { const result = validateExpenseForm(data, { balance, start: target.project.start_date, end: target.project.end_date }); return result.ok ? { ok: true, values: { run: () => service.updateExpense(target.expense.budget_item_id, target.project.id, target.expense.expense_id, result.values.amount, result.values.description, result.values.date) } } : result; }
      case 'member': { const result = validateRoleForm(data); return result.ok ? { ok: true, values: { run: () => service.updateProjectMember(target.project.id, target.member.project_member_id, result.values.role) } } : result; }
    }
  }
  const { errors, clear, submit } = useValidatedSubmit(validate, saved => onSave(saved.run));
  const title = { project: 'Editar proyecto', budget: 'Editar rubro', expense: 'Editar gasto', member: 'Editar responsabilidad' }[target.kind];
  return <section className={styles.formCard} aria-labelledby="project-edit-heading">
    <div className={styles.formHeading}><h2 id="project-edit-heading">{title}</h2></div>
    <form noValidate onSubmit={submit}>
      <fieldset className={local['project-fieldset']}>
        {target.kind === 'project' && <ProjectFields project={target.project} prefix="edit-project" errors={errors} onEdit={clear} />}
        {target.kind === 'budget' && <div className={styles.formFields}>
          <TextField id="edit-budget-name" name="name" label="Nombre del rubro" max={TEXT_LIMITS.budgetName} defaultValue={target.item.name} error={errors.name} onEdit={clear} />
          <MoneyField id="edit-budget-amount" name="amount" label="Asignación (USD)" defaultValue={target.item.allocated_amount} error={errors.amount} onEdit={clear} />
        </div>}
        {target.kind === 'expense' && <div className={styles.formFields}>
          <ExpenseFields prefix="edit-expense" errors={errors} onEdit={clear} balance={balance} start={target.project.start_date} end={target.project.end_date} defaults={target.expense} />
        </div>}
        {target.kind === 'member' && <TextField id="edit-member-role" name="role" label={`Responsabilidad de ${target.member.full_name}`} max={TEXT_LIMITS.role} defaultValue={target.member.role} error={errors.role} onEdit={clear} />}
        <div className={styles.formActions}><button type="button" className={styles.secondaryButton} onClick={onCancel}>Cancelar</button><button type="submit" className={styles.primaryButton}>Guardar edición</button></div>
      </fieldset>
    </form>
  </section>;
}
