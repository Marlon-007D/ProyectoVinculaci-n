import { useEffect, useRef, useState } from 'react';
import { CircleHelp, TriangleAlert } from 'lucide-react';
import { settleConfirm, subscribeConfirm, type ConfirmRequest } from './confirm';
import { useSingleInstance } from '../singleInstance';
import styles from './ConfirmDialog.module.css';

/** Single confirmation dialog for the application; <dialog> provides focus trap and Escape. */
export function ConfirmHost() {
  return useSingleInstance('confirm-host') ? <ConfirmDialogView /> : null;
}

function ConfirmDialogView() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const accepted = useRef(false);
  useEffect(() => subscribeConfirm(setRequest), []);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (request && !element.open) { accepted.current = false; element.showModal(); }
    if (!request && element.open) element.close();
  }, [request]);
  const danger = request?.tone === 'danger';
  const Icon = danger ? TriangleAlert : CircleHelp;
  return <dialog ref={dialog} className={`${styles.dialog} ${danger ? styles.danger : ''}`} aria-labelledby="confirm-title" aria-describedby={request?.message ? 'confirm-message' : undefined}
    onClose={() => { if (request) settleConfirm(accepted.current); }}
    onClick={event => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
    {request && <div className={styles.card}>
      <span className={styles.icon} aria-hidden="true"><Icon size={24} /></span>
      <h2 id="confirm-title" className={styles.title}>{request.title}</h2>
      {request.message && <p id="confirm-message" className={styles.message}>{request.message}</p>}
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} autoFocus={danger} onClick={() => dialog.current?.close()}>{request.cancelLabel ?? 'Cancelar'}</button>
        <button type="button" className={styles.confirm} autoFocus={!danger} onClick={() => { accepted.current = true; dialog.current?.close(); }}>{request.confirmLabel ?? 'Aceptar'}</button>
      </div>
    </div>}
  </dialog>;
}
