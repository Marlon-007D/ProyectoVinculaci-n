import type { PortalSnapshot } from './contract';
export type PortalMenu = PortalSnapshot['menus'][number];

export function menuIdentity(menus: PortalMenu[]): PortalMenu[] {
  return menus.map((menu, index) => ({ ...menu, id: menu.id || `menu-${index}`, parent_id: menu.parent_id || null }));
}

export function validateMenuHierarchy(menus: PortalMenu[]) {
  const normalized = menuIdentity(menus);
  const byId = new Map(normalized.map(menu => [menu.id, menu]));
  if (byId.size !== menus.length) throw new Error('Hay enlaces duplicados en la navegación.');
  for (const menu of normalized) {
    const visited = new Set([menu.id]);
    let parent = menu.parent_id;
    while (parent) {
      if (!byId.has(parent) || visited.has(parent)) throw new Error('Revisa los grupos de navegación: no pueden contenerse a sí mismos.');
      visited.add(parent);
      parent = byId.get(parent)!.parent_id;
    }
  }
  return normalized;
}

export function removeMenu(menus: PortalMenu[], index: number) {
  const normalized = menuIdentity(menus);
  const removed = normalized[index];
  return normalized.filter((_, i) => i !== index).map(menu => menu.parent_id === removed.id ? { ...menu, parent_id: removed.parent_id } : menu);
}
