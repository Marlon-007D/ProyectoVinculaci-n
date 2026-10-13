import { useEffect, useState } from "react";
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
  loading?: "lazy" | "eager";
}

export function ImageAsset({ asset, path, src, alt, width, height, aspectRatio, className = "", loading = "lazy" }: Props) {
  const url = src ?? (asset ? getPublicMediaUrl(asset) : path ? getPublicUrlFromPath(path) : null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(url ? "loading" : "error");

  useEffect(() => setStatus(url ? "loading" : "error"), [url]);

  const style = { aspectRatio, maxWidth: "100%" } as const;

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
        src={url}
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
      />
    </span>
  );
}
