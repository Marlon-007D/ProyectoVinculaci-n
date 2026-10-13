import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAsync } from "../hooks/useAsync";
import { getInstitutionBySlug } from "../services/institutions";
import type { Institution } from "../types/institution";
import { getInstitutionRef } from "../utils/institutionId";
import { ErrorState } from "../components/states/ErrorState";
import { LoadingState } from "../components/states/LoadingState";

interface InstitutionValue {
  institutionId: string;
  institution: Institution | null;
}

const Ctx = createContext<InstitutionValue | null>(null);

export function InstitutionProvider({ children }: { children: ReactNode }) {
  const ref = useMemo(() => getInstitutionRef(), []);
  const found = useAsync(
    () => (ref.id || !ref.slug ? Promise.resolve(null) : getInstitutionBySlug(ref.slug)),
    [ref.id, ref.slug],
  );

  const value = useMemo<InstitutionValue | null>(() => {
    if (ref.id) return { institutionId: ref.id, institution: null };
    if (found.state.status === "success" && found.state.data)
      return { institutionId: found.state.data.institution_id, institution: found.state.data };
    return null;
  }, [ref.id, found.state]);

  if (value) return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
  if (!ref.id && !ref.slug)
    return (
      <ErrorState
        title="No se pudo identificar la institución"
        message="Define VITE_INSTITUTION_SLUG o VITE_INSTITUTION_ID en el .env, o usa ?institution=<slug> en la dirección."
      />
    );
  if (found.state.status === "loading") return <LoadingState label="Cargando institución…" />;
  if (found.state.status === "error")
    return <ErrorState title="No se pudo cargar la institución" message={found.state.error.message} onRetry={found.reload} />;
  return <ErrorState title="Institución no encontrada" message="No existe una institución activa con ese identificador." />;
}

export function useInstitution(): InstitutionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useInstitution debe usarse dentro de <InstitutionProvider>.");
  return v;
}
