import { Skeleton, type SkeletonVariant } from "./Skeleton";

export type LoadingVariant = "page" | "cards" | "article" | "events" | "people";
type PageKind = "home" | "content";

// Every loading state of the portal is the shared Skeleton, shaped like the content it stands in for.
const skeletonFor: Record<LoadingVariant, SkeletonVariant> = {
  page: "hero", cards: "news-cards", events: "section-list", people: "section-list", article: "article",
};

export function LoadingState({ label = "Cargando contenido", inline = false, variant = "cards" }: { label?: string; inline?: boolean; variant?: LoadingVariant; pageKind?: PageKind }) {
  return <Skeleton variant={inline ? "line" : skeletonFor[variant]} label={label} />;
}
