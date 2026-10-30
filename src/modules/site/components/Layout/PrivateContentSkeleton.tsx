import styles from './PrivateContentSkeleton.module.css';

/** Single loading placeholder for the content area of every private page. */
export function PrivateContentSkeleton({ label = 'Cargando tu espacio de trabajo' }: { label?: string }) {
  return <div className={styles.skeleton} role="status" aria-busy="true" aria-live="polite">
    <span className={styles.visuallyHidden}>{label}</span>
    <span className={`${styles.block} ${styles.eyebrow}`} aria-hidden="true" />
    <span className={`${styles.block} ${styles.title}`} aria-hidden="true" />
    <span className={`${styles.block} ${styles.lead}`} aria-hidden="true" />
    <div className={styles.cards} aria-hidden="true">
      {[0, 1, 2].map(item => <span key={item} className={`${styles.block} ${styles.card}`} />)}
    </div>
  </div>;
}
