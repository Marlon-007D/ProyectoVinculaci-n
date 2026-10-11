import { useAsync } from "./useAsync";
import { getLastVersion, getVersion, getVersions } from "../services/versions";

export function useVersions(pageId: string | null | undefined) {
  return useAsync(() => (pageId ? getVersions(pageId) : Promise.resolve([])), [pageId]);
}

export function usePageVersion(pageId: string | null | undefined, versionNumber?: number) {
  return useAsync(() => {
    if (!pageId) return Promise.resolve(null);
    return versionNumber ? getVersion(pageId, versionNumber) : getLastVersion(pageId);
  }, [pageId, versionNumber]);
}
