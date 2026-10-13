import { Link } from "react-router-dom";
import { EmptyState } from "../components/states/EmptyState";

export function NotFound() {
  return (
    <div className="site-container site-section">
      <EmptyState title="Página no encontrada" message="La dirección no corresponde a ninguna página.">
        <Link className="site-btn" to="/">Ir al inicio</Link>
      </EmptyState>
    </div>
  );
}
