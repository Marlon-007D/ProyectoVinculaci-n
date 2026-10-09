import { AsyncView } from "../components/states/AsyncView";
import { MediaPreview } from "../components/Media/MediaPreview";
import { MobileNavigation } from "../components/Navigation/MobileNavigation";
import { Navigation } from "../components/Navigation/Navigation";
import { useMediaList } from "../hooks/useMedia";
import { useMenus } from "../hooks/useMenus";
import "../styles/site.css";

export function SitePreview() {
  const menu = useMenus();
  const files = useMediaList();
  return (
    <div className="site-root">
      <div className="site-container">
        <h1>Vista de prueba</h1>
        <p>Página temporal de desarrollo (Fases 2 y 3).</p>

        <h2>Menú</h2>
        <AsyncView state={menu.state} onRetry={menu.reload} emptyMessage="Esta institución aún no tiene menús.">
          {(tree) => (
            <>
              <div className="site-preview__desktop"><Navigation tree={tree} /></div>
              <div className="site-preview__mobile"><MobileNavigation tree={tree} /></div>
            </>
          )}
        </AsyncView>

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
      </div>
    </div>
  );
}
