import type { MediaAsset } from "../../types/media";
import { formatFileSize, getMediaKind, getPublicMediaUrl } from "../../utils/mediaUrl";
import { ImageAsset } from "./ImageAsset";

interface Props {
  asset: MediaAsset | null | undefined;
  alt?: string;
}

export function MediaPreview({ asset, alt }: Props) {
  if (!asset)
    return <p className="site-media-note" role="status">El archivo solicitado no existe.</p>;

  const url = getPublicMediaUrl(asset);
  if (!url)
    return <p className="site-media-note" role="status">«{asset.file_name}» no está disponible públicamente.</p>;

  switch (getMediaKind(asset.mime_type)) {
    case "image":
      return <ImageAsset asset={asset} alt={alt ?? asset.file_name} />;
    case "video":
      return <video className="site-media" controls preload="metadata" src={url} aria-label={alt ?? asset.file_name} />;
    case "audio":
      return <audio className="site-media" controls preload="metadata" src={url} aria-label={alt ?? asset.file_name} />;
    default:
      return (
        <div className="site-doc">
          <p className="site-doc__name">{asset.file_name}</p>
          <p className="site-doc__meta">{asset.mime_type} — {formatFileSize(asset.file_size)}</p>
          <a className="site-btn" href={url} target="_blank" rel="noopener noreferrer">
            Abrir documento<span className="site-sr-only"> {asset.file_name} (se abre en una pestaña nueva)</span>
          </a>
        </div>
      );
  }
}
