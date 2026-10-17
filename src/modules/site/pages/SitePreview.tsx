import { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { AsyncView } from "../components/states/AsyncView";
import { PageSections } from "../components/Page/PageSections";
import { usePage } from "../hooks/usePage";
import { usePageVersion } from "../hooks/useVersions";
import { parseSnapshot } from "../utils/snapshot";
import { PortalSimulatorsPage } from "../../../features/simulators/pages/PortalSimulatorsPage";
import { SchoolCoursesPage } from "../../../features/courses/pages/SchoolCoursesPage";

export function SitePreview() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const selectedModuleId = params.get("module");
  const selectedCourseId = params.get("course");
  const [evaluationActive, setEvaluationActive] = useState(false);
  const page = usePage(params.get("slug") ?? undefined);
  const pageId = page.state.status === "success" ? page.state.data.page_id : null;
  const current = usePageVersion(pageId, undefined);
  if (params.get("simulator")) return <PortalSimulatorsPage />;
  if (params.get("courses") === "1") return <SchoolCoursesPage selectedModuleId={selectedModuleId} selectedCourseId={selectedCourseId} evaluationActive={evaluationActive} onSelectModule={moduleId => setParams(current => { const next = new URLSearchParams(current); next.set("courses", "1"); next.set("module", moduleId); next.delete("course"); return next })} onSelectCourse={courseId => setParams(current => { const next = new URLSearchParams(current); next.set("course", courseId); return next })} courseHrefFor={courseId => { const next = new URLSearchParams(params); if (selectedModuleId) next.set("module", selectedModuleId); next.set("course", courseId); next.set("courses", "1"); return `${location.pathname}?${next.toString()}` }} onBackToModules={() => { setEvaluationActive(false); setParams(current => { const next = new URLSearchParams(current); next.delete("module"); next.delete("course"); return next }) }} onBackToModule={() => { setEvaluationActive(false); setParams(current => { const next = new URLSearchParams(current); next.delete("course"); return next }) }} onEvaluationChange={setEvaluationActive} />;

  return (
    <>
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
