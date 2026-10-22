import type { CSSProperties } from "react";
import type { Json } from "./common";

export interface SiteSettingsRow {
  site_setting_id: string;
  institution_id: string;
  site_title: string;
  logo_url: string | null;
  theme_id: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  footer_text: string | null;
  social_links: Json;
}

export interface SocialLink {
  label: string;
  url: string;
}

export interface SiteConfig {
  name: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  footerText?: string;
  social: SocialLink[];
  themeVars?: CSSProperties;
}
