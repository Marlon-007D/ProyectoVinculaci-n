import type { Project } from './types';
import { TEXT_LIMITS } from './projectValidation';
import { Field, fieldProps } from './FormField';
import { MoneyField, TextField } from './FormInputs';
import type { Errors } from './projectForms';
import styles from '../../features/feats/pages/AdminCourseCategoriesPage.module.css';

interface Props { project?: Project; min?: string; max?: string; errors?: Errors; onEdit?: (name: string) => void; prefix?: string }

export function ProjectFields({ project, min, max, errors = {}, onEdit, prefix = 'project' }: Props) {
  return <div className={styles.formFields}>
    <TextField id={`${prefix}-name`} name="name" label="Nombre del proyecto" max={TEXT_LIMITS.projectName} defaultValue={project?.name} error={errors.name} onEdit={onEdit} />
    <MoneyField id={`${prefix}-budget`} name="budget" label="Presupuesto aprobado (USD)" defaultValue={project?.budget_total} error={errors.budget} onEdit={onEdit} />
    <Field id={`${prefix}-start`} label="Fecha de inicio" error={errors.start}>
      <input {...fieldProps(`${prefix}-start`, errors.start)} name="start" type="date" defaultValue={project?.start_date} min={min} max={max} onChange={() => onEdit?.('start')} />
    </Field>
    <Field id={`${prefix}-end`} label="Fecha de finalización" error={errors.end}>
      <input {...fieldProps(`${prefix}-end`, errors.end)} name="end" type="date" defaultValue={project?.end_date} min={min} max={max} onChange={() => onEdit?.('end')} />
    </Field>
    <p className={styles.wideField} id={`${prefix}-budget-help`}>El presupuesto corresponde al monto autorizado para este proyecto. El saldo de otros proyectos no representa fondos disponibles para uno nuevo.</p>
    <TextField id={`${prefix}-description`} name="description" label="Objetivo y descripción pública" max={TEXT_LIMITS.description} defaultValue={project?.description} textarea rows={3}
      hint="Este texto podrá mostrarse en Transparencia cuando un administrador apruebe el resumen." error={errors.description} onEdit={onEdit} className={styles.wideField} />
    {project?.is_public && <p className={styles.wideField}>Al guardar estos cambios, el resumen volverá a ser privado hasta que un administrador apruebe su publicación.</p>}
  </div>;
}
