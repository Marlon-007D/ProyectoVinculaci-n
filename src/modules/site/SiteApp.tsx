import { Route, Routes } from "react-router-dom";
import { InstitutionProvider } from "./context/InstitutionContext";
import { EmbeddedLayout } from "./components/Layout/EmbeddedLayout";
import { SiteLayout } from "./components/Layout/SiteLayout";
import { NotFound } from "./pages/NotFound";
import { SitePreview } from "./pages/SitePreview";
import { FeatsLoginPage } from "../../features/feats/pages/FeatsLoginPage";
import { localDemoAuthService } from "../../features/feats/services/featsAuth";
import "./styles/site.css";

interface Props {
  institutionId?: string;
  embedded?: boolean;
}

export function SiteApp({ institutionId, embedded = false }: Props) {
  return (
    <InstitutionProvider institutionId={institutionId}>
      <Routes>
        <Route path="/admin-cursos" element={<FeatsLoginPage authService={localDemoAuthService} />} />
        <Route element={embedded ? <EmbeddedLayout /> : <SiteLayout />}>
          <Route index element={<SitePreview />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </InstitutionProvider>
  );
}
