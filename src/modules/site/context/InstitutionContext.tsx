import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { useBasePath } from "../hooks/useBasePath";
import { getInstitutionById, getInstitutionBySlug } from "../services/institutions";
import type { Institution } from "../types/institution";
import { getInstitutionRef, type InstitutionRef } from "../utils/institutionId";
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
  /** Private areas pass their own skeleton so no generic loader flashes. */
  loadingFallback?: ReactNode;
  children: ReactNode;
}

export function InstitutionProvider({ institutionId, loadingFallback, children }: Props) {
  const { slug } = useParams();
  const { pathname, search } = useLocation();
  const basePath = useBasePath();
  const ref = useMemo<InstitutionRef>(() => {
    if (institutionId) return { id: institutionId };
    if (slug) return { slug };
    const r = getInstitutionRef();
    return r;
  }, [institutionId, slug, search]);

  const found = useAsync(() => {
    if (ref.id) return getInstitutionById(ref.id);
    if (ref.slug) return getInstitutionBySlug(ref.slug);
    return Promise.resolve(null);
  }, [ref.id, ref.slug]);

  const value = useMemo<InstitutionValue | null>(() => {
    if (found.state.status === "success" && found.state.data)
      return { institutionId: found.state.data.institution_id, institution: found.state.data, basePath };
    return null;
  }, [found.state, basePath]);

  // A resolved institution stays on screen while another one loads, so switching scope never blanks the page.
  const lastValue = useRef<InstitutionValue | null>(null);
  if (value) lastValue.current = value;
  const shown = value ?? (found.state.status === "loading" ? lastValue.current : null);

  if (!ref.id && !ref.slug && (pathname === "/" || pathname === "/panel")) {
    return <Navigate to="/panel/admin" replace />;
  }

  if (shown) return <Ctx.Provider value={shown}>{children}</Ctx.Provider>;
  if (!ref.id && !ref.slug)
    return (
      <>
        <ErrorState
          title="No se pudo identificar la institución"
          message="Entra por la dirección de una institución o define VITE_INSTITUTION_SLUG o VITE_INSTITUTION_ID en el .env."
        />
      </>
    );
  if (found.state.status === "loading") return loadingFallback ?? <LoadingState variant="page" pageKind="content" label="Preparando la institución" />;
  if (found.state.status === "error")
    return (
      <>
        <ErrorState title="No se pudo cargar la institución" message={found.state.error.message} onRetry={found.reload} />
      </>
    );
  return (
    <>
      <ErrorState
        title="Institución no encontrada"
        message="No existe una institución activa con ese identificador. Ejecuta las secciones 13 y 14 de database/script.sql para crear la institución de prueba 'colegio-demo'."
      />
    </>
  );
}

export function useInstitution(): InstitutionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useInstitution debe usarse dentro de <InstitutionProvider>.");
  return v;
}
