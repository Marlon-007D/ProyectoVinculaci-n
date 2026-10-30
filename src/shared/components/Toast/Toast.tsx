import { useEffect } from 'react';
import { notify, type NotifyKind } from '../Toaster/notify';

/** Adapter over notify(): existing useToast callers keep working while sonner is the only toast system. */
const toast = (message: string, kind: NotifyKind = 'error') => { notify[kind](message); };

export function useToast() { return toast; }
export function useToastMessage(message: string | undefined | null, kind: NotifyKind = 'error') {
  useEffect(() => { if (message) toast(message, kind); }, [message, kind]);
}
