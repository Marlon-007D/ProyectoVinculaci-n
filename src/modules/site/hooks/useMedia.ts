import { useAsync } from "./useAsync";
import { useInstitution } from "../context/InstitutionContext";
import { getMedia, getMediaList } from "../services/media";

export function useMediaList(publicOnly = true) {
  const { institutionId } = useInstitution();
  return useAsync(() => getMediaList(institutionId, { publicOnly }), [institutionId, publicOnly]);
}

export function useMedia(mediaAssetId: string | undefined) {
  return useAsync(
    () => (mediaAssetId ? getMedia(mediaAssetId) : Promise.resolve(null)),
    [mediaAssetId],
  );
}
