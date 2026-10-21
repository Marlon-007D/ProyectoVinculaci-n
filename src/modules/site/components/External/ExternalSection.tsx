import { lazy, Suspense, type ReactNode } from "react";
import { useInstitution } from "../../context/InstitutionContext";
import { useAsync } from "../../hooks/useAsync";
import { isModuleEnabled, isPublicModuleEnabled, type ExternalModule } from "../../services/moduleSettings";
import { PortalSimulatorsPage } from "../../../../features/simulators/pages/PortalSimulatorsPage";

export interface ExternalSectionProps {
  institutionId: string;
  title?: string;
  properties?: Record<string, unknown>;
}

type Renderer = (props: ExternalSectionProps) => ReactNode;

function Placeholder(): Renderer {
  return function PlaceholderSection({ title }: ExternalSectionProps) {
    return (
      <section className="site-section site-block">
        <div className="site-container">
          {title && <h2>{title}</h2>}
          <p className="site-muted">Esta sección estará disponible próximamente.</p>
        </div>
      </section>
    );
  };
}

export const EXTERNAL_SECTIONS: Record<string, { module: ExternalModule; render: Renderer }> = {
  transparency: { module: "projects", render: Placeholder() },
  simulators: { module: "simuladores", render: Placeholder() },
  dece_info: {
    module: "dece",
    render: ({ institutionId, title, properties }) => (
      <Suspense fallback={null}>
        <DecePublicSection institutionId={institutionId} title={title} properties={properties} />
      </Suspense>
    ),
  },
};

const DecePublicSection = lazy(() =>
  import("../../../dece/public").then(({ DecePublicSection: Component }) => ({ default: Component })),
);

export const EXTERNAL_SECTION_TYPES = Object.keys(EXTERNAL_SECTIONS);

export function ExternalSection({ type, title, properties }: { type: string; title?: string; properties?: Record<string, unknown> }) {
  if (type === "simulators") return <PortalSimulatorsPage />;
  return <EnabledExternalSection type={type} title={title} properties={properties} />;
}

function EnabledExternalSection({ type, title, properties }: { type: string; title?: string; properties?: Record<string, unknown> }) {
  const { institutionId, institution } = useInstitution();
  const entry = EXTERNAL_SECTIONS[type];
  const enabled = useAsync(
    () => {
      if (!entry) return Promise.resolve(false);
      if (type === "dece_info") {
        return institution?.slug ? isPublicModuleEnabled(institution.slug, "dece") : Promise.resolve(false);
      }
      return isModuleEnabled(institutionId, entry.module);
    },
    [institutionId, institution?.slug, type],
  );
  if (!entry) return null;
  if (type === "dece_info" && enabled.state.status === "error") {
    return (
      <section className="site-section site-block">
        <div className="site-container">
          <p role="alert">No se pudo comprobar si el modulo DECE esta habilitado.</p>
          {import.meta.env.DEV && <p className="site-muted">{enabled.state.error.message}</p>}
          <button type="button" className="site-btn" onClick={enabled.reload}>Reintentar</button>
        </div>
      </section>
    );
  }
  if (enabled.state.status !== "success" || enabled.state.data !== true) return null;
  return <>{entry.render({ institutionId, title, properties })}</>;
}
