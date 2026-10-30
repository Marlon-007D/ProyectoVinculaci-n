import type { LucideIcon } from 'lucide-react';
import styles from './EmptyState.module.css';

/** Shared empty state: icon, title and explanation in the same card style as the rest of the panel. */
export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: string }) {
  return <section className={styles.empty} role="status">
    <span className={styles.icon}><Icon size={24} aria-hidden="true" /></span>
    <h2 className={styles.title}>{title}</h2>
    <p className={styles.text}>{children}</p>
  </section>;
}
