import { useId, useState } from "react";
import { useAsync } from "../site/hooks/useAsync";
import { Link, useLocation } from "react-router-dom";
import { getStaff } from "../site/services/content";
import { getPublicUrlFromPath } from "../site/utils/mediaUrl";
import { useSite } from "../site/hooks/useSite";
import { useInstitution } from "../site/context/InstitutionContext";
import { joinBase } from "../site/utils/basePath";
import { keepInstitution } from "../site/utils/url";
import type { StaffMember } from "../site/types/content";
import { DeceIcon, type DeceIconName } from "./DeceIcon";
import { ScrollSnapCarousel } from "./ScrollSnapCarousel";
import styles from "./public.module.css";

type Props = { institutionId: string; title?: string; properties?: Record<string, unknown> };
type Contact = { email?: unknown; phone?: unknown; schedule?: unknown; location?: unknown };
type Service = { title?: string; description?: string; icon?: DeceIconName | string };
type Step = { title?: string; description?: string };
type Faq = { question: string; answer: string };
type Resource = { title: string; description?: string; url: string };
type GalleryImage = { src: string | null; alt: string; caption?: string };
type CtaButton = { label?: string; url?: string; email_subject?: string };
type Cta = { title?: string; text?: string; primary?: CtaButton; secondary?: CtaButton };

const text = (value: unknown): string | undefined => typeof value === "string" && value.trim() ? value : undefined;

function records<T>(value: unknown, convert: (item: unknown) => T | null): T[] {
  return Array.isArray(value) ? value.map(convert).filter((item): item is T => item !== null) : [];
}

function services(value: unknown): Service[] {
  return records(value, (item) => {
    if (typeof item === "string") {
      const title = text(item);
      return title ? { title } : null;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const title = text(row.title), description = text(row.description);
    return title || description ? { title, description, icon: text(row.icon) } : null;
  });
}

function steps(value: unknown): Step[] {
  return records(value, (item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const title = text(row.title), description = text(row.description);
    return title || description ? { title, description } : null;
  });
}

function faqs(value: unknown): Faq[] {
  return records(value, (item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const question = text(row.question), answer = text(row.answer);
    return question && answer ? { question, answer } : null;
  });
}

function safeHttpUrl(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function resources(value: unknown): Resource[] {
  return records(value, (item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const title = text(row.title), url = safeHttpUrl(row.url);
    return title && url ? { title, description: text(row.description), url } : null;
  });
}

function safeHttpsUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function gallery(value: unknown): GalleryImage[] {
  return records(value, (item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const row = item as Record<string, unknown>;
    const path = text(row.path);
    if (!path) return null;
    let src: string | null;
    if (/^https:\/\//i.test(path)) src = safeHttpsUrl(path) ?? null;
    else if (/^[a-z][a-z\d+.-]*:/i.test(path) || path.startsWith("//")) return null;
    else src = getPublicUrlFromPath(path);
    if (/^https:\/\//i.test(path) && !src) return null;
    return { src, alt: text(row.alt) ?? "", caption: text(row.caption) };
  });
}

function primaryTarget(value: unknown): { kind: "internal" | "external"; href: string } | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  if (raw.startsWith("/") || raw.startsWith("#")) return { kind: "internal", href: raw };
  const href = safeHttpsUrl(raw);
  return href ? { kind: "external", href } : undefined;
}

function ctaProps(value: unknown): Cta | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Cta : undefined;
}

function safeEmail(value: unknown): string | undefined {
  const email = text(value)?.replace(/[\u0000-\u001f\u007f]/g, "");
  return email && /^[^\s@<>"'`]+@[^\s@<>"'`]+\.[^\s@<>"'`]+$/.test(email) ? email : undefined;
}

function safePhone(value: unknown): string | undefined {
  const phone = text(value);
  if (!phone) return undefined;
  const dial = phone.replace(/[^\d+]/g, "");
  return /^\+?\d{7,15}$/.test(dial) ? dial : undefined;
}

function initials(name: string): string {
  return name.replace(/^(mg|lic|psic|dr|dra|ing|msc|phd)\.?\s+/i, "")
    .split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("").toUpperCase();
}

function photoSource(value: string | null): string | undefined {
  if (!value) return undefined;
  if (/^https?:\/\//i.test(value)) return value;
  return getPublicUrlFromPath(value) ?? undefined;
}

function StaffCard({ member }: { member: StaffMember }) {
  const [imageFailed, setImageFailed] = useState(false);
  const src = photoSource(member.photo_url), email = safeEmail(member.email);
  return (
    <article className={`${styles.staffCard} site-card`}>
      {src && !imageFailed
        ? <img className={styles.staffPhoto} src={src} alt={`Foto de ${member.full_name}`} loading="lazy" onError={() => setImageFailed(true)} />
        : <span className={styles.initials} aria-label={`Foto de ${member.full_name} no disponible`}>{initials(member.full_name)}</span>}
      <h3>{member.full_name}</h3>
      <p className={styles.role}>{member.position}</p>
      {email && <p><a href={`mailto:${email}`}>{email}</a></p>}
    </article>
  );
}

function GallerySlide({ image }: { image: GalleryImage }) {
  const [failed, setFailed] = useState(!image.src);
  return <figure className={styles.galleryFigure}>
      {image.src && !failed
        ? <img className={styles.galleryImage} src={image.src} alt={image.alt} loading="lazy" onError={() => setFailed(true)} />
        : <div className={styles.galleryFallback} role={image.alt || image.caption ? "img" : undefined} aria-label={image.alt || image.caption}>
          <DeceIcon name="compass" className={styles.galleryFallbackIcon} />
          {(image.caption || image.alt) && <span>{image.caption || image.alt}</span>}
        </div>}
      {image.caption && <figcaption>{image.caption}</figcaption>}
    </figure>
}
function SectionHeading({ id, children }: { id: string; children: string }) {
  return <h2 id={id}>{children}</h2>;
}

export function DecePublicSection({ institutionId, title, properties = {} }: Props) {
  const { config } = useSite();
  const { basePath } = useInstitution();
  const routeLocation = useLocation();
  const ids = useId();
  const heading = title ?? text(properties.title);
  const intro = text(properties.intro), eyebrow = text(properties.eyebrow), notice = text(properties.notice);
  const serviceItems = services(properties.services), stepItems = steps(properties.steps);
  const faqItems = faqs(properties.faq), resourceItems = resources(properties.resources);
  const galleryItems = gallery(properties.gallery), galleryTitle = text(properties.gallery_title);
  const cta = ctaProps(properties.cta), ctaTitle = text(cta?.title), ctaText = text(cta?.text);
  const primary = primaryTarget(cta?.primary?.url), primaryLabel = text(cta?.primary?.label);
  const secondaryLabel = text(cta?.secondary?.label), secondarySubject = text(cta?.secondary?.email_subject);
  const servicesTitle = text(properties.services_title), stepsTitle = text(properties.steps_title);
  const teamTitle = text(properties.team_title), contactTitle = text(properties.contact_title);
  const faqTitle = text(properties.faq_title), resourcesTitle = text(properties.resources_title);
  const positionFilter = text(properties.team_position_filter);
  const team = useAsync(() => teamTitle ? getStaff(institutionId, positionFilter) : Promise.resolve([]), [institutionId, positionFilter, teamTitle]);
  const members = team.state.status === "success" ? team.state.data : [];
  const customContact = properties.contact && typeof properties.contact === "object" && !Array.isArray(properties.contact)
    ? properties.contact as Contact : undefined;
  const institutionContact = !customContact;
  const contactEmail = safeEmail(institutionContact ? config.email : customContact.email);
  const ctaEmail = safeEmail(customContact?.email) ?? safeEmail(config.email);
  const secondaryHref = ctaEmail && secondaryLabel
    ? `mailto:${ctaEmail}${secondarySubject ? `?subject=${encodeURIComponent(secondarySubject)}` : ""}`
    : undefined;
  const contactPhone = text(institutionContact ? config.phone : customContact.phone);
  const dialPhone = safePhone(contactPhone), schedule = text(customContact?.schedule), location = text(customContact?.location);
  const hasContact = !!(contactEmail || contactPhone || schedule || location);

  return (
    <div className={styles.page}>
      {heading && <section className={styles.hero} aria-labelledby={`${ids}-hero`}>
        <div className={styles.heroInner}>
          {eyebrow && <p className={styles.heroEyebrow}>{eyebrow}</p>}
          <h2 id={`${ids}-hero`}>{heading}</h2>
          {intro && <p className={styles.heroIntro}>{intro}</p>}
        </div>
      </section>}

      {galleryTitle && galleryItems.length > 0 && <section className={`${styles.block} ${styles.galleryBlock}`} aria-labelledby={`${ids}-gallery`}><div className={styles.inner}>
        <SectionHeading id={`${ids}-gallery`}>{galleryTitle}</SectionHeading>
        {galleryItems.length === 1
          ? <ul className={styles.gallerySingle}><li><GallerySlide image={galleryItems[0]} /></li></ul>
          : <ScrollSnapCarousel
              items={galleryItems}
              label={galleryTitle}
              itemKey={(image, index) => `${image.src ?? "image"}-${index}`}
              variant="gallery"
              showIndicators
              renderItem={(image) => <GallerySlide image={image} />}
            />}
      </div></section>}

      {servicesTitle && serviceItems.length > 0 && <section className={styles.block} aria-labelledby={`${ids}-services`}><div className={styles.inner}>
        <SectionHeading id={`${ids}-services`}>{servicesTitle}</SectionHeading>
        <ul className={styles.services}>{serviceItems.map((service, index) => <li className={styles.serviceCard} key={`${service.title ?? "service"}-${index}`}>
          <span className={styles.iconCircle}><DeceIcon name={service.icon} className={styles.icon} /></span>
          {service.title && <h3>{service.title}</h3>}{service.description && <p>{service.description}</p>}
        </li>)}</ul>
      </div></section>}

      {stepsTitle && stepItems.length > 0 && <section className={`${styles.block} ${styles.stepsBlock}`} aria-labelledby={`${ids}-steps`}><div className={styles.inner}>
        <SectionHeading id={`${ids}-steps`}>{stepsTitle}</SectionHeading>
        <ol className={styles.steps}>{stepItems.map((step, index) => <li className={styles.step} key={`${step.title ?? "step"}-${index}`}>
          <span className={styles.stepNumber} aria-hidden="true">{index + 1}</span><div>{step.title && <h3>{step.title}</h3>}{step.description && <p>{step.description}</p>}</div>
        </li>)}</ol>
      </div></section>}

      {ctaTitle && <section className={styles.cta} aria-labelledby={`${ids}-cta`}><div className={styles.ctaInner}>
        <div className={styles.ctaCopy}><h2 id={`${ids}-cta`}>{ctaTitle}</h2>{ctaText && <p>{ctaText}</p>}</div>
        {(primary && primaryLabel || secondaryHref) && <div className={styles.ctaActions}>
          {primary && primaryLabel && (primary.kind === "external"
            ? <a className={styles.ctaPrimary} href={primary.href} target="_blank" rel="noopener noreferrer">{primaryLabel}<span className={styles.srOnly}> (abre en una pestaña nueva)</span></a>
            : <Link className={styles.ctaPrimary} to={primary.href.startsWith("#")
                ? { pathname: routeLocation.pathname, search: routeLocation.search, hash: primary.href }
                : keepInstitution(joinBase(basePath, primary.href), routeLocation.search)}>{primaryLabel}</Link>)}
          {secondaryHref && secondaryLabel && <a className={styles.ctaSecondary} href={secondaryHref}>{secondaryLabel}</a>}
        </div>}
      </div></section>}

      {teamTitle && members.length > 0 && <section className={styles.block} aria-labelledby={`${ids}-team`}><div className={styles.inner}>
        <SectionHeading id={`${ids}-team`}>{teamTitle}</SectionHeading>
        {members.length > 3
          ? <ScrollSnapCarousel items={members} label={teamTitle} itemKey={(member) => member.staff_id} variant="team" renderItem={(member) => <StaffCard member={member} />} />
          : <ul className={styles.staffList}>{members.map((member) => <li key={member.staff_id}><StaffCard member={member} /></li>)}</ul>}
      </div></section>}

      {hasContact && (contactTitle || institutionContact) && <section className={styles.block} aria-labelledby={`${ids}-contact`}><div className={styles.inner}>
        <SectionHeading id={`${ids}-contact`}>{contactTitle ?? "Contacto de la institución"}</SectionHeading>
        <ul className={styles.contactCards}>
          {contactEmail && <li><span className={styles.contactIcon}><DeceIcon name="chat" className={styles.icon} /></span><h3>Correo</h3><a href={`mailto:${contactEmail}`}>{contactEmail}</a></li>}
          {contactPhone && <li><span className={styles.contactIcon}><DeceIcon name="users" className={styles.icon} /></span><h3>Teléfono</h3>{dialPhone ? <a href={`tel:${dialPhone}`}>{contactPhone}</a> : <p>{contactPhone}</p>}</li>}
          {schedule && <li><span className={styles.contactIcon}><DeceIcon name="star" className={styles.icon} /></span><h3>Horario</h3><p>{schedule}</p></li>}
          {location && <li><span className={styles.contactIcon}><DeceIcon name="home" className={styles.icon} /></span><h3>Ubicación</h3><p>{location}</p></li>}
        </ul>
      </div></section>}

      {faqTitle && faqItems.length > 0 && <section className={styles.block} aria-labelledby={`${ids}-faq`}><div className={styles.inner}>
        <SectionHeading id={`${ids}-faq`}>{faqTitle}</SectionHeading>
        <div className={styles.faqList}>{faqItems.map((item, index) => <details className={styles.faqItem} key={`${item.question}-${index}`}>
          <summary>{item.question}</summary><p>{item.answer}</p>
        </details>)}</div>
      </div></section>}

      {resourcesTitle && resourceItems.length > 0 && <section className={styles.block} aria-labelledby={`${ids}-resources`}><div className={styles.inner}>
        <SectionHeading id={`${ids}-resources`}>{resourcesTitle}</SectionHeading>
        <ul className={styles.resources}>{resourceItems.map((resource, index) => <li className={styles.resourceCard} key={`${resource.url}-${index}`}>
          <div><h3>{resource.title}</h3>{resource.description && <p>{resource.description}</p>}</div>
          <a className={styles.resourceLink} href={resource.url} target="_blank" rel="noopener noreferrer">Visitar recurso<span className={styles.srOnly}>: {resource.title} (abre en una pestaña nueva)</span></a>
        </li>)}</ul>
      </div></section>}

      {notice && <section className={styles.noticeSection} aria-labelledby={`${ids}-notice`}><div className={`${styles.inner} ${styles.notice}`}>
        <DeceIcon name="shield" className={styles.noticeIcon} /><div><h2 id={`${ids}-notice`}>Aviso de confidencialidad</h2><p>{notice}</p></div>
      </div></section>}
    </div>
  );
}
