import { getSiteSettings } from '../site/services/siteSettings';
import { getTheme } from '../site/services/content';
import { getInstitutionBySlug } from '../site/services/institutions';

export interface InstitutionBrand { name: string; logoUrl: string; color: string; initials: string }

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const FALLBACK_COLOR = '#6750a4';
// One request per institution and session, only when a report is printed.
const cache = new Map<string, Promise<{ logoUrl: string; color: string }>>();

export const initialsOf = (name: string) => name.trim().split(/\s+/).filter(word => /^\p{L}/u.test(word)).slice(0, 2).map(word => word[0]).join('').toUpperCase() || 'I';

async function fetchBrand(ref: { id?: string; slug?: string }) {
  const id = ref.id ?? (ref.slug ? (await getInstitutionBySlug(ref.slug))?.institution_id : undefined);
  if (!id) return { logoUrl: '', color: FALLBACK_COLOR };
  const settings = await getSiteSettings(id);
  const theme = await getTheme(settings?.theme_id ?? null).catch(() => null);
  return { logoUrl: settings?.logo_url ?? '', color: theme && HEX.test(theme.primary_color) ? theme.primary_color : FALLBACK_COLOR };
}

/** Waits for the logo so the print dialog never opens with an empty box (at most 2.5 s). */
function preload(url: string) {
  if (!url) return Promise.resolve();
  return Promise.race([
    new Promise<void>(resolve => { const image = new Image(); image.onload = image.onerror = () => resolve(); image.src = url; }),
    new Promise<void>(resolve => setTimeout(resolve, 2500)),
  ]);
}

/**
 * Name, logo and primary colour of an institution for the PDF reports, read on demand from the same
 * settings and theme as the portal (id in the private panel, slug in public pages). Without a logo the
 * initials are used; on any error the report still prints with the neutral colour.
 */
export async function loadInstitutionBrand(ref: { id?: string; slug?: string; name: string }): Promise<InstitutionBrand> {
  const key = `${ref.id ?? ''}|${ref.slug ?? ''}`;
  if (!cache.has(key)) cache.set(key, fetchBrand(ref).catch(() => { cache.delete(key); return { logoUrl: '', color: FALLBACK_COLOR }; }));
  const brand = await cache.get(key)!;
  await preload(brand.logoUrl);
  return { name: ref.name, ...brand, initials: initialsOf(ref.name) };
}
