import type { CSSProperties } from 'react';
import type { PortalSnapshot } from './contract';
import { contrastText, safeUrl, textValue } from './contract';
import './portal.css';
interface Card { title: string; body?: string; image_url?: string }
export function PortalRenderer({ snapshot, institutionSlug, news = [], staff = [] }: { snapshot: PortalSnapshot; institutionSlug: string; news?: Card[]; staff?: Card[] }) {
  const colors = snapshot.theme;
  const style = { '--portal-primary': colors.primary_color, '--portal-secondary': colors.secondary_color, '--portal-contrast':contrastText(colors.secondary_color), fontFamily: colors.font_family } as CSSProperties;
  return <article className={`published-portal template-${snapshot.template}`} style={style}>
    <header className="portal-header">{safeUrl(snapshot.settings.logo_url) && <img src={snapshot.settings.logo_url} alt={`Logotipo de ${snapshot.settings.site_title}`} />}<strong>{snapshot.settings.site_title}</strong>
      <nav aria-label="Navegación institucional">{snapshot.menus.map((m, i) => safeUrl(m.url) && <a key={i} href={m.url}>{m.label}</a>)}</nav>
    </header>
    <h1>{snapshot.title}</h1>
    <div className="portal-sections">{snapshot.sections.filter(s => s.is_visible).sort((a, b) => a.position - b.position).map(section => {
      const p = section.properties; const title = textValue(p.title); const body = textValue(p.body);
      const cards = section.type === 'news' ? news : section.type === 'staff' ? staff : [];
      const link = section.type === 'transparency' ? `/proyectos?institution=${encodeURIComponent(institutionSlug)}` : section.type === 'simulators' ? `/simuladores?institution=${encodeURIComponent(institutionSlug)}` : safeUrl(p.url);
      return <section key={section.id} className={`portal-section portal-${section.type}`}>
        {title && <h2>{title}</h2>}{body && <p className="portal-body">{body}</p>}
        {safeUrl(p.image_url) && <img src={textValue(p.image_url)} alt={textValue(p.alt)} loading="lazy" />}
        {cards.length > 0 && <div className="portal-cards">{cards.map((card, index) => <article key={index}><h3>{card.title}</h3>{card.body && <p>{card.body}</p>}{safeUrl(card.image_url) && <img src={card.image_url} alt={card.title} loading="lazy" />}</article>)}</div>}
        {link && <a href={link}>{textValue(p.link_label) || 'Consultar información'}</a>}
      </section>;
    })}</div>
    <footer>{snapshot.settings.footer_text}</footer>
  </article>;
}
