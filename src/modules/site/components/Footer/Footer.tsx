import type { MenuNode } from "../../types/menu";
import type { SiteConfig } from "../../types/site";
import { flattenLeaves } from "../../utils/menuTree";
import { MenuLink } from "../Navigation/MenuLink";

export function Footer({ config, tree = [] }: { config: SiteConfig; tree?: MenuNode[] }) {
  const links = flattenLeaves(tree).slice(0, 5);
  const hasContact = Boolean(config.email || config.phone);
  return (
    <footer className="site-footer">
      <div className="site-container site-footer__inner">
        <div className="site-footer__brand">
          <p className="site-footer__name">{config.name}</p>
          {config.footerText && <p className="site-footer__desc">{config.footerText}</p>}
        </div>
        {links.length > 0 && (
          <nav aria-label="Pie de página">
            <h2 className="site-footer__heading">Explora</h2>
            <ul className="site-footer__links">
              {links.map((n) => (
                <li key={n.menu_id}><MenuLink node={n} /></li>
              ))}
            </ul>
          </nav>
        )}
        {(hasContact || config.social.length > 0) && (
          <div className="site-footer__extras">
            {hasContact && (
              <section className="site-footer__group">
                <h2 className="site-footer__heading">Contacto</h2>
                <ul className="site-footer__contact">
                  {config.email && <li><a href={`mailto:${config.email}`}>{config.email}</a></li>}
                  {config.phone && <li><a href={`tel:${config.phone.replace(/\s/g, "")}`}>{config.phone}</a></li>}
                </ul>
              </section>
            )}
            {config.social.length > 0 && (
              <section className="site-footer__group">
                <h2 className="site-footer__heading">Redes</h2>
                <ul className="site-footer__links" aria-label="Redes sociales">
                  {config.social.map((s) => (
                    <li key={`${s.label}|${s.url}`}>
                      <a href={s.url} target="_blank" rel="noopener noreferrer">
                        {s.label}<span className="site-sr-only"> (se abre en una pestaña nueva)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
      <div className="site-container site-footer__legal">
        <p>© {new Date().getFullYear()} {config.name}</p>
      </div>
    </footer>
  );
}
