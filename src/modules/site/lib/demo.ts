import type { Institution } from "../types/institution";
import type { Menu } from "../types/menu";
import type { Page } from "../types/page";
import type { SiteSettingsRow } from "../types/site";
import type { PublicationVersion } from "../types/version";
import type { MediaAsset } from "../types/media";
import type { EventItem, Honor, NewsItem, StaffMember, ThemeRow } from "../types/content";
import { demoSnapshots } from "./demoContent";

const KEY = "portal-demo-mode";

/** Modo demostración: datos de ejemplo en memoria, sin necesitar Supabase. */
export function isDemoMode(): boolean {
  try {
    if (import.meta.env.VITE_DEMO_MODE === "true") return true;
    const q = new URLSearchParams(window.location.search).get("demo");
    if (q === "1") sessionStorage.setItem(KEY, "1");
    if (q === "0") sessionStorage.removeItem(KEY);
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setDemoMode(on: boolean): void {
  try {
    if (on) sessionStorage.setItem(KEY, "1");
    else sessionStorage.removeItem(KEY);
  } catch {
    /* sin almacenamiento: no hay modo demo persistente */
  }
}

const NOW = "2026-01-01T00:00:00.000Z";
const INST = "00000000-0000-4000-8000-000000000001";
const THEME = "00000000-0000-4000-8000-0000000000aa";
const daysFromNow = (d: number) => new Date(Date.now() + d * 864e5).toISOString();

export const demoInstitution: Institution = {
  institution_id: INST, name: "Colegio Demo", slug: "colegio-demo", domain: null, is_active: true,
};

export const demoSettings: SiteSettingsRow = {
  site_setting_id: "00000000-0000-4000-8000-000000000002",
  institution_id: INST,
  site_title: "Colegio Demo",
  logo_url: "data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 48 48%27%3E%3Ccircle cx=%2724%27 cy=%2724%27 r=%2722%27 fill=%27%231d4e89%27/%3E%3Ccircle cx=%2724%27 cy=%2724%27 r=%2719%27 fill=%27none%27 stroke=%27%23f2a900%27 stroke-width=%273%27/%3E%3Ctext x=%2724%27 y=%2730%27 font-size=%2717%27 text-anchor=%27middle%27 fill=%27white%27 font-family=%27Arial%27 font-weight=%27700%27%3ECD%3C/text%3E%3C/svg%3E",
  theme_id: THEME,
  contact_email: "info@colegio-demo.test",
  contact_phone: "0999999999",
  footer_text: "Av. Principal y Calle 1 · Quito, Ecuador",
  social_links: {"facebook": "https://facebook.com/colegiodemo", "instagram": "https://instagram.com/colegiodemo", "youtube": "https://youtube.com/@colegiodemo"},
};

const m = (n: number, label: string, url: string, position: number, parent: string | null = null): Menu => ({
  menu_id: `menu-${n}`, institution_id: INST, label, url,
  parent_id: parent, position, is_external: false, created_at: NOW, updated_at: NOW,
});
export const demoMenus: Menu[] = [
  m(1, "Inicio", "/", 1),
  m(2, "Institución", "/?slug=nosotros", 2),
  m(3, "Nosotros", "/?slug=nosotros", 1, "menu-2"),
  m(4, "Oferta educativa", "/?slug=oferta-educativa", 2, "menu-2"),
  m(5, "Noticias", "/?slug=noticias", 3),
  m(6, "Contacto", "/?slug=contacto", 4),
];

const PAGE_TITLES: Record<string, string> = {"inicio": "Inicio", "nosotros": "Nosotros", "oferta-educativa": "Oferta educativa", "noticias": "Noticias", "contacto": "Contacto"};
export const demoPages: Page[] = Object.keys(PAGE_TITLES).map((slug, i) => ({
  page_id: `page-${slug}`, institution_id: INST, slug, title: PAGE_TITLES[slug], status: "published", is_homepage: i === 0,
}));

export function demoVersions(pageId: string): PublicationVersion[] {
  const page = demoPages.find((p) => p.page_id === pageId);
  if (!page) return [];
  return [{
    publication_version_id: `${pageId}-v1`, page_id: pageId, version_number: 1,
    content_snapshot: demoSnapshots[page.slug] as PublicationVersion["content_snapshot"],
    published_by: null, created_at: NOW,
  }];
}

export const demoMedia: MediaAsset[] = [];

export const demoTheme: ThemeRow = {
  theme_id: THEME, institution_id: INST, name: "Tema principal",
  primary_color: "#1d4e89", secondary_color: "#f2a900", tertiary_color: null,
  font_family: "system-ui, sans-serif", base_font_size: 16,
};

export const demoNews: NewsItem[] = [{"news_id": "n1", "institution_id": INST, "title": "Inicio del año lectivo 2026-2027", "slug": "inicio-del-ano-lectivo", "summary": "Damos la bienvenida a estudiantes y familias.", "content": "Iniciamos un nuevo año lectivo lleno de proyectos.\n\nGracias a toda la comunidad por su confianza.", "cover_image_url": null, "published_at": daysFromNow(-25)}, {"news_id": "n2", "institution_id": INST, "title": "Feria de ciencias: ¡ya tenemos proyectos!", "slug": "feria-de-ciencias", "summary": "Más de 40 equipos presentarán sus experimentos.", "content": "Los estudiantes presentarán sus experimentos ante la comunidad.\n\nLas familias están invitadas a participar.", "cover_image_url": null, "published_at": daysFromNow(-12)}, {"news_id": "n3", "institution_id": INST, "title": "Campeonato interinstitucional de fútbol", "slug": "campeonato-de-futbol", "summary": "Nuestro equipo avanzó a las semifinales.", "content": "Con un gran partido, nuestros estudiantes lograron el pase a semifinales.\n\n¡Todos a apoyar al equipo!", "cover_image_url": null, "published_at": daysFromNow(-7)}, {"news_id": "n4", "institution_id": INST, "title": "Jornada de puertas abiertas", "slug": "jornada-puertas-abiertas", "summary": "Conoce nuestras instalaciones y propuesta educativa.", "content": "Las familias interesadas pueden recorrer el colegio y conversar con docentes y directivos.", "cover_image_url": null, "published_at": daysFromNow(-3)}, {"news_id": "n5", "institution_id": INST, "title": "Nuevo laboratorio de computación", "slug": "nuevo-laboratorio", "summary": "Equipos modernos para el aprendizaje digital.", "content": "Inauguramos un laboratorio con 30 equipos para clases de programación y robótica.", "cover_image_url": null, "published_at": daysFromNow(-1)}];
export const demoEvents: EventItem[] = [{"event_id": "e1", "institution_id": INST, "title": "Reunión de padres de familia", "description": "Entrega de informes y planificación del quimestre.", "location": "Auditorio", "event_date": daysFromNow(5)}, {"event_id": "e2", "institution_id": INST, "title": "Casa abierta de ciencias", "description": "Exposición de proyectos de todos los niveles.", "location": "Patio central", "event_date": daysFromNow(12)}, {"event_id": "e3", "institution_id": INST, "title": "Festival artístico y cultural", "description": "Música, danza y teatro a cargo de los estudiantes.", "location": "Coliseo", "event_date": daysFromNow(20)}, {"event_id": "e4", "institution_id": INST, "title": "Entrega de libretas", "description": "Primer quimestre, por cursos.", "location": "Aulas", "event_date": daysFromNow(40)}];
export const demoStaff: StaffMember[] = [{"staff_id": "s1", "institution_id": INST, "full_name": "Mg. María Fernanda Salazar", "position": "Rectora", "photo_url": null, "bio": "Más de 15 años en gestión educativa.", "position_order": 1}, {"staff_id": "s2", "institution_id": INST, "full_name": "Lic. Carlos Andrés Vera", "position": "Vicerrector", "photo_url": null, "bio": "Especialista en planificación curricular.", "position_order": 2}, {"staff_id": "s3", "institution_id": INST, "full_name": "Mg. Patricia Elena Cordero", "position": "Inspectora General", "photo_url": null, "bio": null, "position_order": 3}, {"staff_id": "s4", "institution_id": INST, "full_name": "Psic. Lucía Elizabeth Mora", "position": "Coordinadora DECE", "photo_url": null, "bio": "Acompañamiento psicológico y orientación vocacional.", "position_order": 4}, {"staff_id": "s5", "institution_id": INST, "full_name": "Lic. Jorge Luis Paredes", "position": "Coordinador de Matemática", "photo_url": null, "bio": null, "position_order": 5}, {"staff_id": "s6", "institution_id": INST, "full_name": "Ing. Andrea Carolina Ruiz", "position": "Coordinadora de Tecnología", "photo_url": null, "bio": null, "position_order": 6}];
export const demoHonors: Honor[] = [{"honor_id": "h1", "institution_id": INST, "achievement": "Mejor promedio", "score": 9.85, "photo_url": null, "student_name": "Sofía Salazar", "grade_level": "Tercero de Bachillerato"}, {"honor_id": "h2", "institution_id": INST, "achievement": "Olimpiada de matemática", "score": 9.7, "photo_url": null, "student_name": "Daniel Paredes", "grade_level": "Primero de Bachillerato"}, {"honor_id": "h3", "institution_id": INST, "achievement": "Mérito artístico", "score": 9.55, "photo_url": null, "student_name": "Valentina Cordero", "grade_level": "Noveno de Básica"}, {"honor_id": "h4", "institution_id": INST, "achievement": "Excelencia deportiva", "score": 9.4, "photo_url": null, "student_name": "Mateo Vera", "grade_level": "Décimo de Básica"}];
