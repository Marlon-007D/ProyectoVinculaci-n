import type { PublicationVersion } from "../../types/version";
import { parseSnapshot } from "../../utils/snapshot";
import "../../styles/versions.css";

export function VersionPreview({ version }: { version: PublicationVersion }) {
  const snapshot = parseSnapshot(version.content_snapshot);
  const sections = [...snapshot.sections].sort((a, b) => a.position - b.position);
  return (
    <section className="site-vpreview" aria-label={`Vista previa de la versión ${version.version_number}`}>
      <h3>Versión {version.version_number}{snapshot.title ? `: ${snapshot.title}` : ""}</h3>
      {sections.length === 0 ? (
        <p>Esta versión no tiene secciones reconocibles.</p>
      ) : (
        <div className="site-vpreview__table">
          <table>
            <caption className="site-sr-only">Secciones de la versión {version.version_number}</caption>
            <thead>
              <tr>
                <th scope="col">Posición</th>
                <th scope="col">Tipo</th>
                <th scope="col">Visible</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((s) => (
                <tr key={s.id}>
                  <td>{s.position}</td>
                  <td>{s.type}</td>
                  <td>{s.is_visible ? "Sí" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <details>
        <summary>Ver content_snapshot (JSON)</summary>
        <pre className="site-vpreview__json">{JSON.stringify(version.content_snapshot, null, 2)}</pre>
      </details>
    </section>
  );
}
