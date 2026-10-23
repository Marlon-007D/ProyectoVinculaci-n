import { buildMenuTree, filterVisibleMenus } from '../site/utils/menuTree';
import { menuIdentity } from './portalMenus';
import { parseSocialLinks } from '../site/utils/siteConfig';
import { InstitutionProvider } from '../site/context/InstitutionContext';
import { SiteFrame } from '../site/components/Layout/SiteFrame';
import { PageSections } from '../site/components/Page/PageSections';
import { buildThemeVars } from '../site/utils/theme';
import type { MenuNode } from '../site/types/menu';
import { normalizeSnapshot, safeUrl, type PortalSnapshot } from './contract';
import '../site/styles/site.css';

interface Props {
  snapshot: PortalSnapshot;
  institutionSlug: string;
  institutionId?: string;
  preview?: boolean;
}

/** The editor renders the same header, footer and sections as the public portal. */
export function PortalRenderer({ snapshot, institutionSlug, institutionId, preview = false }: Props) {
  const normalized = normalizeSnapshot(snapshot);
  const menus: MenuNode[] = buildMenuTree(filterVisibleMenus(menuIdentity(snapshot.menus).filter(menu => safeUrl(menu.url)).map((menu, index) => ({
    menu_id: menu.id || 'preview-' + index, institution_id: institutionId ?? '', label: menu.label, url: menu.url,
    parent_id: menu.parent_id || null, is_visible: menu.is_visible, position: index, is_external: menu.url.startsWith('https://'),
    created_at: '', updated_at: '', children: [], depth: 0,
  }))));
  const config = {
    name: snapshot.settings.site_title,
    logoUrl: safeUrl(snapshot.settings.logo_url),
    footerText: snapshot.settings.footer_text,
    email: snapshot.settings.contact_email,
    phone: snapshot.settings.contact_phone,
    social: parseSocialLinks(snapshot.settings.social_links),
    themeVars: buildThemeVars({ ...snapshot.theme, theme_id: '', institution_id: institutionId ?? '', name: '', tertiary_color: null, base_font_size: null }),
  };
  return <InstitutionProvider institutionId={institutionId}>
    <div inert={preview || undefined} aria-label={preview ? 'Vista previa del portal institucional' : undefined}>
      <SiteFrame config={config} menu={{ state: { status: 'success', data: menus }, reload: () => {} }} homeUrl={'/?institution=' + encodeURIComponent(institutionSlug)} preview={preview}>
        <PageSections managed isHomepage={snapshot.is_homepage} sections={normalized.sections} template={normalized.template} social={config.social} />
      </SiteFrame>
    </div>
  </InstitutionProvider>;
}
