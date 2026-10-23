import type { MenuNode } from '../types/menu';

/** Shared navigation contract. Page drafts cannot replace the institutional header. */
export function institutionalNavigation(institutionId = ''): MenuNode[] {
  const node = (id: string, label: string, url: string, position: number, children: MenuNode[] = []): MenuNode => ({
    menu_id: `institutional-${id}`, institution_id: institutionId, label, url, position,
    parent_id: null, is_external: false, is_visible: true, created_at: '', updated_at: '', depth: 0,
    children: children.map(child => ({ ...child, parent_id: `institutional-${id}`, depth: 1 })),
  });
  return [
    node('home', 'Inicio', '/', 0),
    node('institution', 'Institución', '/', 1, [
      node('about', 'Nosotros', '/?slug=nosotros', 0),
      node('education', 'Oferta educativa', '/?slug=oferta-educativa', 1),
    ]),
    node('news', 'Noticias', '/?slug=noticias', 2),
    node('contact', 'Contacto', '/?slug=contacto', 3),
    node('learning', 'Simuladores', '/?slug=simuladores', 4),
    node('transparency', 'Transparencia', '/?slug=transparencia', 5),
    node('dece', 'DECE', '/?slug=dece', 6),
  ];
}

export function institutionalMenuEntries() {
  return institutionalNavigation().flatMap(node => [node, ...node.children]).map(node => ({
    id: node.menu_id, parent_id: node.parent_id, label: node.label, url: node.url, is_visible: true,
  }));
}
