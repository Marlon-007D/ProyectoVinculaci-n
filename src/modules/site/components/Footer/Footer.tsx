import type { MenuNode } from "../../types/menu";
import type { SiteConfig } from "../../types/site";
import { flattenLeaves } from "../../utils/menuTree";
import { MenuLink } from "../Navigation/MenuLink";

export function Footer({ config, tree = [] }: { config: SiteConfig; tree?: MenuNode[] }) {
  const links = flattenLeaves(tree);
  return (
    <footer className="site-footer">
      <div className="site-container site-footer__inner">
        <div>
          <p className="site-footer__name">{config.name}</p>
          {config.footerText && <p>{config.footerText}</p>}
          {config.phone && <p><a href={`tel:${config.phone.replace(/\s/g, "")}`}>{config.phone}</a></p>}
          {config.email && <p><a href={`mailto:${config.email}`}>{config.email}</a></p>}
        </div>
        {links.length > 0 && (
          <nav aria-label="Pie de página">
            <ul className="site-footer__links">
              {links.map((n) => (
                <li key={n.menu_id}><MenuLink node={n} /></li>
              ))}
            </ul>
          </nav>
        )}
        {config.social.length > 0 && (
          <ul className="site-footer__links" aria-label="Redes sociales">
            {config.social.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.label}<span className="site-sr-only"> (se abre en una pestaña nueva)</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="site-container site-footer__legal">
        <p>© {new Date().getFullYear()} {config.name}</p>
      </div>
    </footer>
  );
}
