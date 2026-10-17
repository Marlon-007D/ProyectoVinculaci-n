import { useSearchParams } from "react-router-dom";
import { AsyncView } from "../components/states/AsyncView";
import { PageSections } from "../components/Page/PageSections";
import { isDemoMode, setDemoMode } from "../lib/demo";
import { usePage } from "../hooks/usePage";
import { usePageVersion } from "../hooks/useVersions";
import { parseSnapshot } from "../utils/snapshot";

export function SitePreview() {
  const [params] = useSearchParams();
  const page = usePage(params.get("slug") ?? undefined);
  const pageId = page.state.status === "success" ? page.state.data.page_id : null;
  const current = usePageVersion(pageId, undefined);

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
        emptyMessage="Esta dirección no tiene una página publicada."
      >
        {(v) => <PageSections sections={parseSnapshot(v.content_snapshot).sections} />}
      </AsyncView>
    </>
  );
}
