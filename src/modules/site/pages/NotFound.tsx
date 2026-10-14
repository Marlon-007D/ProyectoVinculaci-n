import { Link } from "react-router-dom";
import { EmptyState } from "../components/states/EmptyState";
import { useInstitution } from "../context/InstitutionContext";

export function NotFound() {
  const { basePath } = useInstitution();
  return (
    <div className="site-container site-section">
      <EmptyState title="Página no encontrada" message="La dirección no corresponde a ninguna página.">
        <Link className="site-btn" to={basePath || "/"}>Ir al inicio</Link>
      </EmptyState>
    </div>
  );
}
