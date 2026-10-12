interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
  inline?: boolean;
}

export function ErrorState({ title = "No se pudo cargar el contenido", message, onRetry, inline = false }: Props) {
  return (
    <div className={`site-state site-state--error${inline ? " site-state--inline" : ""}`} role="alert">
      <p className="site-state__title">{title}</p>
      {message && <p>{message}</p>}
      {onRetry && (
        <button type="button" className="site-btn" onClick={onRetry}>
          Reintentar
        </button>
      )}
    </div>
  );
}
