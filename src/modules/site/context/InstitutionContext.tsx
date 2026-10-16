import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { useBasePath } from "../hooks/useBasePath";
import { getInstitutionBySlug } from "../services/institutions";
import type { Institution } from "../types/institution";
import { getInstitutionRef, type InstitutionRef } from "../utils/institutionId";
import { isDemoMode, setDemoMode } from "../lib/demo";
import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";

interface InstitutionValue {
  institutionId: string;
  institution: Institution | null;
  basePath: string;
}

const Ctx = createContext<InstitutionValue | null>(null);

interface Props {
  institutionId?: string;
  children: ReactNode;
}

export function InstitutionProvider({ institutionId, children }: Props) {
  const { slug } = useParams();
  const basePath = useBasePath();
  const ref = useMemo<InstitutionRef>(() => {
    if (institutionId) return { id: institutionId };
    if (slug) return { slug };
    const r = getInstitutionRef();
    return !r.id && !r.slug && isDemoMode() ? { slug: "colegio-demo" } : r;
  }, [institutionId, slug]);

  const found = useAsync(
    () => (ref.id || !ref.slug ? Promise.resolve(null) : getInstitutionBySlug(ref.slug)),
    [ref.id, ref.slug],
  );

  const value = useMemo<InstitutionValue | null>(() => {
    if (ref.id) return { institutionId: ref.id, institution: null, basePath };
    if (found.state.status === "success" && found.state.data)
      return { institutionId: found.state.data.institution_id, institution: found.state.data, basePath };
    return null;
  }, [ref.id, found.state, basePath]);

  if (value) return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  if (!ref.id && !ref.slug)
    return (
      <>
        <ErrorState
          title="No se pudo identificar la institución"
          message="Entra por la dirección de una institución o define VITE_INSTITUTION_SLUG o VITE_INSTITUTION_ID en el .env."
        />
        <DemoButton />
      </>
    );
  if (found.state.status === "loading") return <LoadingState label="Cargando institución…" />;
  if (found.state.status === "error")
    return (
      <>
        <ErrorState title="No se pudo cargar la institución" message={found.state.error.message} onRetry={found.reload} />
        <DemoButton />
      </>
    );
  return (
    <>
      <ErrorState
        title="Institución no encontrada"
        message="No existe una institución activa con ese identificador. Ejecuta las secciones 13 y 14 de database/script.sql para crear la institución de prueba 'colegio-demo'."
      />
      <DemoButton />
    </>
  );
}

function DemoButton() {
  return (
    <div style={{ textAlign: "center", margin: "1rem" }}>
      <button
        type="button"
        className="site-btn site-btn--primary"
        onClick={() => {
          setDemoMode(true);
          window.location.reload();
        }}
      >
        Ver el portal en modo demostración
      </button>
      <p style={{ fontSize: ".9rem" }}>Usa datos de ejemplo sin necesitar la base de datos.</p>
    </div>
  );
}

export function useInstitution(): InstitutionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useInstitution debe usarse dentro de <InstitutionProvider>.");
  return v;
}
