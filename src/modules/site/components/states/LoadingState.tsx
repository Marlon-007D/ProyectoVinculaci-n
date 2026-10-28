import styles from "./LoadingState.module.css";

export type LoadingVariant = "page" | "cards" | "article" | "events" | "people";
type PageKind = "home" | "content";

function Placeholder({ className = "" }: { className?: string }) {
  return <span className={`${styles.line} ${className}`} aria-hidden="true" />;
}

export function LoadingState({ label = "Cargando contenido", inline = false, variant = "cards", pageKind = "home" }: { label?: string; inline?: boolean; variant?: LoadingVariant; pageKind?: PageKind }) {
  if (inline) return <div className={styles.inline} role="status" aria-live="polite"><span className={styles.dot} aria-hidden="true" /><span>{label}</span></div>;

  // Keep sections that load independently from stacking several card skeletons
  // beneath the page-level loader.
  if (variant === "cards" || variant === "events" || variant === "people") {
    return <div className={styles.inline} role="status" aria-live="polite"><span className={styles.dot} aria-hidden="true" /><span>{label}</span></div>;
  }

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

  return <div className={`${styles.skeleton} ${styles.page}`} role="status" aria-label={label} aria-busy="true">
    <section className={`${styles.pagePanel} ${pageKind === "home" ? styles.pagePanelHome : styles.pagePanelContent}`} aria-hidden="true">
      {pageKind === "home" ? <>
        <Placeholder className={styles.lineTiny} />
        <Placeholder className={styles.lineHeadline} />
        <Placeholder className={styles.lineHeadlineSecond} />
        <div className={styles.pageHeroActions}><span /><span /></div>
      </> : <>
        <Placeholder className={styles.lineHeadline} />
        <Placeholder />
        <Placeholder />
        <Placeholder className={styles.lineShort} />
      </>}
    </section>
  </div>;
}
