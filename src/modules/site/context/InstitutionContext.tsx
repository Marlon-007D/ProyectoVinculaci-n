import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getInstitutionId } from "../utils/institutionId";
import { ErrorState } from "../components/states/ErrorState";

interface InstitutionValue {
  institutionId: string;
}

const Ctx = createContext<InstitutionValue | null>(null);

export function InstitutionProvider({ institutionId, children }: { institutionId?: string; children: ReactNode }) {
  const id = institutionId ?? getInstitutionId();
  const value = useMemo(() => (id ? { institutionId: id } : null), [id]);
  if (!value)
    return (
      <ErrorState
        title="No se pudo identificar la institución"
        message="Falta VITE_INSTITUTION_ID en el .env (o ?institution=<uuid> en la dirección)."
      />
    );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInstitution(): InstitutionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useInstitution debe usarse dentro de <InstitutionProvider>.");
  return v;
}
