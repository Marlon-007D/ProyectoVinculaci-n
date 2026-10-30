import type { CSSProperties, ReactNode } from "react";
import type { SocialLink } from '../../types/site';
import { Link, useLocation } from "react-router-dom";
import { useSite } from "../../hooks/useSite";
import { useInstitution } from "../../context/InstitutionContext";
import type { PageSection } from "../../types/page";
import { asString } from "../../utils/snapshot";
import { isSafeExternalUrl, keepInstitution } from "../../utils/url";
import { EventsSection, HonorsSection, NewsSection, StaffSection } from "../Content/ContentSections";
import { EXTERNAL_SECTION_TYPES, ExternalSection } from "../External/ExternalSection";
import { GallerySection, galleryItems } from "../Gallery/GallerySection";
import { EDUCATION_LEVEL_IMAGES, PUBLIC_PAGE_SAMPLES } from "../../mocks/publicPageSamples";
import "../../styles/sections.css";
import templateStyles from './PageSections.module.css';

type Item = { title?: string; description?: string; url?: string; imageUrl?: string; imageAlt?: string; linkLabel?: string; icon?: string };

const SAFE_IMAGE = /^(https:\/\/[^\s"\'()<>\\]+|\/images\/[A-Za-z0-9_\/.-]+\.(svg|png|jpe?g|webp))$/;

function items(v: unknown): Item[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      title: asString(x.title ?? x.label ?? x.name),
      description: asString(x.description ?? x.body ?? x.text),
      url: asString(x.url),
      imageUrl: asString(x.image_url ?? x.imageUrl),
      imageAlt: asString(x.image_alt ?? x.imageAlt ?? x.alt),
      linkLabel: asString(x.link_label ?? x.linkLabel),
      icon: asString(x.icon),
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

function normalizeText(value: unknown): string {
  return (asString(value) ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function sectionTitle(section: PageSection): string {
  return normalizeText(section.properties.title);
}

function sampleLevelImage(title: string | undefined, index: number): string {
  const normalized = normalizeText(title);
  if (normalized.includes("preescolar") || normalized.includes("inicial")) return EDUCATION_LEVEL_IMAGES.preschool;
  if (normalized.includes("bachillerato")) return EDUCATION_LEVEL_IMAGES.highSchool;
  return index === 0 ? EDUCATION_LEVEL_IMAGES.preschool : EDUCATION_LEVEL_IMAGES.elementary;
}

function enrichEducationLevels(section: PageSection, fallback: PageSection): PageSection {
  const existingItems = items(section.properties.items);
  const fallbackItems = items(fallback.properties.items);
  const levels = (existingItems.length ? existingItems : fallbackItems).map((item, index) => ({
    ...item,
    image_url: item.imageUrl || sampleLevelImage(item.title, index),
    image_alt: item.imageAlt || `Actividad de aprendizaje para ${item.title ?? "estudiantes"}`,
    url: item.url || "/?slug=contacto",
    link_label: item.linkLabel || "Leer más",
  }));
  return {
    ...section,
    properties: {
      ...fallback.properties,
      ...section.properties,
      layout: "education-levels",
      title: asString(section.properties.title) || asString(fallback.properties.title),
      body: asString(section.properties.body ?? section.properties.text) || asString(fallback.properties.body),
      items: levels,
    },
  };
}

function standardizeInformationalPage(sections: PageSection[], slug: string): PageSection[] {
  const samples = PUBLIC_PAGE_SAMPLES[slug];
  if (!samples) return sections;
  const result = [...sections];
  const addSample = (id: string) => {
    const sample = samples.find((section) => section.id === id);
    if (sample) result.push(sample);
  };

  if (!result.some((section) => section.type === "banner" || section.type === "hero")) addSample(`sample-${slug === "nosotros" ? "about" : slug === "contacto" ? "contact" : "offer"}-intro`);

  if (slug === "oferta-educativa") {
    const levelFallback = samples.find((section) => section.id === "sample-offer-levels");
    const currentIndex = result.findIndex((section) => sectionTitle(section).includes("nivel educativo") || section.properties.layout === "education-levels");
    if (levelFallback && currentIndex >= 0) result[currentIndex] = enrichEducationLevels(result[currentIndex], levelFallback);
    else addSample("sample-offer-levels");
  }

  if (slug === "nosotros") {
    const storyFallback = samples.find((section) => section.id === "sample-about-story");
    const storyIndex = result.findIndex((section) => sectionTitle(section).includes("historia") || section.properties.layout === "story");
    if (storyFallback && storyIndex >= 0) {
      const current = result[storyIndex];
      result[storyIndex] = {
        ...current,
        properties: {
          ...storyFallback.properties,
          ...current.properties,
          layout: "story",
          image_url: asString(current.properties.image_url) || storyFallback.properties.image_url,
          alt: asString(current.properties.alt) || storyFallback.properties.alt,
        },
      };
    } else addSample("sample-about-story");

    if (!result.some((section) => sectionTitle(section).includes("mision") || sectionTitle(section).includes("vision") || sectionTitle(section).includes("valores"))) addSample("sample-about-purpose");
    const hasGalleryContent = result.some((section) => section.type === "gallery" && (
      (Array.isArray(section.properties.items) && section.properties.items.length > 0) || asString(section.properties.image_url)
    ));
    if (!hasGalleryContent) addSample("sample-about-gallery");
  }

  if (slug === "contacto") {
    const contactIndex = result.findIndex((section) => items(section.properties.items).some((item) => /^(mailto:|tel:)/i.test(item.url ?? "")));
    if (contactIndex >= 0) {
      const current = result[contactIndex];
      const contactItems = items(current.properties.items).map((item) => ({
        ...item,
        icon: item.icon || (/^mailto:/i.test(item.url ?? "") ? "mail" : /^tel:/i.test(item.url ?? "") ? "call" : /direcci|ubicaci/i.test(item.title ?? "") ? "location_on" : "info"),
      }));
      result[contactIndex] = { ...current, properties: { ...current.properties, layout: "contact-grid", items: contactItems } };
    } else addSample("sample-contact-details");
  }

  return result.sort((a, b) => a.position - b.position);
}

function standardHomepageSections(sections: PageSection[], institutionName: string): PageSection[] {
  const visible = sections.filter((section) => section.is_visible);
  const configuredTypes = new Set(sections.map((section) => section.type));
  const configuredHeadings = new Set(sections.map((section) => normalizeText(section.properties.title)));
  const additions: PageSection[] = [];
  let nextPosition = Math.max(-1, ...sections.map((section) => section.position)) + 1;

  if (!visible.some((section) => section.type === "banner" || section.type === "hero")) {
    additions.push({
      id: "standard-home-hero",
      type: "banner",
      position: -1,
      is_visible: true,
      properties: {
        title: `Bienvenidos a ${institutionName}`,
        subtitle: "Una comunidad educativa comprometida con el aprendizaje y el desarrollo integral.",
        button_label: "Conoce nuestra oferta",
        button_url: "/?slug=oferta-educativa",
        secondary_label: "Contáctanos",
        secondary_url: "/?slug=contacto",
      },
    });
  }

  if (!configuredHeadings.has("por que elegirnos?")) {
    additions.push({
      id: "standard-home-values",
      type: "text",
      position: nextPosition++,
      is_visible: true,
      properties: {
        title: "¿Por qué elegirnos?",
        body: "Acompañamos el aprendizaje y el desarrollo de cada estudiante en comunidad.",
        items: [
          { title: "Aprendizaje integral", description: "Conocimientos, habilidades y valores para cada etapa educativa." },
          { title: "Formación en valores", description: "Respeto, responsabilidad y convivencia dentro de la comunidad." },
          { title: "Acompañamiento cercano", description: "Familias, docentes y estudiantes construyen juntos el camino educativo." },
        ],
      },
    });
  }

  const standardSections: { type: string; title: string; properties: Record<string, unknown> }[] = [
    { type: "news", title: "Noticias", properties: { title: "Últimas noticias", limit: 3 } },
    { type: "events", title: "Eventos", properties: { title: "Próximos eventos", limit: 4 } },
    { type: "staff", title: "Equipo", properties: { title: "Nuestro equipo" } },
    { type: "honors", title: "Reconocimientos", properties: { title: "Cuadro de honor", limit: 6 } },
    { type: "social_links", title: "Redes", properties: { title: "Síguenos en redes" } },
  ];
  for (const section of standardSections) {
    if (configuredTypes.has(section.type)) continue;
    additions.push({ id: `standard-home-${section.type}`, type: section.type, position: nextPosition++, is_visible: true, properties: section.properties });
  }

  if (visible.filter((section) => section.type === "banner" || section.type === "hero").length + additions.filter((section) => section.type === "banner").length < 2) {
    additions.push({
      id: "standard-home-contact",
      type: "banner",
      position: nextPosition,
      is_visible: true,
      properties: {
        size: "compact",
        title: "Conoce nuestra comunidad educativa",
        subtitle: "Escríbenos para recibir información sobre nuestra propuesta educativa.",
        button_label: "Contáctanos",
        button_url: "/?slug=contacto",
      },
    });
  }

  return [...visible, ...additions].sort((a, b) => a.position - b.position);
}

function SocialSection({ title = "Síguenos", social }: { title?: string; social?: SocialLink[] }) {
  const { config } = useSite();
  const links = social ?? config.social;
  if (links.length === 0) return null;
  return (
    <section className="site-section site-block">
      <div className="site-container">
        <h2>{title}</h2>
        <ul className="site-chips">
          {links.map((s) => (
            <li key={`${s.label}|${s.url}`}>
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

function Section({ s, social, isHomepage, isPrimaryHomepageHero = false }: { s: PageSection; social?: SocialLink[]; isHomepage: boolean; isPrimaryHomepageHero?: boolean }) {
  const p = s.properties;
  const title = asString(p.title);
  const limit = typeof p.limit === "number" && p.limit > 0 ? Math.min(p.limit, 24) : undefined;

  if (s.type === "banner" || s.type === "hero") {
    // El hero identifica y presenta el portal desde Inicio. En páginas internas,
    // la sección real ya aporta su propio título y contenido.
    const b1 = asString(p.button_label), u1 = asString(p.button_url);
    const b2 = asString(p.secondary_label), u2 = asString(p.secondary_url);
    const eyebrow = asString(p.eyebrow);
    const image = asString(p.image_url);
    const heroStyle = image && SAFE_IMAGE.test(image) ? ({ "--site-hero-image": `url("${image}")` } as CSSProperties) : undefined;
    if (!isHomepage) {
      if (!title && !asString(p.subtitle)) return null;
      return <section className="site-page-intro" style={heroStyle}>
        <div className="site-container">
          {eyebrow && <p className="site-page-intro__eyebrow">{eyebrow}</p>}
          {title && <h1>{title}</h1>}
          {asString(p.subtitle) && <p>{asString(p.subtitle)}</p>}
        </div>
      </section>;
    }
    return (
      <section className={`site-hero${p.size === "compact" && !isPrimaryHomepageHero ? " site-hero--compact" : ""}`} style={heroStyle}>
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
  if (s.type === "staff" && p.source !== 'manual') return <StaffSection title={title} />;
  if (s.type === "honors") return <HonorsSection title={title} limit={limit} />;
  if (s.type === "social_links") return <SocialSection title={title} social={social} />;

  if (s.type === "gallery") {
    const pictures = Array.isArray(p.items) ? p.items.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object' && typeof item.image_url === 'string' && SAFE_IMAGE.test(item.image_url)) : [];
    if (pictures.length) return <section className="site-section site-block"><div className="site-container">{title && <h2>{title}</h2>}<ul className="site-gallery">{pictures.map((item,index)=><li className="site-gallery__item" key={index}><figure><img src={String(item.image_url)} alt={asString(item.alt) ?? ''} loading="lazy" />{asString(item.caption) && <figcaption>{asString(item.caption)}</figcaption>}</figure></li>)}</ul></div></section>;
    const image = asString(p.image_url);
    if (image && SAFE_IMAGE.test(image)) return <section className="site-section site-block"><div className="site-container">{title && <h2>{title}</h2>}<ul className="site-gallery"><li className="site-gallery__item"><figure><img src={image} alt={asString(p.alt) ?? ''} loading="lazy" />{asString(p.body) && <figcaption>{asString(p.body)}</figcaption>}</figure></li></ul></div></section>;
    return <GallerySection title={title} items={galleryItems(p.items)} limit={limit} />;
  }

  if (EXTERNAL_SECTION_TYPES.includes(s.type)) return <ExternalSection type={s.type} title={title} properties={p} />;

  const list = items(p.items);
  const body = asString(p.body ?? p.text ?? p.content);

  if (s.type === "links" && p.layout === "contact-grid") return (
    <section className="site-section site-block site-block--contact">
      <div className="site-container">
        {title && <h2>{title}</h2>}
        <Paragraphs text={body} />
        <ul className="site-contact-grid">
          {list.map((item, index) => <li className="site-contact-card" key={`${item.title ?? "contacto"}-${index}`}>
            <span className="site-contact-card__icon material-symbols-rounded" aria-hidden="true">{item.icon || "info"}</span>
            {item.title && <h3>{item.title}</h3>}
            {item.description && <p>{item.description}</p>}
            {item.url && <SafeLink url={item.url} className="site-contact-card__link">{item.url.startsWith("mailto:") ? "Enviar correo" : item.url.startsWith("tel:") ? "Llamar" : "Consultar"}</SafeLink>}
          </li>)}
        </ul>
      </div>
    </section>
  );

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
  const image = asString(p.image_url);
  const tone = p.tone === "dark" ? " site-block--dark" : p.tone === "tint" ? " site-block--tint" : "";

  if (p.layout === "story") return (
    <section className="site-section site-block site-block--story">
      <div className="site-container">
        {eyebrow && <p className="site-eyebrow">{eyebrow}</p>}
        <div className="site-story__grid">
          <div className="site-story__copy">
            {title && <h2>{title}</h2>}
            <Paragraphs text={body} />
          </div>
          {image && SAFE_IMAGE.test(image) && <figure className="site-story__image"><img src={image} alt={asString(p.alt) ?? ""} loading="lazy" /></figure>}
        </div>
      </div>
    </section>
  );

  if (p.layout === "education-levels") return (
    <section className="site-section site-block site-block--levels">
      <div className="site-container">
        {eyebrow && <p className="site-eyebrow">{eyebrow}</p>}
        {title && <h2>{title}</h2>}
        <Paragraphs text={body} />
        <ul className="site-levels__grid">
          {list.map((item, index) => <li className="site-levels__card" key={`${item.title ?? "nivel"}-${index}`}>
            {item.imageUrl && SAFE_IMAGE.test(item.imageUrl) && <figure className="site-levels__image"><img src={item.imageUrl} alt={item.imageAlt ?? ""} loading="lazy" /></figure>}
            <div className="site-levels__body">
              {item.title && <h3>{item.title}</h3>}
              {item.description && <p>{item.description}</p>}
              {item.url && <SafeLink url={item.url} className="site-btn site-levels__link">{item.linkLabel || "Leer más"}</SafeLink>}
            </div>
          </li>)}
        </ul>
      </div>
    </section>
  );

  if (p.layout === "contact-grid") return (
    <section className={`site-section site-block${tone} site-block--contact`}>
      <div className="site-container">
        {eyebrow && <p className="site-eyebrow">{eyebrow}</p>}
        {title && <h2>{title}</h2>}
        <Paragraphs text={body} />
        <ul className="site-contact-grid">
          {list.map((item, index) => <li className="site-contact-card" key={`${item.title ?? "contacto"}-${index}`}>
            <span className="site-contact-card__icon material-symbols-rounded" aria-hidden="true">{item.icon || "info"}</span>
            {item.title && <h3>{item.title}</h3>}
            {item.description && <p>{item.description}</p>}
            {item.url && <SafeLink url={item.url} className="site-contact-card__link">{item.url.startsWith("mailto:") ? "Enviar correo" : item.url.startsWith("tel:") ? "Llamar" : "Consultar"}</SafeLink>}
          </li>)}
        </ul>
      </div>
    </section>
  );

  return (
    <section className={`site-section site-block${tone}`}>
      <div className="site-container">
        {eyebrow && <p className="site-eyebrow">{eyebrow}</p>}
        {title && <h2>{title}</h2>}
        {image && SAFE_IMAGE.test(image) && <figure><img src={image} alt={asString(p.alt) ?? ''} loading="lazy" /></figure>}
        <Paragraphs text={body} />
        {asString(p.url) && <SafeLink url={String(p.url)} className="site-btn">{asString(p.link_label) || 'Consultar'}</SafeLink>}
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

export function PageSections({ sections, isHomepage = false, managed = false, template = 'classic', social }: { sections: PageSection[]; isHomepage?: boolean; managed?: boolean; template?: 'classic' | 'cards' | 'editorial'; social?: SocialLink[] }) {
  const location = useLocation();
  const { institution } = useInstitution();
  const query = new URLSearchParams(location.search);
  const onHomepage = isHomepage || !query.has("slug");
  const isElEsfuerzo = institution?.slug.toLocaleLowerCase("es") === "ue-el-esfuerzo" || normalizeText(institution?.name).includes("el esfuerzo");
  const pageSections = !managed && onHomepage && isElEsfuerzo
    ? standardHomepageSections(sections, institution?.name || "nuestra institución")
    : sections.filter((s) => s.is_visible).sort((a, b) => a.position - b.position);
  const visible = onHomepage ? pageSections : standardizeInformationalPage(pageSections, query.get("slug") ?? "");
  if (visible.length === 0) return <p className="site-container site-section">Esta página aún no tiene contenido.</p>;
  const primaryHeroId = onHomepage ? visible.find((section) => section.type === "banner" || section.type === "hero")?.id : undefined;
  const content = visible.map((s) => <Section key={s.id} s={s} social={social} isHomepage={onHomepage} isPrimaryHomepageHero={s.id === primaryHeroId} />);
  const informationalPage = ["nosotros", "oferta-educativa", "contacto"].includes(query.get("slug") ?? "");
  return template === 'classic' || informationalPage ? <>{content}</> : <div className={templateStyles[template]}>{content}</div>;
}
