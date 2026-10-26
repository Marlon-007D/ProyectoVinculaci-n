import { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { AsyncView } from "../components/states/AsyncView";
import { PageSections } from "../components/Page/PageSections";
import { usePage } from "../hooks/usePage";
import { usePageVersion } from "../hooks/useVersions";
import { parseSnapshot } from "../utils/snapshot";
import { PortalSimulatorsPage } from "../../../features/simulators/pages/PortalSimulatorsPage";
import { SchoolCoursesPage } from "../../../features/courses/pages/SchoolCoursesPage";
import { AcademicPostPreviewPage } from "../../../features/academic-content/pages/AcademicPostPreviewPage";
import { useEventArticle, useNewsArticle } from "../hooks/useContent";
import { HonorsSection } from "../components/Content/ContentSections";
import honorsStyles from "../components/Content/HonorsSection.module.css";

export function SitePreview() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const selectedModuleId = params.get("module");
  const selectedCourseId = params.get("course");
  const newsId = params.get("noticia");
  const eventId = params.get("evento");
  const [evaluationActive, setEvaluationActive] = useState(false);
  const page = usePage(params.get("slug") ?? undefined);
  const article = useNewsArticle(newsId);
  const eventArticle = useEventArticle(eventId);
  const pageId = page.state.status === "success" ? page.state.data.page_id : null;
  const current = usePageVersion(pageId, undefined);
  if (params.get("simulator")) return <PortalSimulatorsPage />;
  if (params.get("honores") === "1") return <main className={`site-honors-page ${honorsStyles.page}`}>
    <HonorsSection title="Distinciones oficiales" limit={100} className={honorsStyles.section} />
  </main>;
  if (params.get("courses") === "1") return <SchoolCoursesPage selectedModuleId={selectedModuleId} selectedCourseId={selectedCourseId} evaluationActive={evaluationActive} onSelectModule={moduleId => setParams(current => { const next = new URLSearchParams(current); next.set("courses", "1"); next.set("module", moduleId); next.delete("course"); return next })} onSelectCourse={courseId => setParams(current => { const next = new URLSearchParams(current); next.set("course", courseId); return next })} courseHrefFor={courseId => { const next = new URLSearchParams(params); if (selectedModuleId) next.set("module", selectedModuleId); next.set("course", courseId); next.set("courses", "1"); return `${location.pathname}?${next.toString()}` }} onBackToModules={() => { setEvaluationActive(false); setParams(current => { const next = new URLSearchParams(current); next.delete("module"); next.delete("course"); return next }) }} onBackToModule={() => { setEvaluationActive(false); setParams(current => { const next = new URLSearchParams(current); next.delete("course"); return next }) }} onEvaluationChange={setEvaluationActive} />;
  if (newsId) return <AsyncView state={article.state} onRetry={article.reload} loadingVariant="article" emptyTitle="No encontramos esta noticia" emptyMessage="Puede que se haya retirado o que el enlace no sea válido.">
    {(entry) => <AcademicPostPreviewPage entry={entry} onBack={() => setParams(current => { const next = new URLSearchParams(current); next.delete("noticia"); return next; })} />}
  </AsyncView>;
  if (eventId) return <AsyncView state={eventArticle.state} onRetry={eventArticle.reload} loadingVariant="article" emptyTitle="No encontramos este evento" emptyMessage="Puede que se haya retirado o que el enlace no sea válido.">
    {(entry) => <AcademicPostPreviewPage entry={entry} onBack={() => setParams(current => { const next = new URLSearchParams(current); next.delete("evento"); return next; })} />}
  </AsyncView>;

  return (
    <>
      <AsyncView
        state={current.state}
        onRetry={current.reload}
        loadingVariant="page"
        emptyTitle="No hay página publicada"
        emptyMessage="Esta dirección no tiene una página publicada."
      >
        {(v) => {
          const snapshot = parseSnapshot(v.content_snapshot);
          return <PageSections sections={snapshot.sections} template={snapshot.template} isHomepage={page.state.status === "success" && page.state.data.is_homepage} managed={Boolean((v.content_snapshot as Record<string, unknown>)?.publication_state)} />;
        }}
      </AsyncView>
    </>
  );
}
