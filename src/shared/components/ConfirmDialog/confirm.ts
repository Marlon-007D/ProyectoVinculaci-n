export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** "danger" for actions that remove, archive or discard something. */
  tone?: 'default' | 'danger';
}
export type ConfirmRequest = ConfirmOptions & { resolve: (accepted: boolean) => void };

let current: ConfirmRequest | null = null;
const listeners = new Set<(request: ConfirmRequest | null) => void>();
const emit = () => listeners.forEach(listener => listener(current));

/** Asks inside the application instead of the browser's native dialog. */
export function confirmAction(options: ConfirmOptions): Promise<boolean> {
  // Without a mounted host (isolated tests or embeds) fall back to the native dialog.
  if (!listeners.size) return Promise.resolve(window.confirm([options.title, options.message].filter(Boolean).join('\n\n')));
  current?.resolve(false);
  return new Promise(resolve => { current = { ...options, resolve }; emit(); });
}

export function subscribeConfirm(listener: (request: ConfirmRequest | null) => void) {
  listeners.add(listener);
  listener(current);
  return () => { listeners.delete(listener); };
}

export function settleConfirm(accepted: boolean) {
  const request = current;
  current = null;
  emit();
  request?.resolve(accepted);
}
