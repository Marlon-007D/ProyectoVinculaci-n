import type { Json } from "../types/common";
import type { Institution } from "../types/institution";
import type { SiteConfig, SiteSettingsRow, SocialLink } from "../types/site";

export function parseSocialLinks(value: Json | undefined): SocialLink[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return [];
  return Object.entries(value)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string" && /^https?:\/\//.test(entry[1]))
    .map(([key, url]) => ({
      label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " "),
      url,
    }));
}

export function buildSiteConfig(institution: Institution | null, settings: SiteSettingsRow | null): SiteConfig {
  return {
    name: settings?.site_title || institution?.name || "Institución educativa",
    logoUrl: settings?.logo_url ?? undefined,
    email: settings?.contact_email ?? undefined,
    phone: settings?.contact_phone ?? undefined,
    footerText: settings?.footer_text ?? undefined,
    social: parseSocialLinks(settings?.social_links),
  };
}
