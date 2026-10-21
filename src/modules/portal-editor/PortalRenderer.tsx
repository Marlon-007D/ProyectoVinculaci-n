import {moduleClass} from './portalStyles';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { ArrowUpRight, GraduationCap, Image as ImageIcon } from 'lucide-react';
import type { PortalSnapshot } from './contract';
import { contrastText, safeUrl, textValue } from './contract';
interface Card {
    title: string;
    body?: string;
    image_url?: string;
}
interface Props {
    snapshot: PortalSnapshot;
    institutionSlug: string;
    news?: Card[];
    staff?: Card[];
    events?: Card[];
    honors?: Card[];
    preview?: boolean;
}
function PortalImage({ src, alt, logo = false }: {
    src: string;
    alt: string;
    logo?: boolean;
}) {
    const [failed, setFailed] = useState(false);
    return failed ? (logo ? <GraduationCap aria-hidden="true"/> : <span className={moduleClass("portal-image-missing")}><ImageIcon aria-hidden="true"/>Imagen no disponible</span>) : <img src={src} alt={alt} loading={logo ? 'eager' : 'lazy'} onError={() => setFailed(true)}/>;
}
export function PortalRenderer({ snapshot, institutionSlug, news = [], staff = [], events = [], honors = [], preview = false }: Props) {
    const style = { '--portal-primary': snapshot.theme.primary_color, '--portal-primary-ink': contrastText(snapshot.theme.primary_color), '--portal-secondary': snapshot.theme.secondary_color, '--portal-contrast': contrastText(snapshot.theme.secondary_color), fontFamily: snapshot.theme.font_family } as CSSProperties;
    const sections = snapshot.sections.filter(section => section.is_visible).sort((a, b) => a.position - b.position);
    function link(url: unknown, children: ReactNode, className?: string) {
        const destination = safeUrl(url);
        return destination ? <a className={moduleClass(className)} href={preview ? undefined : destination} aria-disabled={preview || undefined} onClick={preview ? event => event.preventDefault() : undefined}>{children}</a> : null;
    }
    return <article className={moduleClass(`published-portal template-${snapshot.template}`)} style={style}>
    <header className={moduleClass("portal-header")}>
      <div className={moduleClass("portal-brand")}><span className={moduleClass("portal-logo")}>{safeUrl(snapshot.settings.logo_url) ? <PortalImage key={snapshot.settings.logo_url} src={snapshot.settings.logo_url} alt={`Logotipo de ${snapshot.settings.site_title}`} logo/> : <GraduationCap size={28} aria-hidden="true"/>}</span><div><span className={moduleClass("portal-brand-caption")}>COMUNIDAD EDUCATIVA</span><strong>{snapshot.settings.site_title || 'Nombre de la institución'}</strong></div></div>
      {!!snapshot.menus.length && <nav aria-label="Navegación institucional">{snapshot.menus.map((menu, index) => <span key={index}>{link(menu.url, menu.label)}</span>)}</nav>}
    </header>
    <div className={moduleClass("portal-page-heading")}><p>PORTAL INSTITUCIONAL</p><h1>{snapshot.title || (preview ? 'Tu próxima página' : '')}</h1></div>
    {!sections.length && preview && <div className={moduleClass("portal-empty-preview")}><GraduationCap size={40} aria-hidden="true"/><h2>Aquí empieza tu portal</h2><p>Añade una sección para ver cómo se presenta tu contenido.</p></div>}
    <div className={moduleClass("portal-sections")}>{sections.map(section => {
            const p = section.properties;
            const title = textValue(p.title);
            const body = textValue(p.body ?? p.subtitle);
            const source = section.type === 'news' ? news : section.type === 'staff' ? staff : section.type === 'events' ? events : section.type === 'honors' ? honors : null;
            const destination = section.type === 'transparency' ? `/proyectos?transparency=1&institution=${encodeURIComponent(institutionSlug)}` : section.type === 'simulators' ? `/simuladores?institution=${encodeURIComponent(institutionSlug)}` : safeUrl(p.url ?? p.button_url);
            const items = Array.isArray(p.items) ? p.items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item)) : [];
            return <section key={section.id} className={moduleClass(`portal-section portal-${section.type} ${safeUrl(p.image_url) ? 'has-image' : ''}`)}>
        <div className={moduleClass("portal-section-copy")}>{title && <h2>{title}</h2>}{body && <p className={moduleClass("portal-body")}>{body}</p>}
          {destination && !(section.type === 'links' && items.length) && link(destination, <>{textValue(p.link_label ?? p.button_label) || 'Conocer más'}<ArrowUpRight size={17} aria-hidden="true"/></>, 'portal-action')}
        </div>
        {safeUrl(p.image_url) && <figure className={moduleClass("portal-section-image")}><PortalImage key={textValue(p.image_url)} src={textValue(p.image_url)} alt={textValue(p.alt)}/></figure>}
        {source !== null && (source.length ? <div className={moduleClass("portal-cards")}>{source.map((card, index) => <article className={moduleClass("portal-content-card")} key={index}>{safeUrl(card.image_url) && <PortalImage key={card.image_url} src={card.image_url!} alt={card.title}/>}<div><h3>{card.title}</h3>{card.body && <p>{card.body}</p>}</div></article>)}</div> : <p className={moduleClass("portal-muted")}>{preview ? 'Las publicaciones de tu institución aparecerán aquí.' : 'No hay publicaciones disponibles en esta sección.'}</p>)}
        {items.length > 0 && <div className={moduleClass("portal-cards")}>{items.map((item, index) => <article className={moduleClass("portal-content-card")} key={index}><div><h3>{textValue(item.title ?? item.label)}</h3>{textValue(item.description) && <p>{textValue(item.description)}</p>}{link(item.url, <>Consultar<ArrowUpRight size={16} aria-hidden="true"/></>, 'portal-action')}</div></article>)}</div>}
      </section>;
        })}</div>
    <footer className={moduleClass("portal-footer")}><div><GraduationCap size={22} aria-hidden="true"/><strong>{snapshot.settings.site_title}</strong></div>{snapshot.settings.footer_text && <p>{snapshot.settings.footer_text}</p>}</footer>
  </article>;
}
