import type { ComponentPropsWithoutRef } from 'react';
import { adminFieldIssue } from './formValidation';
import { useToast } from './Toast/Toast';

export function AdminForm({ children, onSubmitCapture, ...props }: ComponentPropsWithoutRef<'form'>) {
  const notify = useToast();
  function validate(event: Parameters<NonNullable<ComponentPropsWithoutRef<'form'>['onSubmitCapture']>>[0]) {
    for (const element of Array.from(event.currentTarget.elements)) {
      if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)
        || element.disabled || element.matches(':disabled') || (element instanceof HTMLInputElement && ['hidden', 'submit', 'button', 'reset'].includes(element.type))) continue;
      const input = element instanceof HTMLInputElement ? element : null;
      const password = element.autocomplete === 'current-password' || element.autocomplete === 'new-password';
      const message = adminFieldIssue({ value: element.value, required: element.required,
        type: input?.type ?? 'text', minLength: 'minLength' in element ? (element.minLength >= 0 ? element.minLength : password ? 8 : -1) : -1,
        maxLength: 'maxLength' in element ? element.maxLength : -1, pattern: input?.pattern, checked: input?.checked });
      if (message || !element.validity.valid) {
        event.preventDefault();
        event.stopPropagation();
        element.focus();
        notify(message ?? 'Revisa el valor del campo indicado.', 'warning');
        return;
      }
    }
    onSubmitCapture?.(event);
  }
  return <form {...props} noValidate onSubmitCapture={validate}>{children}</form>;
}
