import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AsyncView } from "../components/states/AsyncView";
import { MediaPreview } from "../components/Media/MediaPreview";
import { VersionList } from "../components/Version/VersionList";
import { VersionPreview } from "../components/Version/VersionPreview";
import { useMediaList } from "../hooks/useMedia";
import { usePage } from "../hooks/usePage";
import { usePageVersion, useVersions } from "../hooks/useVersions";

export function SitePreview() {
  const [params] = useSearchParams();
  const files = useMediaList();
  const page = usePage(params.get("slug") ?? undefined);
  const pageId = page.state.status === "success" ? page.state.data.page_id : null;
  const versions = useVersions(pageId);
  const [selected, setSelected] = useState<number | undefined>();
  const current = usePageVersion(pageId, selected);

  return (
    <div className="site-container site-section">
      <h1>Vista de prueba</h1>
      <p>Página temporal de desarrollo (Fases 3 a 5).</p>

      <h2>Archivos públicos</h2>
      <AsyncView state={files.state} onRetry={files.reload} emptyMessage="No hay archivos públicos.">
        {(list) => (
          <ul className="site-grid">
            {list.map((a) => (
              <li key={a.media_asset_id} className="site-card"><MediaPreview asset={a} /></li>
            ))}
          </ul>
        )}
      </AsyncView>

      <h2>Versiones de la página</h2>
      <AsyncView
        state={page.state}
        onRetry={page.reload}
        emptyTitle="No hay página publicada"
        emptyMessage="Agrega ?slug=mi-pagina a la dirección o marca una página como inicio."
      >
        {(p) => (
          <>
            <p>Página: <strong>{p.title}</strong> ({p.slug})</p>
            <AsyncView state={versions.state} onRetry={versions.reload} emptyTitle="Esta página aún no tiene versiones">
              {(list) => <VersionList versions={list} selected={selected} onSelect={setSelected} />}
            </AsyncView>
            <AsyncView state={current.state} onRetry={current.reload} emptyTitle="No existe esa versión">
              {(v) => <VersionPreview version={v} />}
            </AsyncView>
          </>
        )}
      </AsyncView>
    </div>
  );
}
