import type { PublicationVersion } from "../../types/version";
import "../../styles/versions.css";

interface Props {
  versions: PublicationVersion[];
  selected?: number;
  onSelect: (versionNumber: number) => void;
}

const formatDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : new Intl.DateTimeFormat("es-EC", { dateStyle: "medium", timeStyle: "short" }).format(d);
};

export function VersionList({ versions, selected, onSelect }: Props) {
  const last = Math.max(...versions.map((v) => v.version_number));
  const current = selected ?? last;
  return (
    <ul className="site-versions">
      {versions.map((v) => (
        <li key={v.publication_version_id}>
          <button
            type="button"
            className="site-versions__item"
            aria-pressed={v.version_number === current}
            onClick={() => onSelect(v.version_number)}
          >
            <span>Versión {v.version_number}</span>
            <span className="site-versions__date">{formatDate(v.created_at)}</span>
            {v.version_number === last && <span className="site-versions__badge">Última</span>}
          </button>
        </li>
      ))}
    </ul>
  );
}
