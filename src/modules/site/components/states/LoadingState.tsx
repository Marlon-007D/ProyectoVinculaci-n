import styles from "./LoadingState.module.css";

export type LoadingVariant = "page" | "cards" | "article" | "events" | "people";
type PageKind = "home" | "content";

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

export function LoadingState({ label = "Cargando contenido", inline = false, variant = "cards", pageKind = "home" }: { label?: string; inline?: boolean; variant?: LoadingVariant; pageKind?: PageKind }) {
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

  if (variant === "events" || variant === "people") return <div className={`${styles.skeleton} ${styles.list}`} role="status" aria-label={label} aria-busy="true">{[0, 1].map((item) => <div className={styles.listCard} key={item} aria-hidden="true"><span className={`${styles.line} ${variant === "events" ? styles.date : styles.avatar}`} /><div><Placeholder className={styles.lineStrong} /><Placeholder className={styles.lineShort} /></div></div>)}</div>;

  return <div className={`${styles.skeleton} ${variant === "page" ? styles.page : ""} ${variant === "page" ? styles[`page_${pageKind}`] : ""}`} role="status" aria-label={label} aria-busy="true">
    {variant === "page" && pageKind === "home" && <div className={styles.hero} aria-hidden="true"><Placeholder className={styles.lineTiny} /><Placeholder className={styles.lineStrong} /><Placeholder className={styles.lineShort} /></div>}
    {variant === "page" && pageKind === "content" && <header className={styles.pageHeading} aria-hidden="true"><Placeholder className={styles.lineStrong} /></header>}
    <section className={`${styles.block} ${variant === "page" && pageKind === "content" ? styles.contentBlock : ""}`} aria-hidden="true">
      {variant === "page" && pageKind === "content" ? <><Placeholder /><Placeholder /><Placeholder className={styles.lineShort} /></> : <><Placeholder className={styles.lineStrong} /><div className={styles.cards}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div></>}
    </section>
    {variant === "page" && pageKind === "home" && <section className={styles.block} aria-hidden="true"><Placeholder className={styles.lineStrong} /><div className={styles.cards}><CardSkeleton /><CardSkeleton /><CardSkeleton /></div></section>}
  </div>;
}
