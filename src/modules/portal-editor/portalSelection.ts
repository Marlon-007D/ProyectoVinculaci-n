import type { PortalDraft } from './portalService';

export function initialPortalPage(pages: PortalDraft[], preferredId?: string | null): PortalDraft | null {
  return pages.find(page => page.page_id === preferredId)
    ?? pages.find(page => page.snapshot.is_homepage)
    ?? pages[0]
    ?? null;
}

export function conflictingPortalPage(pages: PortalDraft[], pageId: string | null, slug: string): PortalDraft | undefined {
  return pages.find(page => page.page_id !== pageId && (page.snapshot.slug === slug || page.published_slug === slug));
}

export function portalDuplicateMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('code' in error) || error.code !== '23505') return;
  const message = 'message' in error ? String(error.message) : '';
  const constraint = message.match(/constraint "([a-zA-Z_][a-zA-Z_0-9]*)"/i)?.[1];
  if (constraint === 'unique_institution_page_slug')
    return 'Ya existe una página con esa dirección. Selecciónala en «Página que estás editando» para modificarla, o usa otra dirección para una página nueva. Tus cambios siguen en el formulario.';
  return `No se pudo guardar por un registro duplicado${constraint ? ` (${constraint})` : ' (23505)'}. Tus cambios siguen en el formulario. Copia este mensaje para revisar el conflicto.`;
}
