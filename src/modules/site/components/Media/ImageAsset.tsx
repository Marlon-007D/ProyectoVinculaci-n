import { useEffect, useRef, useState } from "react";
import type { MediaAsset } from "../../types/media";
import { getPublicMediaUrl, getPublicUrlFromPath } from "../../utils/mediaUrl";

interface Props {
  asset?: MediaAsset | null;
  path?: string;
  src?: string;
  alt: string;
  width?: number;
  height?: number;
  aspectRatio?: string;
  className?: string;
  bleed?: boolean;
  loading?: "lazy" | "eager";
}

export function ImageAsset({ asset, path, src, alt, width, height, aspectRatio, className = "", bleed = false, loading = "lazy" }: Props) {
  const url = src ?? (asset ? getPublicMediaUrl(asset) : path ? getPublicUrlFromPath(path) : null);
  // The state remembers WHICH url finished or failed, so there is nothing to reset when the url is the same.
  // (Resetting in an effect used to overwrite a load event that fired first and left cached images pulsing forever.)
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const image = useRef<HTMLImageElement>(null);
  const status = !url || failedUrl === url ? "error" : loadedUrl === url ? "loaded" : "loading";

  useEffect(() => {
    // A cached image can finish before React attaches onLoad.
    if (url && image.current?.complete && image.current.naturalWidth > 0) setLoadedUrl(url);
  }, [url]);

  const style = { aspectRatio, maxWidth: bleed ? "none" : "100%" } as const;

  if (!url || status === "error") {
    const decorative = alt === "";
    return (
      <span
        className={`site-img site-img--fallback ${className}`}
        style={style}
        {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": `${alt} (imagen no disponible)` })}
      >
        <span aria-hidden="true">Imagen no disponible</span>
      </span>
    );
  }

  return (
    <span className={`site-img ${status === "loading" ? "site-img--loading" : ""} ${className}`} style={style}>
      <img
        ref={image}
        src={url}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        onLoad={() => setLoadedUrl(url)}
        onError={() => setFailedUrl(url)}
      />
    </span>
  );
}
