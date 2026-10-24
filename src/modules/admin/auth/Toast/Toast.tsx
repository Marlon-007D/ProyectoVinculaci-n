import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import styles from './Toast.module.css';

type Notice = { message: string; kind: 'error' | 'success' };
type Notify = (message: string, kind?: Notice['kind']) => void;
const ToastContext = createContext<Notify | undefined>(undefined);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const notify = useCallback((message: string, kind: Notice['kind'] = 'error') => setNotice({ message, kind }), []);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 8000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  return <ToastContext.Provider value={notify}>{children}<div className={styles.region} aria-live="polite" aria-atomic="true">{notice && <div className={styles.toast} data-kind={notice.kind} role={notice.kind === 'error' ? 'alert' : 'status'}><span>{notice.message}</span><button type="button" onClick={() => setNotice(null)} aria-label="Cerrar notificación">Cerrar</button></div>}</div></ToastContext.Provider>;
}
export function ToastBoundary({ children }: { children: ReactNode }) {
  const existing = useContext(ToastContext);
  if (existing) return children;
  return <ToastProvider>{children}</ToastProvider>;
}
export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error('ToastBoundary is required for admin notifications');
  return notify;
}
export function useToastMessage(message: string | undefined | null, kind: Notice['kind'] = 'error') {
  const notify = useToast();
  useEffect(() => { if (message) notify(message, kind); }, [message, kind, notify]);
}
