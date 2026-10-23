import type { Project } from './types';
import { MAX_STORED_MONEY } from './projectValidation';
import styles from '../../features/feats/pages/AdminCourseCategoriesPage.module.css';

export function ProjectFields({ project, min, max }: { project?: Project; min?: string; max?: string }) {
  return <div className={styles.formFields}>
    <label className={styles.field}>Nombre del proyecto<input name="name" defaultValue={project?.name} required maxLength={255} /></label>
    <label className={styles.field}>Presupuesto aprobado (USD)<input name="budget" type="number" defaultValue={project?.budget_total} required min="0" max={MAX_STORED_MONEY} step="0.01" aria-describedby="project-budget-help" /></label>
    <label className={styles.field}>Fecha de inicio<input name="start" type="date" defaultValue={project?.start_date} min={min} max={max} required /></label>
    <label className={styles.field}>Fecha de finalización<input name="end" type="date" defaultValue={project?.end_date} min={min} max={max} required /></label>
    <p className={styles.wideField} id="project-budget-help">El presupuesto corresponde al monto autorizado para este proyecto. El saldo de otros proyectos no representa fondos disponibles para uno nuevo.</p>
    <label className={`${styles.field} ${styles.wideField}`}>Objetivo y descripción pública<textarea name="description" defaultValue={project?.description} required rows={3} /><small>Este texto podrá mostrarse en Transparencia cuando un administrador apruebe el resumen.</small></label>
    {project?.is_public && <p className={styles.wideField}>Al guardar estos cambios, el resumen volverá a ser privado hasta que un administrador apruebe su publicación.</p>}
  </div>;
}

export function projectInput(data: FormData) {
  return { name: String(data.get('name') ?? ''), description: String(data.get('description') ?? ''), budget_total: Number(data.get('budget')), start_date: String(data.get('start') ?? ''), end_date: String(data.get('end') ?? '') };
}
