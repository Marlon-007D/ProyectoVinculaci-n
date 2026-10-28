import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./ContentDetailDialog.module.css";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function ContentDetailDialog({ title, onClose, children }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
      onCancel={(event) => {
        event.preventDefault();
        onCloseRef.current();
      }}
    >
      <header className={styles.header}>
        <div className={styles.heading}>
          <span className={styles.headerEyebrow}>Información institucional</span>
          <h2 id={titleId}>{title}</h2>
        </div>
        <button className={styles.closeButton} type="button" onClick={() => onCloseRef.current()} aria-label="Cerrar detalles">
          <span className={styles.icon} aria-hidden="true">close</span>
        </button>
      </header>
      <div className={styles.body}>{children}</div>
    </dialog>
  );
}
