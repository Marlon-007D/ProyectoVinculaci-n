import { getSupabase } from "../lib/supabase";
import { toServiceError } from "../lib/errors";
import type { Menu, MenuNode } from "../types/menu";
import { buildMenuTree } from "../utils/menuTree";

export async function getMenus(institutionId: string): Promise<Menu[]> {
  const { data, error } = await getSupabase()
    .from("menus")
    .select("*")
    .eq("institution_id", institutionId)
    .order("position", { ascending: true });
  if (error) throw toServiceError(error, "No se pudo cargar el menú de navegación.");
  return (data ?? []) as Menu[];
}

export async function getMenuTree(institutionId: string): Promise<MenuNode[]> {
  return buildMenuTree(await getMenus(institutionId));
}
