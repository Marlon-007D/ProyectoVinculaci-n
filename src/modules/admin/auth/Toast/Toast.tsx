import { useEffect, type ReactNode } from 'react';
import { notify, type NotifyKind } from '../../../../shared/components/Toaster/notify';

/** Adapter over notify(): admin notifications use the same sonner toast as the rest of the app. */
const toast = (message: string, kind: NotifyKind = 'error') => { notify[kind](message); };

/** Kept for existing call sites; the toast region is mounted once at the app root. */
export function ToastBoundary({ children }: { children: ReactNode }) { return <>{children}</>; }
export function useToast() { return toast; }
export function useToastMessage(message: string | undefined | null, kind: NotifyKind = 'error') {
  useEffect(() => { if (message) toast(message, kind); }, [message, kind]);
}
