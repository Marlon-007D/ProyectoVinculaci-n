import type { FormEvent } from 'react';
import { toast } from 'sonner';

export type NotifyKind = 'success' | 'error' | 'warning' | 'info';
export interface NotifyOptions {
  description?: string;
  /** Stable id: repeated notifications replace the visible one instead of stacking. */
  id?: string;
  /** Stays visible until the person closes it or uses its action. */
  persistent?: boolean;
  action?: { label: string; onClick: () => void };
}
export type Notifier = Record<NotifyKind, (title: string, options?: NotifyOptions) => void> & { dismiss: (id?: string) => void };

const durations: Record<NotifyKind, number> = { success: 4000, info: 5000, warning: 6500, error: 8000 };

function show(kind: NotifyKind) {
  return (title: string, { description, id, persistent, action }: NotifyOptions = {}) => {
    // Timed toasts expose their duration to CSS, which draws the remaining-time bar.
    toast[kind](title, {
      description, id, action,
      duration: persistent ? Infinity : durations[kind],
      className: persistent ? undefined : 'toast-timed',
      style: persistent ? undefined : { ['--toast-duration' as string]: `${durations[kind]}ms` },
    });
  };
}

/** Modules depend on this contract, not on the toast library. */
export const notify: Notifier = {
  success: show('success'),
  error: show('error'),
  warning: show('warning'),
  info: show('info'),
  dismiss: id => { toast.dismiss(id); },
};

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function fieldName(field: Field) {
  const aria = field.getAttribute('aria-label');
  if (aria) return aria;
  // Labels wrap their control, so only the label's own text nodes name the field.
  const label = field.labels?.[0];
  const own = label ? [...label.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent ?? '').join(' ').trim() : '';
  return own || field.name || 'Un campo';
}

let reportedThisSubmit = false;

/** onInvalidCapture handler: one toast per submit, naming the first invalid field. */
export function notifyInvalidForm(event: FormEvent<HTMLElement>) {
  const field = event.target as Field;
  if (reportedThisSubmit || !('validationMessage' in field)) return;
  reportedThisSubmit = true;
  queueMicrotask(() => { reportedThisSubmit = false; });
  notify.warning('Revisa el formulario', { id: 'form-validation', description: `${fieldName(field)}: ${field.validationMessage}` });
}
