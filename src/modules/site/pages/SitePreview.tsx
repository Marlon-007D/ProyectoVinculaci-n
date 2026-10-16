import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AsyncView } from "../components/states/AsyncView";
import { MediaPreview } from "../components/Media/MediaPreview";
import { PageSections } from "../components/Page/PageSections";
import { VersionList } from "../components/Version/VersionList";
import { VersionPreview } from "../components/Version/VersionPreview";
import { isDemoMode, setDemoMode } from "../lib/demo";
import { useMediaList } from "../hooks/useMedia";
import { usePage } from "../hooks/usePage";
import { usePageVersion, useVersions } from "../hooks/useVersions";
import { parseSnapshot } from "../utils/snapshot";

export function SitePreview() {
  const [params] = useSearchParams();
  const files = useMediaList();
  const page = usePage(params.get("slug") ?? undefined);
  const pageId = page.state.status === "success" ? page.state.data.page_id : null;
  const versions = useVersions(pageId);
  const [selected, setSelected] = useState<number | undefined>();
  const current = usePageVersion(pageId, selected);

  return (
    <>
      {isDemoMode() && (
        <div className="site-demo-banner" role="status">
          Modo demostración: datos de ejemplo, no vienen de Supabase.
          <button
            type="button"
            onClick={() => {
              setDemoMode(false);
              window.location.href = window.location.pathname + "?demo=0";
            }}
          >
            Salir
          </button>
        </div>
      )}

      <AsyncView
        state={current.state}
        onRetry={current.reload}
        emptyTitle="No hay página publicada"
        emptyMessage="Marca una página como inicio y publica una versión, o agrega ?slug=mi-pagina a la dirección."
      >
        {(v) => <PageSections sections={parseSnapshot(v.content_snapshot).sections} />}
      </AsyncView>

      <div className="site-container site-section site-debug">
        <details>
          <summary>Información técnica (archivos y versiones)</summary>

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
          <AsyncView state={page.state} onRetry={page.reload} emptyTitle="No hay página publicada">
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
        </details>
      </div>
    </>
  );
}
