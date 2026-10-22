import { useMediaList } from "../../hooks/useMedia";
import type { MediaAsset } from "../../types/media";
import { asString } from "../../utils/snapshot";
import { getMediaKind } from "../../utils/mediaUrl";
import { ImageAsset } from "../Media/ImageAsset";

export interface GalleryItem {
  media_id: string;
  alt?: string;
  caption?: string;
}

export function galleryItems(v: unknown): GalleryItem[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null && typeof x.media_id === "string")
    .map((x) => ({ media_id: x.media_id as string, alt: asString(x.alt), caption: asString(x.caption) }));
}

const MAX_ITEMS = 24;

export function GallerySection({ title, items, limit }: { title?: string; items: GalleryItem[]; limit?: number }) {
  const media = useMediaList(true);
  if (items.length === 0 || media.state.status !== "success") return null;

  const byId = new Map<string, MediaAsset>(media.state.data.map((a) => [a.media_asset_id, a]));
  const max = Math.min(limit ?? MAX_ITEMS, MAX_ITEMS);
  const picked = items
    .map((item) => ({ item, asset: byId.get(item.media_id) }))
    .filter((x): x is { item: GalleryItem; asset: MediaAsset } =>
      x.asset !== undefined && getMediaKind(x.asset.mime_type) === "image",
    )
    .slice(0, max);
  if (picked.length === 0) return null;

  return (
    <section className="site-section site-block">
      <div className="site-container">
        {title && <h2>{title}</h2>}
        <ul className="site-gallery">
          {picked.map(({ item, asset }) => (
            <li key={asset.media_asset_id} className="site-gallery__item">
              <figure>
                <ImageAsset asset={asset} alt={item.alt || asset.file_name} aspectRatio="4 / 3" />
                {item.caption && <figcaption>{item.caption}</figcaption>}
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
