import type { CSSProperties, ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSite } from "../../hooks/useSite";
import type { PageSection } from "../../types/page";
import { asString } from "../../utils/snapshot";
import { isSafeExternalUrl, keepInstitution } from "../../utils/url";
import { EventsSection, HonorsSection, NewsSection, StaffSection } from "../Content/ContentSections";
import { EXTERNAL_SECTION_TYPES, ExternalSection } from "../External/ExternalSection";
import { GallerySection, galleryItems } from "../Gallery/GallerySection";
import "../../styles/sections.css";

type Item = { title?: string; description?: string; url?: string };

const SAFE_IMAGE = /^(https:\/\/[^\s"\'()<>\\]+|\/images\/[A-Za-z0-9_\/.-]+\.(svg|png|jpe?g|webp))$/;

function items(v: unknown): Item[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      title: asString(x.title ?? x.label ?? x.name),
      description: asString(x.description ?? x.body ?? x.text),
      url: asString(x.url),
    }));
}

function SafeLink({ url, className, children }: { url: string; className?: string; children: ReactNode }) {
  const { search } = useLocation();
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) {
    if (!isSafeExternalUrl(url)) return <span className={className}>{children}</span>;
    const web = /^https?:/i.test(url);
    return (
      <a className={className} href={url} {...(web ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        {children}
      </a>
    );
  }
  return <Link className={className} to={keepInstitution(url, search)}>{children}</Link>;
}

function Paragraphs({ text }: { text?: string }) {
  if (!text) return null;
  return <>{text.split(/\n+/).map((t, i) => <p key={i}>{t}</p>)}</>;
}

function SocialSection({ title = "Síguenos" }: { title?: string }) {
  const { config } = useSite();
  if (config.social.length === 0) return null;
  return (
    <section className="site-section site-block">
      <div className="site-container">
        <h2>{title}</h2>
        <ul className="site-chips">
          {config.social.map((s) => (
            <li key={s.url}>
              <a className="site-btn" href={s.url} target="_blank" rel="noopener noreferrer">
                {s.label}<span className="site-sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Section({ s }: { s: PageSection }) {
  const p = s.properties;
  const title = s.type === "events" ? "Eventos" : asString(p.title);
  const limit = typeof p.limit === "number" && p.limit > 0 ? Math.min(p.limit, 24) : undefined;

  if (s.type === "banner" || s.type === "hero") {
    const b1 = asString(p.button_label), u1 = asString(p.button_url);
    const b2 = asString(p.secondary_label), u2 = asString(p.secondary_url);
    const eyebrow = asString(p.eyebrow);
    const image = asString(p.image_url);
    const heroStyle = image && SAFE_IMAGE.test(image) ? ({ "--site-hero-image": `url("${image}")` } as CSSProperties) : undefined;
    return (
      <section className={`site-hero${p.size === "compact" ? " site-hero--compact" : ""}`} style={heroStyle}>
        <div className="site-container">
          {eyebrow && <p className="site-hero__eyebrow">{eyebrow}</p>}
          {title && <h2>{title}</h2>}
          {asString(p.subtitle) && <p>{asString(p.subtitle)}</p>}
          {(b1 && u1) || (b2 && u2) ? (
            <div className="site-hero__actions">
              {b1 && u1 && <SafeLink url={u1} className="site-btn site-btn--primary">{b1}</SafeLink>}
              {b2 && u2 && <SafeLink url={u2} className="site-btn site-btn--ghost">{b2}</SafeLink>}
            </div>
          ) : null}
        </div>
      </section>
    );
  }

  if (s.type === "news") return <NewsSection title={title} limit={limit} />;
  if (s.type === "events") return <EventsSection title={title} limit={limit} />;
  if (s.type === "staff") return <StaffSection title={title} />;
  if (s.type === "honors") return <HonorsSection title={title} limit={limit} />;
  if (s.type === "social_links") return <SocialSection title={title} />;

  if (s.type === "gallery")
    return <GallerySection title={title} items={galleryItems(p.items)} limit={limit} />;

  if (EXTERNAL_SECTION_TYPES.includes(s.type)) return <ExternalSection type={s.type} title={title} properties={p} />;

  const list = items(p.items);
  const body = asString(p.body ?? p.text ?? p.content);

  if (s.type === "links")
    return (
      <section className="site-section site-block">
        <div className="site-container">
          {title && <h2>{title}</h2>}
          <Paragraphs text={body} />
          <ul className="site-cards">
            {list.filter((it) => it.url).map((it, i) => (
              <li key={i} className="site-card site-linkcard">
                <h3><SafeLink url={it.url!}>{it.title ?? it.url}</SafeLink></h3>
                {it.description && <p className="site-muted">{it.description}</p>}
              </li>
            ))}
          </ul>
        </div>
      </section>
    );

  const eyebrow = asString(p.eyebrow);
  const tone = p.tone === "dark" ? " site-block--dark" : p.tone === "tint" ? " site-block--tint" : "";
  return (
    <section className={`site-section site-block${tone}`}>
      <div className="site-container">
        {eyebrow && <p className="site-eyebrow">{eyebrow}</p>}
        {title && <h2>{title}</h2>}
        <Paragraphs text={body} />
        {list.length > 0 && p.layout === "stats" ? (
          <ul className="site-stats">
            {list.map((it, i) => (
              <li key={i}>
                <strong>{it.title}</strong>
                <span>{it.description}</span>
              </li>
            ))}
          </ul>
        ) : list.length > 0 ? (
          <ul className="site-cards">
            {list.map((it, i) => (
              <li key={i} className="site-card">
                {it.title && <h3>{it.title}</h3>}
                {it.description && <p>{it.description}</p>}
              </li>
            ))}
          </ul>
        ) : null}
        {!body && list.length === 0 && !title && <p className="site-muted">Sección «{s.type}» sin contenido.</p>}
      </div>
    </section>
  );
}

export function PageSections({ sections }: { sections: PageSection[] }) {
  const visible = sections.filter((s) => s.is_visible).sort((a, b) => a.position - b.position);
  if (visible.length === 0) return <p className="site-container site-section">Esta página aún no tiene contenido.</p>;
  return <>{visible.map((s) => <Section key={s.id} s={s} />)}</>;
}
