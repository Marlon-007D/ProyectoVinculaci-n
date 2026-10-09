export interface Menu {
  menu_id: string;
  institution_id: string;
  label: string;
  url: string;
  parent_id: string | null;
  position: number;
  is_external: boolean;
  created_at: string;
  updated_at: string;
}

export interface MenuNode extends Menu {
  children: MenuNode[];
  depth: number;
}
