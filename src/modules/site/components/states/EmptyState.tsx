import type { ReactNode } from "react";

export function EmptyState({ title = "Todavía no hay contenido", message, children }: { title?: string; message?: string; children?: ReactNode }) {
  return (
    <div className="site-state site-state--empty" role="status">
      <p className="site-state__title">{title}</p>
      {message && <p>{message}</p>}
      {children}
    </div>
  );
}
