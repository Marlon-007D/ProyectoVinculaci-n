import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AsyncView } from "../components/states/AsyncView";
import { PageSections } from "../components/Page/PageSections";
import { usePage } from "../hooks/usePage";
import { usePageVersion } from "../hooks/useVersions";
import { parseSnapshot } from "../utils/snapshot";
import { PortalSimulatorsPage } from "../../../features/simulators/pages/PortalSimulatorsPage";
import { SchoolCoursesPage } from "../../../features/courses/pages/SchoolCoursesPage";

export function SitePreview() {
  const [params] = useSearchParams();
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [evaluationActive, setEvaluationActive] = useState(false);
  const page = usePage(params.get("slug") ?? undefined);
  const pageId = page.state.status === "success" ? page.state.data.page_id : null;
  const current = usePageVersion(pageId, undefined);
  if (params.get("simulator")) return <PortalSimulatorsPage />;
  if (params.get("courses") === "1") return <SchoolCoursesPage selectedModuleId={selectedModuleId} selectedCourseId={selectedCourseId} evaluationActive={evaluationActive} onSelectModule={moduleId => { setSelectedModuleId(moduleId); setSelectedCourseId(null) }} onSelectCourse={setSelectedCourseId} onEvaluationChange={setEvaluationActive} />;

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
