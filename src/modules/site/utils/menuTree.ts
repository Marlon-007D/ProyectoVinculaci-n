import type { Menu, MenuNode } from "../types/menu";

const byPosition = (a: Menu, b: Menu) =>
  a.position - b.position ||
  a.created_at.localeCompare(b.created_at) ||
  a.label.localeCompare(b.label);

function createsCycle(node: MenuNode, nodes: Map<string, MenuNode>): boolean {
  const seen = new Set<string>([node.menu_id]);
  let current = node.parent_id ? nodes.get(node.parent_id) : undefined;
  while (current) {
    if (seen.has(current.menu_id)) return true;
    seen.add(current.menu_id);
    current = current.parent_id ? nodes.get(current.parent_id) : undefined;
  }
  return false;
}

function assignDepth(nodes: MenuNode[], depth: number): void {
  for (const n of nodes) {
    n.depth = depth;
    assignDepth(n.children, depth + 1);
  }
}

export function buildMenuTree(items: Menu[]): MenuNode[] {
  const nodes = new Map<string, MenuNode>();
  for (const m of [...items].sort(byPosition)) {
    nodes.set(m.menu_id, { ...m, children: [], depth: 0 });
  }
  const roots: MenuNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (!parent || parent === node || createsCycle(node, nodes)) roots.push(node);
    else parent.children.push(node);
  }
  assignDepth(roots, 0);
  return roots;
}
