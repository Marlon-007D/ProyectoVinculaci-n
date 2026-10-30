import type { ReactNode } from "react";
import styles from "./Skeleton.module.css";

export type SkeletonVariant = "hero" | "news-cards" | "section-list" | "article" | "line";

const block = (name: string) => `${styles.block} ${styles[name]}`;

const shapes: Record<SkeletonVariant, (count: number) => ReactNode> = {
  hero: () => <>
    <span className={block("heroEyebrow")} />
    <span className={block("heroTitle")} />
    <span className={block("heroTitleShort")} />
    <span className={block("heroLead")} />
    <div className={styles.heroActions}><span className={block("heroAction")} /><span className={block("heroAction")} /></div>
  </>,
  "news-cards": count => <>
    {Array.from({ length: count }, (_, index) => <div className={styles.newsCard} key={index}>
      <span className={block("newsImage")} /><span className={block("newsDate")} />
      <span className={block("newsTitle")} /><span className={block("newsTitleShort")} />
    </div>)}
  </>,
  "section-list": count => <>
    {Array.from({ length: count }, (_, index) => <div className={styles.sectionRow} key={index}>
      <span className={block("sectionAvatar")} />
      <div className={styles.sectionLines}><span className={block("sectionLine")} /><span className={block("sectionLineShort")} /></div>
    </div>)}
  </>,
  article: () => <>
    <span className={block("articleImage")} />
    {[0, 1, 2].map(index => <span className={block("articleLine")} key={index} />)}
    <span className={block("articleLineShort")} />
  </>,
  line: () => <span className={block("line")} />,
};

const layout: Record<SkeletonVariant, string> = {
  hero: styles.hero, "news-cards": styles.newsCards, "section-list": styles.sectionList, article: styles.article, line: "",
};

/** The one loading placeholder of the public portal: it mirrors the real content and never loops. */
export function Skeleton({ variant, label = "Cargando contenido", count = 3 }: { variant: SkeletonVariant; label?: string; count?: number }) {
  return <div className={`${styles.skeleton} ${layout[variant]}`} role="status" aria-busy="true" aria-live="polite">
    <span className={styles.srOnly}>{label}</span>
    {shapes[variant](count)}
  </div>;
}
