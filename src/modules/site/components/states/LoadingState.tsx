import styles from "./LoadingState.module.css";

export type LoadingVariant = "page" | "cards" | "article";

function Placeholder({ className = "" }: { className?: string }) {
  return <span className={`${styles.line} ${className}`} aria-hidden="true" />;
}

function CardSkeleton() {
  return <div className={styles.card} aria-hidden="true">
    <span className={`${styles.line} ${styles.image}`} />
    <Placeholder className={styles.lineStrong} />
    <Placeholder />
    <Placeholder className={styles.lineShort} />
  </div>;
}

export function LoadingState({ label = "Cargando contenido", inline = false, variant = "cards" }: { label?: string; inline?: boolean; variant?: LoadingVariant }) {
  if (inline) return <div className={styles.inline} role="status" aria-live="polite"><span className={styles.dot} aria-hidden="true" /><span>{label}</span></div>;

  if (variant === "article") return <div className={styles.article} role="status" aria-label={label} aria-busy="true">
    <span className={`${styles.line} ${styles.articleImage}`} aria-hidden="true" />
    <div className={styles.articleBody} aria-hidden="true">
      <Placeholder className={styles.lineTiny} />
      <Placeholder className={styles.lineStrong} />
      <Placeholder />
      <Placeholder className={styles.lineShort} />
      <Placeholder /><Placeholder /><Placeholder className={styles.lineShort} />
    </div>
  </div>;

  return <div className={`${styles.skeleton} ${variant === "page" ? styles.page : ""}`} role="status" aria-label={label} aria-busy="true">
    {variant === "page" && <div className={styles.hero} aria-hidden="true"><Placeholder className={styles.lineTiny} /><Placeholder className={styles.lineStrong} /><Placeholder className={styles.lineShort} /></div>}
    <section className={styles.block} aria-hidden="true">
      <Placeholder className={styles.lineStrong} />
      <div className={styles.cards}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div>
    </section>
    {variant === "page" && <section className={styles.block} aria-hidden="true"><Placeholder className={styles.lineStrong} /><div className={styles.cards}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div></section>}
  </div>;
}
