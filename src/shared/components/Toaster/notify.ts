import type { FormEvent } from 'react';

export type NotifyKind = 'success' | 'error' | 'warning' | 'info';
export interface NotifyOptions {
  description?: string;
  /** Accepted for compatibility; the shared toast ignores it. */
  id?: string;
  /** Accepted for compatibility; the shared toast ignores it. */
  persistent?: boolean;
  action?: { label: string; onClick: () => void };
}
export type Notifier = Record<NotifyKind, (title: string, options?: NotifyOptions) => void> & { dismiss: (id?: string) => void };

type Sink = (message: string, kind: 'error' | 'success') => void;
const sinks: Sink[] = [];

/** NotifyBridge registers the shared toast (a hook) here so modules can notify outside render. */
export function connectNotifier(sink: Sink) {
  sinks.push(sink);
  return () => { const index = sinks.lastIndexOf(sink); if (index >= 0) sinks.splice(index, 1); };
}

// The shared toast only knows 'error' and 'success'.
const toastKind: Record<NotifyKind, 'error' | 'success'> = { success: 'success', info: 'success', warning: 'error', error: 'error' };

function message(title: string, description?: string) {
  if (!description) return title;
  return /[.:;!?]$/.test(title) ? title + ' ' + description : title + '. ' + description;
}

function show(kind: NotifyKind) {
  // id, persistent and action are accepted for API compatibility; the shared toast shows one timed message.
  return (title: string, { description }: NotifyOptions = {}) => { sinks.at(-1)?.(message(title, description), toastKind[kind]); };
}

/** Modules depend on this contract, not on the toast implementation. */
export const notify: Notifier = {
  success: show('success'),
  error: show('error'),
  warning: show('warning'),
  info: show('info'),
  dismiss: () => undefined,
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
