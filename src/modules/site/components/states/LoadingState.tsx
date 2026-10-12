export function LoadingState({ label = "Cargando…", inline = false }: { label?: string; inline?: boolean }) {
  return (
    <div className={`site-state site-state--loading${inline ? " site-state--inline" : ""}`} role="status" aria-live="polite">
      <span className="site-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
