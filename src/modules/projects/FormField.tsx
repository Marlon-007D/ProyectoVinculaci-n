import { useState, type ReactNode } from 'react';
import { CircleAlert, Info } from 'lucide-react';
import { moduleClass } from './projectStyles';
import type { Errors } from './projectForms';

/** Attributes that tie an input to its single error and helper line. Only a validation error marks it invalid. */
export function fieldProps(id: string, error?: string, hint = false, notice = false) {
  const described = [error ? `${id}-error` : '', notice ? `${id}-notice` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ');
  return { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': described || undefined } as const;
}

interface FieldProps {
  id: string;
  label: ReactNode;
  error?: string;
  /** Temporary trim notice. Pass a string (even empty) to reserve its polite live region. */
  notice?: string;
  hint?: ReactNode;
  warning?: boolean;
  count?: number;
  max?: number;
  className?: string;
  children: ReactNode;
}

/** Label, control, helper line, one error under the field and an optional «45/80» counter. */
export function Field({ id, label, error, notice, hint, warning, count, max, className, children }: FieldProps) {
  const counter = max !== undefined && count !== undefined;
  return <div className={`${moduleClass(`project-field${error ? ' is-invalid' : ''}`)}${className ? ` ${className}` : ''}`}>
    <label htmlFor={id}>{label}</label>
    {children}
    <div className={moduleClass('project-field-foot')}>
      <div className={moduleClass('project-field-messages')}>
        {hint && <p id={`${id}-hint`} className={moduleClass(`project-field-hint${warning ? ' is-warning' : ''}`)}>{hint}</p>}
        {notice !== undefined && <p id={`${id}-notice`} aria-live="polite" className={moduleClass('project-field-notice')}>{notice && <><Info size={14} aria-hidden="true" />{notice}</>}</p>}
        {error && <p id={`${id}-error`} role="alert" className={moduleClass('project-field-error')}><CircleAlert size={14} aria-hidden="true" />{error}</p>}
      </div>
      {counter && <span className={moduleClass(`project-field-counter${count > max ? ' is-over' : ''}`)} aria-hidden="true">{count}/{max}</span>}
    </div>
  </div>;
}

export function focusFirstInvalid(form: HTMLElement) {
  requestAnimationFrame(() => form.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
}

/** Errors per field name. Typing in a field clears its message. */
export function useFieldErrors() {
  const [errors, setErrors] = useState<Errors>({});
  const clear = (name: string) => setErrors(old => {
    if (!(name in old)) return old;
    const { [name]: _removed, ...rest } = old;
    return rest;
  });
  return { errors, setErrors, clear };
}
