import { Route, Routes } from "react-router-dom";
import { InstitutionProvider } from "./context/InstitutionContext";
import { SiteLayout } from "./components/Layout/SiteLayout";
import { NotFound } from "./pages/NotFound";
import { SitePreview } from "./pages/SitePreview";
import "./styles/site.css";

export function SiteApp() {
  return (
    <InstitutionProvider>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<SitePreview />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </InstitutionProvider>
  );
}
