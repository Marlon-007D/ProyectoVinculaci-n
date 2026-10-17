import type { ReactNode } from "react";
import { useInstitution } from "../../context/InstitutionContext";
import { useAsync } from "../../hooks/useAsync";
import { isModuleEnabled, type ExternalModule } from "../../services/moduleSettings";

export interface ExternalSectionProps {
  institutionId: string;
  title?: string;
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
  dece_info: { module: "dece", render: Placeholder() },
};

export const EXTERNAL_SECTION_TYPES = Object.keys(EXTERNAL_SECTIONS);

export function ExternalSection({ type, title }: { type: string; title?: string }) {
  const { institutionId } = useInstitution();
  const entry = EXTERNAL_SECTIONS[type];
  const enabled = useAsync(
    () => (entry ? isModuleEnabled(institutionId, entry.module) : Promise.resolve(false)),
    [institutionId, type],
  );
  if (!entry) return null;
  if (enabled.state.status !== "success" || enabled.state.data !== true) return null;
  return <>{entry.render({ institutionId, title })}</>;
}
